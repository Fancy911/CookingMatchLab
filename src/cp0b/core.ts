import {
  type BoardGrid,
  type Cell,
  type Coord,
  type DiscoveryState,
  type FireResult,
  type GameplayConfig,
  type IngredientId,
  type IngredientUnits,
  type OrderConfig,
  type OrderResult,
  type ProcessingTag,
  type RecipeConfig,
  type RecipeId,
  type ThrowRecord,
} from './types.js';
import { deepClone, stableHash } from './stable.js';

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

export class InspirationResolver {
  public constructor(private readonly gameplay: GameplayConfig) {}

  public tagsForPath(pathLength: number): ProcessingTag[] {
    const tags: ProcessingTag[] = [];
    if (pathLength >= this.gameplay.longLink.fine) {
      tags.push('FINE');
    }
    if (pathLength >= this.gameplay.longLink.inspiration) {
      tags.push('LONG_INSPIRATION');
    }
    if (pathLength >= this.gameplay.longLink.master) {
      tags.push('MASTER');
    }
    return tags;
  }

  public shouldSpawn(pathLength: number): boolean {
    return pathLength >= this.gameplay.longLink.inspiration;
  }

  public spawn(
    resolution: BoardResolution,
    pathEnd: Coord,
    ingredientId: IngredientId,
  ): Coord {
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
  }
}

export class PotModel {
  public units: IngredientUnits = {};
  public throws: ThrowRecord[] = [];
  public tags = new Set<ProcessingTag>();

  public constructor(
    private readonly gameplay: GameplayConfig,
    private readonly normalUnitValueById: Record<IngredientId, number>,
  ) {}

  public addThrow(cells: Cell[]): ThrowRecord {
    if (this.throws.length >= this.gameplay.pot.baseSlots) {
      throw new Error('All base throw slots are occupied');
    }
    if (cells.length === 0) {
      throw new Error('Cannot add an empty throw');
    }
    const ingredientId = cells[0].ingredientId;
    const containsInspiration = cells.some((cell) => cell.inspiration);
    const units = cells.reduce(
      (total, cell) => total + (
        cell.inspiration
          ? this.gameplay.inspiration.unitValue
          : this.normalUnitValueById[cell.ingredientId]
      ),
      0,
    );
    let processingScore = this.gameplay.star.processingScores.normal;
    if (cells.length >= this.gameplay.longLink.master) {
      processingScore = this.gameplay.star.processingScores.master;
    } else if (cells.length >= this.gameplay.longLink.inspiration) {
      processingScore = this.gameplay.star.processingScores.inspiration;
    } else if (cells.length >= this.gameplay.longLink.fine) {
      processingScore = this.gameplay.star.processingScores.fine;
    }
    if (containsInspiration) {
      processingScore = Math.min(
        this.gameplay.star.processingScores.maximum,
        processingScore + this.gameplay.star.processingScores.inspirationBonus,
      );
      this.tags.add('INSPIRATION');
    }
    new InspirationResolver(this.gameplay).tagsForPath(cells.length).forEach((tag) => this.tags.add(tag));
    const record: ThrowRecord = {
      ingredientId,
      pathLength: cells.length,
      units,
      processingScore,
      containsInspiration,
    };
    this.throws.push(record);
    this.units[ingredientId] = (this.units[ingredientId] ?? 0) + units;
    return record;
  }

  public canFire(): boolean {
    return this.throws.length >= this.gameplay.pot.minimumThrowsToCook;
  }

  public isFull(): boolean {
    return this.throws.length >= this.gameplay.pot.baseSlots;
  }

  public processingQuality(): number {
    if (this.throws.length === 0) {
      return 0;
    }
    return this.throws.reduce((total, current) => total + current.processingScore, 0)
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
    tags: ProcessingTag[];
  } {
    return {
      units: deepClone(this.units),
      throws: deepClone(this.throws),
      tags: [...this.tags].sort(),
    };
  }
}

const unitsFor = (units: IngredientUnits, ids: IngredientId[]): number =>
  ids.reduce((total, id) => total + (units[id] ?? 0), 0);

export class RecipeResolver {
  public constructor(private readonly recipes: RecipeConfig[]) {}

  public matchingExplicit(units: IngredientUnits, tags: Iterable<ProcessingTag>): RecipeConfig[] {
    const tagSet = new Set(tags);
    return this.recipes
      .filter((recipe) => !recipe.fallback)
      .filter((recipe) => {
        for (const [id, range] of Object.entries(recipe.required) as [IngredientId, NonNullable<RecipeConfig['required'][IngredientId]>][]) {
          const actual = units[id] ?? 0;
          if (actual < range.min || actual > range.max) {
            return false;
          }
        }
        if (recipe.forbidden.some((id) => (units[id] ?? 0) > 0)) {
          return false;
        }
        if (recipe.requiredConditions.some((condition) => !tagSet.has(condition))) {
          return false;
        }
        return recipe.ratios.every((ratio) => {
          const denominator = unitsFor(units, ratio.denominator);
          if (denominator <= 0) {
            return false;
          }
          const value = unitsFor(units, ratio.numerator) / denominator;
          return value >= ratio.accepted[0] && value <= ratio.accepted[1];
        });
      })
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  }

