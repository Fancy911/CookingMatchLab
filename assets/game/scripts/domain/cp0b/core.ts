import {
  type BoardGrid,
  type Cell,
  type Coord,
  type GameplayConfig,
  type IngredientId,
  type IngredientUnits,
  type OrderConfig,
  type RecipeConfig,
  type RecipeId,
  type ThrowRecord,
  type AudioEvent,
  type CookResult,
  type CookingHistoryState,
  type ProcessingLevel,
  type SessionPhase,
  type SaveDataV1,
  type SaveDataV2,
} from './types';
import { deepClone, stableHash } from './stable';

const coordKey = ({ row, column }: Coord): string => `${row}:${column}`;

export class BoardModel {
  public constructor(public grid: BoardGrid) {}

  public clone(): BoardModel {
    return new BoardModel(deepClone(this.grid));
  }

  public get(coord: Coord): Cell {
    const cell = this.grid[coord.row]?.[coord.column];
    if (!cell) {
      throw new Error(`Board coordinate out of range: r${coord.row + 1}c${coord.column + 1}`);
    }
    return cell;
  }

  public hash(): string {
    return stableHash(this.grid);
  }
}

export interface PathValidation {
  valid: boolean;
  reason?: string;
}

export class PathValidator {
  public constructor(
    private readonly directions: 4 | 8,
    private readonly minimumLink: number,
  ) {}

  public isAdjacent(left: Coord, right: Coord): boolean {
    const rowDelta = Math.abs(left.row - right.row);
    const columnDelta = Math.abs(left.column - right.column);
    if (rowDelta === 0 && columnDelta === 0) {
      return false;
    }
    if (this.directions === 4) {
      return rowDelta + columnDelta === 1;
    }
    return rowDelta <= 1 && columnDelta <= 1;
  }

  public validate(board: BoardModel, path: Coord[]): PathValidation {
    if (path.length < this.minimumLink) {
      return { valid: false, reason: `Path has ${path.length} cells; minimum is ${this.minimumLink}` };
    }
    if (new Set(path.map(coordKey)).size !== path.length) {
      return { valid: false, reason: 'Path contains a repeated cell' };
    }
    let ingredientId: IngredientId;
    try {
      ingredientId = board.get(path[0]).ingredientId;
    } catch (error) {
      return { valid: false, reason: (error as Error).message };
    }
    for (let index = 0; index < path.length; index += 1) {
      let cell: Cell;
      try {
        cell = board.get(path[index]);
      } catch (error) {
        return { valid: false, reason: (error as Error).message };
      }
      if (cell.ingredientId !== ingredientId) {
        return { valid: false, reason: 'Path contains a different ingredient' };
      }
      if (index > 0 && !this.isAdjacent(path[index - 1], path[index])) {
        return { valid: false, reason: 'Path contains non-adjacent cells' };
      }
    }
    return { valid: true };
  }
}

export class PathEditor {
  private readonly path: Coord[] = [];

  public constructor(
    private readonly board: BoardModel,
    private readonly validator: PathValidator,
  ) {}

  public append(coord: Coord): 'ADDED' | 'BACKTRACKED' | 'REJECTED' {
    if (this.path.length === 0) {
      this.board.get(coord);
      this.path.push(coord);
      return 'ADDED';
    }
    if (this.path.length > 1 && coordKey(coord) === coordKey(this.path[this.path.length - 2])) {
      this.path.pop();
      return 'BACKTRACKED';
    }
    if (this.path.some((existing) => coordKey(existing) === coordKey(coord))) {
      return 'REJECTED';
    }
    const previous = this.path[this.path.length - 1];
    if (
      !this.validator.isAdjacent(previous, coord)
      || this.board.get(previous).ingredientId !== this.board.get(coord).ingredientId
    ) {
      return 'REJECTED';
    }
    this.path.push(coord);
    return 'ADDED';
  }

  public snapshot(): Coord[] {
    return deepClone(this.path);
  }
}

export interface QueueState {
  values: Record<string, Cell[]>;
  cursors: Record<string, number>;
}

export interface NewCell {
  coord: Coord;
  queueIndex: number;
}

export interface BoardResolution {
  board: BoardModel;
  queueState: QueueState;
  newCells: NewCell[];
}

export class BoardResolver {
  public resolve(board: BoardModel, path: Coord[], queueState: QueueState): BoardResolution {
    const removed = new Set(path.map(coordKey));
    const rows = board.grid.length;
    const columns = board.grid[0].length;
    const nextGrid: BoardGrid = Array.from({ length: rows }, () => Array<Cell>(columns));
    const nextQueue = deepClone(queueState);
    const newCells: NewCell[] = [];

    for (let column = 0; column < columns; column += 1) {
      const survivors: Cell[] = [];
      for (let row = 0; row < rows; row += 1) {
        if (!removed.has(coordKey({ row, column }))) {
          survivors.push(deepClone(board.grid[row][column]));
        }
      }
      const refillCount = rows - survivors.length;
      const queue = nextQueue.values[String(column)];
      if (!queue) {
        throw new Error(`Missing column queue ${column}`);
      }
      const cursor = nextQueue.cursors[String(column)] ?? 0;
      if (cursor + refillCount > queue.length) {
        throw new Error(`Column queue ${column} exhausted at index ${cursor}`);
      }
      const consumed = queue.slice(cursor, cursor + refillCount).map(deepClone);
      nextQueue.cursors[String(column)] = cursor + refillCount;
      const topToBottom = [...consumed].reverse();
      const columnCells = [...topToBottom, ...survivors];
      for (let row = 0; row < rows; row += 1) {
        nextGrid[row][column] = columnCells[row];
      }
      consumed.forEach((_cell, queueOffset) => {
        newCells.push({
          coord: { row: refillCount - 1 - queueOffset, column },
          queueIndex: cursor + queueOffset,
        });
      });
    }
    return {
      board: new BoardModel(nextGrid),
      queueState: nextQueue,
      newCells,
    };
  }
}

export class DeterministicRng {
  public static readonly algorithm = 'xorshift32-v1';
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  public nextUint32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }

  public nextIndex(exclusiveMaximum: number): number {
    if (exclusiveMaximum <= 0) {
      throw new Error('exclusiveMaximum must be positive');
    }
    return this.nextUint32() % exclusiveMaximum;
  }

  public snapshot(): number {
    return this.state;
  }
}

export class DeadBoardDetector {
  public hasLegalPath(
    board: BoardModel,
    directions: 4 | 8,
    minimumLink: number,
  ): boolean {
    const validator = new PathValidator(directions, minimumLink);
    const rows = board.grid.length;
    const columns = board.grid[0].length;
    const search = (path: Coord[]): boolean => {
      if (path.length >= minimumLink) {
        return true;
      }
      const current = path[path.length - 1];
      for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
        for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
          const next = { row: current.row + rowDelta, column: current.column + columnDelta };
          if (
            next.row < 0
            || next.row >= rows
            || next.column < 0
            || next.column >= columns
            || !validator.isAdjacent(current, next)
            || path.some((coord) => coordKey(coord) === coordKey(next))
            || board.get(next).ingredientId !== board.get(current).ingredientId
          ) {
            continue;
          }
          if (search([...path, next])) {
            return true;
          }
        }
      }
      return false;
    };
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (search([{ row, column }])) {
          return true;
        }
      }
    }
    return false;
  }

  public isDead(board: BoardModel, directions: 4 | 8, minimumLink: number): boolean {
    return !this.hasLegalPath(board, directions, minimumLink);
  }
}

export class ShuffleResolver {
  public readonly algorithm = 'fisher-yates-xorshift32-v1';

  public shuffle(
    board: BoardModel,
    gameplay: GameplayConfig,
    rng: DeterministicRng,
  ): BoardModel {
    const detector = new DeadBoardDetector();
    const rows = board.grid.length;
    const columns = board.grid[0].length;
    const original = board.grid.flat().map(deepClone);
    for (let attempt = 0; attempt < gameplay.shuffle.maximumAttempts; attempt += 1) {
      const cells = original.map(deepClone);
      for (let index = cells.length - 1; index > 0; index -= 1) {
        const swapIndex = rng.nextIndex(index + 1);
        [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]];
      }
      const grid = Array.from({ length: rows }, (_unused, row) =>
        cells.slice(row * columns, (row + 1) * columns));
      const candidate = new BoardModel(grid);
      if (detector.hasLegalPath(
        candidate,
        gameplay.board.connectionDirections,
        gameplay.board.minimumLink,
      )) {
        return candidate;
      }
    }
    throw new Error(`Unable to produce a legal shuffle after ${gameplay.shuffle.maximumAttempts} attempts`);
  }
}