  public resolve(units: IngredientUnits, tags: Iterable<ProcessingTag>): RecipeConfig {
    const explicit = this.matchingExplicit(units, tags);
    if (explicit.length > 0) {
      return explicit[0];
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
  totalScore: number;
  recipeScore: number;
  processingScore: number;
  efficiencyScore: number;
}

export class StarCalculator {
  public constructor(private readonly gameplay: GameplayConfig) {}

  public calculate(
    recipe: RecipeConfig,
    units: IngredientUnits,
    processingScore: number,
    remainingSteps: number,
    order: Pick<OrderConfig, 'highEfficiencySteps' | 'passEfficiencySteps'>,
  ): StarResult {
    let recipeScore = 50;
    if (!recipe.fallback) {
      const deviation = (Object.entries(recipe.required) as [IngredientId, NonNullable<RecipeConfig['required'][IngredientId]>][])
        .reduce((sum, [id, range]) => sum + Math.abs((units[id] ?? 0) - range.ideal), 0);
      const quantityScore = Math.max(
        0,
        100 - this.gameplay.star.quantityDeviationFactor * deviation,
      );
      const ratioScore = recipe.ratios.every((ratio) => {
        const value = unitsFor(units, ratio.numerator) / unitsFor(units, ratio.denominator);
        return value >= ratio.ideal[0] && value <= ratio.ideal[1];
      }) ? 100 : 80;
      recipeScore = quantityScore * this.gameplay.star.recipeWeights.quantity
        + ratioScore * this.gameplay.star.recipeWeights.ratio;
    }
    const efficiencyScore = remainingSteps >= order.highEfficiencySteps
      ? this.gameplay.star.efficiencyScores.high
      : remainingSteps >= order.passEfficiencySteps
        ? this.gameplay.star.efficiencyScores.pass
        : this.gameplay.star.efficiencyScores.low;
    const totalScore = recipeScore * this.gameplay.star.weights.recipe
      + processingScore * this.gameplay.star.weights.processing
      + efficiencyScore * this.gameplay.star.weights.efficiency;
    const stars = totalScore >= this.gameplay.star.thresholds.three
      ? 3
      : totalScore >= this.gameplay.star.thresholds.two
        ? 2
        : 1;
    return {
      stars,
      totalScore,
      recipeScore,
      processingScore,
      efficiencyScore,
    };
  }
}

export class OrderResolver {
  public resolve(recipeId: RecipeId, order: OrderConfig, remainingSteps: number): OrderResult {
    if (recipeId === order.targetRecipeId) {
      return 'SUCCESS';
    }
    return remainingSteps > 0 ? 'CONTINUE_AFTER_REVEAL' : 'NOT_COMPLETED';
  }
}

export class DiscoveryModel {
  public constructor(public readonly state: DiscoveryState = {
    tutorialFlags: { inspirationUnitHintShown: false },
    discoveredRecipeIds: [],
    bestStarsByRecipe: {},
    firstResearchRecordIds: [],
  }) {}

  public recordRecipe(recipeId: RecipeId, stars: number): boolean {
    const isNew = !this.state.discoveredRecipeIds.includes(recipeId);
    if (isNew) {
      this.state.discoveredRecipeIds.push(recipeId);
      this.state.discoveredRecipeIds.sort();
      this.state.firstResearchRecordIds.push(recipeId);
      this.state.firstResearchRecordIds.sort();
    }
    this.state.bestStarsByRecipe[recipeId] = Math.max(
      this.state.bestStarsByRecipe[recipeId] ?? 0,
      stars,
    );
    return isNew;
  }

  public showInspirationHintOnce(): boolean {
    if (this.state.tutorialFlags.inspirationUnitHintShown) {
      return false;
    }
    this.state.tutorialFlags.inspirationUnitHintShown = true;
    return true;
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

export interface RunSnapshotData {
  remainingSteps: number;
  board: BoardGrid;
  boardHash: string;
  pot: ReturnType<PotModel['snapshot']>;
  queueCursors: Record<string, number>;
  orderResult: OrderResult;
  discovery: DiscoveryState;
}

export class RunSnapshot {
  public static create(data: Omit<RunSnapshotData, 'boardHash'>): RunSnapshotData {
    const snapshot = deepClone(data) as RunSnapshotData;
    snapshot.boardHash = stableHash(snapshot.board);
    return snapshot;
  }

  public static hash(snapshot: RunSnapshotData): string {
    return stableHash(snapshot);
  }
}

export function settleFire(
  recipeResolver: RecipeResolver,
  starCalculator: StarCalculator,
  orderResolver: OrderResolver,
  discovery: DiscoveryModel,
  pot: PotModel,
  order: OrderConfig,
  remainingSteps: number,
): FireResult {
  if (!pot.canFire()) {
    throw new Error('At least two throws are required before cooking');
  }
  const recipe = recipeResolver.resolve(pot.units, pot.tags);
  const score = starCalculator.calculate(
    recipe,
    pot.units,
    pot.processingQuality(),
    remainingSteps,
    order,
  );
  const orderResult = orderResolver.resolve(recipe.id, order, remainingSteps);
  const isNewDiscovery = discovery.recordRecipe(recipe.id, score.stars);
  return {
    recipeId: recipe.id,
    stars: score.stars,
    score: score.totalScore,
    orderResult,
    isNewDiscovery,
  };
}