export interface ConfigBundle {
  gameplay: GameplayConfig;
  recipes: RecipeConfig[];
  orders: OrderConfig[];
  symbolToIngredient: Map<string, IngredientId>;
}

export const processingLevelFor = (
  gameplay: GameplayConfig,
  pathLength: number,
): ProcessingLevel => {
  if (pathLength >= gameplay.longLink.master) {
    return 'MASTER';
  }
  if (pathLength >= gameplay.longLink.inspiration) {
    return 'INSPIRATION';
  }
  if (pathLength >= gameplay.longLink.precise) {
    return 'PRECISE';
  }
  return 'NORMAL';
};

export const comboMultiplierFor = (
  gameplay: GameplayConfig,
  comboCount: number,
): number => {
  const tier = gameplay.combo.tiers.find((candidate) =>
    comboCount >= candidate.minimumCount
    && (candidate.maximumCount === null || comboCount <= candidate.maximumCount));
  if (!tier) {
    throw new Error(`No combo multiplier configured for count ${comboCount}`);
  }
  return tier.multiplier;
};

export const calculateLinkScore = (
  gameplay: GameplayConfig,
  pathLength: number,
  containsInspiration: boolean,
  comboCount: number,
): number => {
  const lengthReward = gameplay.linkScore.lengthRewards.find((candidate) =>
    pathLength >= candidate.minimumLength
    && (candidate.maximumLength === null || pathLength <= candidate.maximumLength));
  if (!lengthReward) {
    throw new Error(`No length reward configured for path length ${pathLength}`);
  }
  const specialBonus = containsInspiration
    ? gameplay.inspiration.collectedScoreBonus
    : 0;
  return Math.round((
    pathLength * gameplay.linkScore.pointsPerCell
    + lengthReward.bonus
    + specialBonus
  ) * comboMultiplierFor(gameplay, comboCount));
};

export class PotModel {
  public units: IngredientUnits = {};
  public throws: ThrowRecord[] = [];
  public tags = new Set<'INSPIRATION' | 'MASTER'>();

  public constructor(private readonly gameplay: GameplayConfig) {}

  public addThrow(cells: Cell[], comboCount: number): ThrowRecord {
    if (this.isFull()) {
      throw new Error('Pot is already at maximum capacity');
    }
    if (cells.length < this.gameplay.board.minimumLink) {
      throw new Error('Cannot add an invalid short link to the pot');
    }
    const ingredientId = cells[0].ingredientId;
    if (cells.some((cell) => cell.ingredientId !== ingredientId)) {
      throw new Error('A throw must contain one ingredient type');
    }
    const containsInspiration = cells.some((cell) => cell.inspiration);
    const processingLevel = processingLevelFor(this.gameplay, cells.length);
    let processingScore = this.gameplay.longLink.processingScores[processingLevel];
    if (containsInspiration) {
      processingScore = Math.min(
        this.gameplay.inspiration.processingMaximum,
        processingScore + this.gameplay.inspiration.processingBonus,
      );
      this.tags.add('INSPIRATION');
    }
    if (processingLevel === 'MASTER') {
      this.tags.add('MASTER');
    }
    const record: ThrowRecord = {
      ingredientId,
      pathLength: cells.length,
      units: 1,
      processingLevel,
      processingScore,
      containsInspiration,
      linkScore: calculateLinkScore(
        this.gameplay,
        cells.length,
        containsInspiration,
        comboCount,
      ),
      comboCount,
      comboMultiplier: comboMultiplierFor(this.gameplay, comboCount),
      audioEvent: this.gameplay.longLink.audioEvents[processingLevel],
    };
    this.throws.push(record);
    this.units[ingredientId] = (this.units[ingredientId] ?? 0) + 1;
    return record;
  }

  public canFire(): boolean {
    return this.throws.length >= this.gameplay.pot.minimumUnitsToCook;
  }

  public isFull(): boolean {
    return this.throws.length >= this.gameplay.pot.maximumUnits;
  }

  public processingQuality(): number {
    if (this.throws.length === 0) {
      return 0;
    }
    return this.throws.reduce((sum, record) => sum + record.processingScore, 0)
      / this.throws.length;
  }

  public clear(): void {
    this.units = {};
    this.throws = [];
    this.tags.clear();
  }

  public snapshot(): {
    units: IngredientUnits;
    throws: ThrowRecord[];
    tags: Array<'INSPIRATION' | 'MASTER'>;
  } {
    return {
      units: deepClone(this.units),
      throws: deepClone(this.throws),
      tags: [...this.tags].sort(),
    };
  }
}

export class RecipeResolver {
  public constructor(private readonly recipes: RecipeConfig[]) {}

  public matchingExplicit(
    units: IngredientUnits,
    tags: Iterable<'INSPIRATION' | 'MASTER'>,
  ): RecipeConfig[] {
    const tagSet = new Set(tags);
    return this.recipes
      .filter((recipe) => !recipe.fallback)
      .filter((recipe) => {
        const requiredEntries = Object.entries(recipe.required) as [IngredientId, number][];
        if (requiredEntries.some(([ingredientId, required]) =>
          (units[ingredientId] ?? 0) !== required)) {
          return false;
        }
        const requiredIds = new Set(requiredEntries.map(([ingredientId]) => ingredientId));
        const hasUnexpectedIngredient = (Object.entries(units) as [IngredientId, number][])
          .some(([ingredientId, amount]) => amount > 0 && !requiredIds.has(ingredientId));
        if (hasUnexpectedIngredient) {
          return false;
        }
        return recipe.requiredConditions.every((condition) => tagSet.has(condition));
      })
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  }

  public resolve(
    units: IngredientUnits,
    tags: Iterable<'INSPIRATION' | 'MASTER'>,
  ): RecipeConfig {
    const matches = this.matchingExplicit(units, tags);
    if (matches.length > 0) {
      return matches[0];
    }
    const fallback = this.recipes.filter((recipe) => recipe.fallback);
    if (fallback.length !== 1) {
      throw new Error(`Expected exactly one fallback recipe, found ${fallback.length}`);
    }
    return fallback[0];
  }
}

export interface StarResult {
  stars: number;
  qualityScore: number;
  recipeAccuracyScore: number;
  processingScore: number;
}

export class StarCalculator {
  public constructor(private readonly gameplay: GameplayConfig) {}

  public calculate(recipe: RecipeConfig, processingScore: number): StarResult {
    const recipeAccuracyScore = recipe.fallback
      ? this.gameplay.star.recipeAccuracy.fallback
      : this.gameplay.star.recipeAccuracy.explicit;
    let qualityScore = recipeAccuracyScore * this.gameplay.star.weights.accuracy
      + processingScore * this.gameplay.star.weights.processing;
    if (recipe.fallback) {
      qualityScore = Math.min(qualityScore, this.gameplay.star.fallbackMaximumScore);
    }
    let stars = qualityScore >= this.gameplay.star.thresholds.three
      ? 3
      : qualityScore >= this.gameplay.star.thresholds.two
        ? 2
        : 1;
    if (recipe.fallback) {
      stars = Math.min(stars, this.gameplay.star.fallbackMaximumStars);
    }
    return { stars, qualityScore, recipeAccuracyScore, processingScore };
  }
}

const emptyCookingHistory = (): CookingHistoryState => ({
  discoveredRecipeIds: [],
  sessionCookCounts: {},
  historicalCookCounts: {},
  bestStarsByRecipe: {},
  bestDishScoreByRecipe: {},
  processedCookResultIds: [],
});

export class CookingHistoryModel {
  public readonly state: CookingHistoryState;

  public constructor(
    state: CookingHistoryState = emptyCookingHistory(),
    private readonly processedIdLimit = 128,
  ) {
    this.state = deepClone(state);
  }

  public isDiscovered(recipeId: RecipeId): boolean {
    return this.state.discoveredRecipeIds.includes(recipeId);
  }

  public record(result: CookResult): boolean {
    if (this.state.processedCookResultIds.includes(result.cookResultId)) {
      return false;
    }
    this.state.processedCookResultIds.push(result.cookResultId);
    if (this.state.processedCookResultIds.length > this.processedIdLimit) {
      this.state.processedCookResultIds.splice(
        0,
        this.state.processedCookResultIds.length - this.processedIdLimit,
      );
    }
    if (!this.state.discoveredRecipeIds.includes(result.recipeId)) {
      this.state.discoveredRecipeIds.push(result.recipeId);
      this.state.discoveredRecipeIds.sort();
    }
    this.state.sessionCookCounts[result.recipeId] =
      (this.state.sessionCookCounts[result.recipeId] ?? 0) + 1;
    this.state.historicalCookCounts[result.recipeId] =
      (this.state.historicalCookCounts[result.recipeId] ?? 0) + 1;
    this.state.bestStarsByRecipe[result.recipeId] = Math.max(
      this.state.bestStarsByRecipe[result.recipeId] ?? 0,
      result.stars,
    );
    this.state.bestDishScoreByRecipe[result.recipeId] = Math.max(
      this.state.bestDishScoreByRecipe[result.recipeId] ?? 0,
      result.dishScore,
    );
    return true;
  }

  public snapshot(): CookingHistoryState {
    return deepClone(this.state);
  }
}

const ALL_RECIPE_IDS: RecipeId[] = [
  'RCP_TOMATO_EGG',
  'RCP_SCALLION_POTATO_CAKE',
  'RCP_GARDEN_MUSHROOM_SOUP',
  'RCP_WARM_HOTPOT_MIX',
  'RCP_CHARRED_TOMATO_POTATO_BALL',
  'RCP_STAR_MUSHROOM_EGG_CUP',
];

export const migrateSaveV1ToV2 = (source: SaveDataV1): SaveDataV2 => {
  if (!source || source.schemaVersion !== 1) {
    throw new Error('v1 save migration requires schemaVersion 1');
  }
  const discoveredRecipeIds = [...new Set((source.discoveredRecipeIds ?? [])
    .filter((id): id is RecipeId => ALL_RECIPE_IDS.includes(id)))].sort();
  const bestStarsByRecipe: Partial<Record<RecipeId, number>> = {};
  for (const [recipeId, stars] of Object.entries(source.bestStarsByRecipe ?? {})) {
    if (ALL_RECIPE_IDS.includes(recipeId as RecipeId)
      && typeof stars === 'number'
      && Number.isInteger(stars)
      && stars >= 1
      && stars <= 3) {
      bestStarsByRecipe[recipeId as RecipeId] = stars;
    }
  }
  const firstResearchRecordIds = [...new Set((source.firstResearchRecordIds ?? [])
    .filter((id): id is RecipeId => ALL_RECIPE_IDS.includes(id)))].sort();
  return {
    schemaVersion: 2,
    discoveredRecipeIds,
    historicalCookCounts: Object.fromEntries(
      ALL_RECIPE_IDS.map((recipeId) => [recipeId, 0]),
    ),
    bestStarsByRecipe,
    bestDishScoreByRecipe: Object.fromEntries(
      ALL_RECIPE_IDS.map((recipeId) => [recipeId, 0]),
    ),
    firstResearchRecordIds,
    tutorialFlags: { inspirationHintShown: false },
    settings: {
      musicEnabled: source.settings?.musicEnabled ?? true,
      sfxEnabled: source.settings?.sfxEnabled ?? true,
      voiceEnabled: true,
    },
    processedCookResultIds: [],
  };
};

export interface SessionSnapshot {
  scenarioId: string;
  caseId: string;
  phase: SessionPhase;
  remainingActiveTimeMs: number;
  activeTimeElapsedMs: number;
  graceRemainingMs: number;
  board: BoardGrid;
  boardHash: string;
  queueCursors: Record<string, number>;
  pot: ReturnType<PotModel['snapshot']>;
  comboCount: number;
  totalScore: number;
  linkScore: number;
  dishScore: number;
  researchClueIndex: number;
  currentResearchClueId?: string;
  cookResults: CookResult[];
  partialResultCount: number;
  history: CookingHistoryState;
  eventLog: string[];
  rngState: number;
}

export interface LinkCommitResult {
  committed: boolean;
  reason?: string;
  throwRecord?: ThrowRecord;
  inspirationCoord?: Coord;
}

const spawnInspiration = (
  resolution: BoardResolution,
  pathEnd: Coord,
  ingredientId: IngredientId,
): Coord => {
  const preferred = resolution.newCells.find((entry) => entry.coord.column === pathEnd.column);
  const fallback = [...resolution.newCells].sort(
    (left, right) => left.coord.column - right.coord.column || left.coord.row - right.coord.row,
  )[0];
  const target = preferred ?? fallback;
  if (!target) {
    throw new Error('Inspiration spawn requires at least one newly refilled cell');
  }
  resolution.board.grid[target.coord.row][target.coord.column] = {
    ingredientId,
    inspiration: true,
  };
  return target.coord;
};

export class TimedResearchSession {
  public board: BoardModel;
  public readonly pot: PotModel;
  public phase: SessionPhase = 'READY';
  public remainingActiveTimeMs: number;
  public activeTimeElapsedMs = 0;
  public graceRemainingMs = 0;
  public comboCount = 0;
  public totalScore = 0;
  public linkScore = 0;
  public dishScore = 0;
  public researchClueIndex = 0;
  public readonly cookResults: CookResult[] = [];
  public partialResultCount = 0;
  public readonly eventLog: string[] = [];
  public queueState: QueueState;
  public readonly rng: DeterministicRng;
  public readonly history: CookingHistoryModel;

  private readonly pathValidator: PathValidator;
  private readonly boardResolver = new BoardResolver();
  private readonly recipeResolver: RecipeResolver;
  private readonly starCalculator: StarCalculator;
  private lastLegalLinkAtMs?: number;
  private cookCounter = 0;

  public constructor(
    private readonly config: ConfigBundle,
    public readonly scenarioId: string,
    public readonly caseId: string,
    initialBoard: string[][],
    columnQueues: Record<string, string[]>,
    public readonly researchClueQueue: string[],
    seed: number,
    history?: CookingHistoryModel,
  ) {
    this.board = new BoardModel(initialBoard.map((row) =>
      row.map((symbol) => this.cellForSymbol(symbol))));
    this.queueState = {
      values: Object.fromEntries(Object.entries(columnQueues).map(([column, queue]) => [
        column,
        queue.map((symbol) => this.cellForSymbol(symbol)),
      ])),
      cursors: Object.fromEntries(Array.from(
        { length: config.gameplay.board.columns },
        (_unused, column) => [String(column), 0],
      )),
    };
    this.remainingActiveTimeMs = config.gameplay.session.activeTimeMs;
    this.pot = new PotModel(config.gameplay);
    this.pathValidator = new PathValidator(
      config.gameplay.board.connectionDirections,
      config.gameplay.board.minimumLink,
    );
    this.recipeResolver = new RecipeResolver(config.recipes);
    this.starCalculator = new StarCalculator(config.gameplay);
    this.rng = new DeterministicRng(seed);
    this.history = history ?? new CookingHistoryModel(
      undefined,
      config.gameplay.history.processedCookResultLimit,
    );
  }

  private cellForSymbol(symbolWithMarker: string): Cell {
    const symbol = symbolWithMarker.replace('*', '');
    const ingredientId = this.config.symbolToIngredient.get(symbol);
    if (!ingredientId) {
      throw new Error(`Unknown ingredient symbol ${symbolWithMarker}`);
    }
    return {
      ingredientId,
      inspiration: symbolWithMarker.endsWith('*'),
    };
  }

  public beginLink(): boolean {
    if (this.phase !== 'READY') {
      return false;
    }
    this.phase = 'LINKING';
    return true;
  }

  public cancelLink(): void {
    if (this.phase === 'LINKING' || this.phase === 'TIMEOUT_GRACE') {
      this.phase = this.remainingActiveTimeMs > 0 ? 'READY' : 'SUMMARY';
      if (this.remainingActiveTimeMs === 0) {
        this.resolveTimeExpired();
      }
    }
  }

  public advanceActiveTime(milliseconds: number): number {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new Error('Active time advance must be a non-negative finite number');
    }
    if (this.phase !== 'READY' && this.phase !== 'LINKING') {
      return 0;
    }
    const consumed = Math.min(milliseconds, this.remainingActiveTimeMs);
    this.remainingActiveTimeMs -= consumed;
    this.activeTimeElapsedMs += consumed;
    if (this.remainingActiveTimeMs === 0) {
      if (this.phase === 'LINKING') {
        this.phase = 'TIMEOUT_GRACE';
        this.graceRemainingMs = this.config.gameplay.session.linkingGraceMs;
        this.eventLog.push('LINK_TIMEOUT_GRACE_STARTED');
      } else {
        this.resolveTimeExpired();
      }
    }
    return consumed;
  }

  public advanceGraceTime(milliseconds: number): number {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new Error('Grace time advance must be a non-negative finite number');
    }
    if (this.phase !== 'TIMEOUT_GRACE') {
      return 0;
    }
    const consumed = Math.min(milliseconds, this.graceRemainingMs);
    this.graceRemainingMs -= consumed;
    if (this.graceRemainingMs === 0) {
      this.eventLog.push('LINK_TIMEOUT_GRACE_EXPIRED');
      this.resolveTimeExpired();
    }
    return consumed;
  }

  public commitLink(path: Coord[]): LinkCommitResult {
    if (!['READY', 'LINKING', 'TIMEOUT_GRACE'].includes(this.phase)) {
      throw new Error(`Cannot link while phase is ${this.phase}`);
    }
    const validation = this.pathValidator.validate(this.board, path);
    if (!validation.valid) {
      if (this.phase === 'TIMEOUT_GRACE') {
        this.resolveTimeExpired();
      } else if (this.phase === 'LINKING') {
        this.phase = 'READY';
      }
      return { committed: false, reason: validation.reason };
    }
    if (this.remainingActiveTimeMs === 0 && this.phase !== 'TIMEOUT_GRACE') {
      return { committed: false, reason: 'Active time has expired' };
    }
    if (this.pot.isFull()) {
      return { committed: false, reason: 'Pot is full' };
    }
    const pathCells = path.map((coord) => deepClone(this.board.get(coord)));
    const nextCombo = this.lastLegalLinkAtMs !== undefined
      && this.activeTimeElapsedMs - this.lastLegalLinkAtMs <= this.config.gameplay.combo.windowMs
      ? this.comboCount + 1
      : 1;
    this.comboCount = nextCombo;
    this.lastLegalLinkAtMs = this.activeTimeElapsedMs;
    const throwRecord = this.pot.addThrow(pathCells, this.comboCount);
    this.linkScore += throwRecord.linkScore;
    this.totalScore += throwRecord.linkScore;
    if (throwRecord.audioEvent) {
      this.eventLog.push(throwRecord.audioEvent);
    }
    const resolution = this.boardResolver.resolve(this.board, path, this.queueState);
    this.board = resolution.board;
    this.queueState = resolution.queueState;
    let inspirationCoord: Coord | undefined;
    if (
      path.length >= this.config.gameplay.longLink.inspiration
      && path.length < this.config.gameplay.longLink.master
    ) {
      inspirationCoord = spawnInspiration(
        resolution,
        path[path.length - 1],
        pathCells[0].ingredientId,
      );
      this.eventLog.push('INSPIRATION_SPAWNED');
    }
    this.phase = 'ANIMATING';
    this.graceRemainingMs = 0;
    return { committed: true, throwRecord, inspirationCoord };
  }

  public completeAnimation(): SessionPhase {
    if (this.phase !== 'ANIMATING') {
      throw new Error(`Cannot complete animation from ${this.phase}`);
    }
    if (this.pot.isFull()) {
      this.phase = 'AUTO_FIRE_READY';
      this.eventLog.push('POT_FULL_AUTO_FIRE_READY');
    } else if (this.remainingActiveTimeMs === 0) {
      this.resolveTimeExpired();
    } else {
      this.phase = 'READY';
    }
    return this.phase;
  }

  public fire(): CookResult {
    if (this.phase !== 'READY' || !this.pot.canFire()) {
      throw new Error(`Manual fire is unavailable in phase ${this.phase}`);
    }
    return this.settleCook('MANUAL');
  }

  public confirmAutoFire(): CookResult {
    if (this.phase !== 'AUTO_FIRE_READY') {
      throw new Error(`Auto fire confirmation is unavailable in phase ${this.phase}`);
    }
    return this.settleCook('AUTO');
  }

  private settleCook(mode: 'MANUAL' | 'AUTO'): CookResult {
    if (!this.pot.canFire()) {
      throw new Error('At least four units are required before cooking');
    }
    this.phase = 'COOKING';
    const recipe = this.recipeResolver.resolve(this.pot.units, this.pot.tags);
    const star = this.starCalculator.calculate(recipe, this.pot.processingQuality());
    const clueId = this.researchClueQueue[this.researchClueIndex % this.researchClueQueue.length];
    const order = this.config.orders.find((candidate) =>
      candidate.clues.some((clue) => clue.id === clueId));
    const clue = order?.clues.find((candidate) => candidate.id === clueId);
    const matchedResearchClue = clue?.recipeId === recipe.id;
    const isNewDiscovery = !this.history.isDiscovered(recipe.id);
    const dishScore = this.config.gameplay.dishScore.rarityBase[recipe.rarity]
      + (recipe.tags.includes('DARK') ? this.config.gameplay.dishScore.darkTagBonus : 0)
      + star.stars * this.config.gameplay.dishScore.perStar
      + (isNewDiscovery ? this.config.gameplay.dishScore.firstDiscovery : 0)
      + (matchedResearchClue ? this.config.gameplay.dishScore.researchClueMatch : 0);
    const result: CookResult = {
      cookResultId: `${this.scenarioId}:${this.caseId}:cook:${++this.cookCounter}`,
      recipeId: recipe.id,
      stars: star.stars,
      qualityScore: star.qualityScore,
      dishScore,
      isNewDiscovery,
      matchedResearchClue,
      tags: [...recipe.tags].sort(),
    };
    this.history.record(result);
    this.cookResults.push(deepClone(result));
    this.dishScore += dishScore;
    this.totalScore += dishScore;
    this.eventLog.push(mode === 'AUTO' ? 'AUTO_FIRE_SETTLED' : 'MANUAL_FIRE_SETTLED');
    this.phase = 'REVEAL';
    return deepClone(result);
  }

  public completeReveal(): void {
    if (this.phase !== 'REVEAL') {
      throw new Error(`Cannot complete reveal from ${this.phase}`);
    }
    this.pot.clear();
    this.researchClueIndex += 1;
    if (this.remainingActiveTimeMs === 0) {
      this.resolveTimeExpired();
    } else {
      this.phase = 'READY';
    }
  }

  private resolveTimeExpired(): void {
    this.graceRemainingMs = 0;
    if (this.pot.canFire()) {
      this.phase = 'AUTO_FIRE_READY';
      this.eventLog.push('TIME_EXPIRED_AUTO_FIRE_READY');
      return;
    }
    if (this.pot.throws.length > 0) {
      this.partialResultCount += 1;
      this.eventLog.push('RESEARCH_PARTIAL_RESULT');
      this.phase = 'PARTIAL_RESULT';
      return;
    }
    this.phase = 'SUMMARY';
    this.eventLog.push('SESSION_SUMMARY_READY');
  }

  public completePartialResult(): void {
    if (this.phase !== 'PARTIAL_RESULT') {
      throw new Error(`Cannot complete partial result from ${this.phase}`);
    }
    this.pot.clear();
    this.phase = 'SUMMARY';
    this.eventLog.push('SESSION_SUMMARY_READY');
  }

  public snapshot(): SessionSnapshot {
    const board = deepClone(this.board.grid);
    return {
      scenarioId: this.scenarioId,
      caseId: this.caseId,
      phase: this.phase,
      remainingActiveTimeMs: this.remainingActiveTimeMs,
      activeTimeElapsedMs: this.activeTimeElapsedMs,
      graceRemainingMs: this.graceRemainingMs,
      board,
      boardHash: stableHash(board),
      queueCursors: deepClone(this.queueState.cursors),
      pot: this.pot.snapshot(),
      comboCount: this.comboCount,
      totalScore: this.totalScore,
      linkScore: this.linkScore,
      dishScore: this.dishScore,
      researchClueIndex: this.researchClueIndex,
      currentResearchClueId:
        this.researchClueQueue[this.researchClueIndex % this.researchClueQueue.length],
      cookResults: deepClone(this.cookResults),
      partialResultCount: this.partialResultCount,
      history: this.history.snapshot(),
      eventLog: [...this.eventLog],
      rngState: this.rng.snapshot(),
    };
  }

  public hash(): string {
    return stableHash(this.snapshot());
  }
}
