import {
  CookingHistoryModel,
  PathEditor,
  PathValidator,
  TimedResearchSession,
  type SessionSnapshot,
} from '../../domain/cp0b/core';
import { deepClone, stableHash } from '../../domain/cp0b/stable';
import type {
  AudioEvent,
  BoardGrid,
  CookResult,
  Coord,
  IngredientId,
  ProcessingLevel,
  RecipeId,
  SessionPhase,
  ThrowRecord,
} from '../../domain/cp0b/types';
import type { ConfigRegistry } from '../cp0c/ConfigRegistry';
import type {
  BoardMove,
  EffectPlan,
  RefillMove,
} from '../cp0c/EffectPlan';
import type {
  ClockPort,
  ResolvedResearchMenu,
  ResearchSchedulePort,
} from './ResearchPorts';

export interface ResearchClueViewModel {
  id: string;
  text: string;
  recipeId: RecipeId;
  ingredientHints: Array<{
    ingredientId: IngredientId;
    units: number;
  }>;
}

export interface CookPresentation {
  operationId: string;
  result: CookResult;
  recipeName: string;
  recipeId: RecipeId;
  quick: boolean;
  sessionCookCount: number;
}

export interface ResearchSummaryViewModel {
  totalScore: number;
  formalDishCount: number;
  recipeCounts: Partial<Record<RecipeId, number>>;
  newDiscoveries: RecipeId[];
  longestLink: number;
  highestComboMultiplier: number;
}

export interface BattleViewModel {
  menu: ResolvedResearchMenu;
  phase: SessionPhase;
  board: BoardGrid;
  boardHash: string;
  remainingActiveTimeMs: number;
  timerText: string;
  timerWarning: boolean;
  totalScore: number;
  comboCount: number;
  comboMultiplier: number;
  clue: ResearchClueViewModel;
  throwRecords: ThrowRecord[];
  canFire: boolean;
  potFull: boolean;
  activePath: Coord[];
  cooking?: CookPresentation;
  partialUnits: number;
  summary: ResearchSummaryViewModel;
}

export interface LinkSubmission {
  accepted: boolean;
  reason?: string;
  plan?: EffectPlan;
}

const coordKey = ({ row, column }: Coord): string => `${row}:${column}`;

const formatTimer = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const comboMultiplierFor = (registry: ConfigRegistry, comboCount: number): number =>
  registry.gameplay.combo.tiers.find((tier) =>
    comboCount >= tier.minimumCount
    && (tier.maximumCount === null || comboCount <= tier.maximumCount))
    ?.multiplier ?? 1;

const deriveMoves = (
  before: BoardGrid,
  path: Coord[],
  beforeCursors: Record<string, number>,
  afterCursors: Record<string, number>,
): { survivorMoves: BoardMove[]; refillMoves: RefillMove[] } => {
  const removed = new Set(path.map(coordKey));
  const survivorMoves: BoardMove[] = [];
  const refillMoves: RefillMove[] = [];
  const rows = before.length;
  const columns = before[0].length;

  for (let column = 0; column < columns; column += 1) {
    const survivors: number[] = [];
    for (let row = 0; row < rows; row += 1) {
      if (!removed.has(coordKey({ row, column }))) {
        survivors.push(row);
      }
    }
    const refillCount = rows - survivors.length;
    survivors.forEach((sourceRow, index) => {
      const targetRow = refillCount + index;
      if (sourceRow !== targetRow) {
        survivorMoves.push({
          from: { row: sourceRow, column },
          to: { row: targetRow, column },
        });
      }
    });
    const firstQueueIndex = beforeCursors[String(column)] ?? 0;
    const consumed = (afterCursors[String(column)] ?? firstQueueIndex) - firstQueueIndex;
    for (let offset = 0; offset < consumed; offset += 1) {
      refillMoves.push({
        queueIndex: firstQueueIndex + offset,
        from: { row: -1, column },
        to: { row: consumed - 1 - offset, column },
      });
    }
  }
  return { survivorMoves, refillMoves };
};

export class ResearchGameplaySession {
  public readonly menu: ResolvedResearchMenu;
  private domain: TimedResearchSession;
  private editor?: PathEditor;
  private operationCounter = 0;
  private activeAnimationOperationId?: string;
  private pendingAnimationOperationId?: string;
  private pendingCookingOperationId?: string;
  private cooking?: CookPresentation;
  private paused = false;
  private longestLink = 0;
  private highestComboMultiplier = 1;
  private readonly completedAnimationOperations = new Set<string>();
  private readonly completedCookingOperations = new Set<string>();
  private readonly completedRevealResults = new Set<string>();

  public constructor(
    public readonly registry: ConfigRegistry,
    schedule: ResearchSchedulePort,
    clock: ClockPort,
    forcedMenuId?: string,
  ) {
    this.menu = schedule.resolveMenu({
      nowEpochMs: clock.nowEpochMs(),
      forcedMenuId,
    });
    this.domain = this.createDomain();
  }

  private createDomain(): TimedResearchSession {
    const scenario = this.registry.scenarioById.get(this.menu.scenarioId);
    if (!scenario) {
      throw new Error(`Resolved menu references missing scenario ${this.menu.scenarioId}`);
    }
    if (scenario.orderId !== this.menu.orderId) {
      throw new Error(
        `Resolved menu order ${this.menu.orderId} does not match scenario ${scenario.orderId}`,
      );
    }
    const longLinkFixture = this.menu.acceptanceFixtureId === 'LONG_LINKS'
      ? {
        id: 'LONG_LINKS_ACCEPTANCE',
        initialBoard: Array.from(
          { length: this.registry.gameplay.board.rows },
          () => Array.from(
            { length: this.registry.gameplay.board.columns },
            () => 'M',
          ),
        ),
        columnQueues: Object.fromEntries(
          Array.from(
            { length: this.registry.gameplay.board.columns },
            (_unused, column) => [
              String(column),
              Array.from({ length: 64 }, () => 'M'),
            ],
          ),
        ),
        researchClueQueue: ['CLUE_STAR'],
      }
      : undefined;
    const scenarioCase = longLinkFixture ?? (this.menu.caseId
      ? scenario.cases.find(({ id }) => id === this.menu.caseId)
      : scenario.cases[0]);
    if (!scenarioCase) {
      throw new Error(`Resolved menu references missing case ${this.menu.caseId ?? '<first>'}`);
    }
    return new TimedResearchSession(
      this.registry,
      scenario.id,
      scenarioCase.id,
      scenarioCase.initialBoard,
      scenarioCase.columnQueues,
      scenarioCase.researchClueQueue,
      scenario.seed,
      new CookingHistoryModel(
        undefined,
        this.registry.gameplay.history.processedCookResultLimit,
      ),
    );
  }

  public beginLink(coord: Coord): Coord[] {
    if (this.paused || !this.domain.beginLink()) {
      return [];
    }
    this.editor = new PathEditor(
      this.domain.board,
      new PathValidator(
        this.registry.gameplay.board.connectionDirections,
        this.registry.gameplay.board.minimumLink,
      ),
    );
    this.editor.append(coord);
    return this.editor.snapshot();
  }

  public extendLink(coord: Coord): Coord[] {
    if (this.paused || !this.editor || !['LINKING', 'TIMEOUT_GRACE'].includes(this.domain.phase)) {
      return [];
    }
    this.editor.append(coord);
    return this.editor.snapshot();
  }

  public cancelLink(): void {
    this.editor = undefined;
    this.domain.cancelLink();
  }

  public commitLink(): LinkSubmission {
    if (this.paused || !this.editor) {
      return { accepted: false, reason: 'No link is active' };
    }
    const path = this.editor.snapshot();
    const before = this.domain.snapshot();
    const inspirationCollected = path.some((coord) =>
      before.board[coord.row]?.[coord.column]?.inspiration);
    const result = this.domain.commitLink(path);
    this.editor = undefined;
    if (!result.committed || !result.throwRecord) {
      return { accepted: false, reason: result.reason };
    }
    const after = this.domain.snapshot();
    const operationId = `${this.menu.dailyMenuId}:link:${++this.operationCounter}`;
    const { survivorMoves, refillMoves } = deriveMoves(
      before.board,
      path,
      before.queueCursors,
      after.queueCursors,
    );
    this.longestLink = Math.max(this.longestLink, path.length);
    this.highestComboMultiplier = Math.max(
      this.highestComboMultiplier,
      result.throwRecord.comboMultiplier,
    );
    const plan: EffectPlan = {
      operationId,
      ingredientId: result.throwRecord.ingredientId,
      path: deepClone(path),
      flightOrder: deepClone(path),
      survivorMoves,
      refillMoves,
      throwRecord: deepClone(result.throwRecord),
      throwSlotIndex: after.pot.throws.length - 1,
      beforeBoardHash: before.boardHash,
      settledBoardHash: after.boardHash,
      finalBoardHash: after.boardHash,
      settledBoard: deepClone(after.board),
      finalBoard: deepClone(after.board),
      throwRecords: deepClone(after.pot.throws),
      remainingActiveTimeMs: after.remainingActiveTimeMs,
      linkScoreDelta: after.linkScore - before.linkScore,
      dishScoreDelta: after.dishScore - before.dishScore,
      totalScore: after.totalScore,
      comboCount: after.comboCount,
      comboMultiplier: result.throwRecord.comboMultiplier,
      audioEvent: result.throwRecord.audioEvent,
      canFire: after.pot.throws.length >= this.registry.gameplay.pot.minimumUnitsToCook,
      potFull: after.pot.throws.length >= this.registry.gameplay.pot.maximumUnits,
      autoFireReady: false,
      inspirationSpawned: result.inspirationCoord
        ? deepClone(result.inspirationCoord)
        : undefined,
      inspirationCollected,
      inspirationLanding: result.inspirationCoord
        ? deepClone(result.inspirationCoord)
        : undefined,
      freeShuffleRequired: false,
      shuffled: false,
      snapshot: deepClone(after),
      snapshotHash: stableHash(after),
    };
    this.activeAnimationOperationId = operationId;
    return { accepted: true, plan };
  }

  public completeAnimation(operationId: string): boolean {
    if (
      this.paused
      && this.activeAnimationOperationId === operationId
      && this.domain.phase === 'ANIMATING'
    ) {
      this.pendingAnimationOperationId = operationId;
      return false;
    }
    if (
      this.completedAnimationOperations.has(operationId)
      || this.activeAnimationOperationId !== operationId
      || this.domain.phase !== 'ANIMATING'
    ) {
      return false;
    }
    this.completedAnimationOperations.add(operationId);
    this.activeAnimationOperationId = undefined;
    this.pendingAnimationOperationId = undefined;
    this.domain.completeAnimation();
    return true;
  }

  public fire(): CookPresentation | undefined {
    if (this.paused) {
      return undefined;
    }
    if (this.cooking) {
      return deepClone(this.cooking);
    }
    if (this.domain.phase !== 'READY' || !this.domain.pot.canFire()) {
      return undefined;
    }
    return this.beginCooking(this.domain.fire());
  }

  public confirmAutoFire(): CookPresentation | undefined {
    if (this.paused) {
      return undefined;
    }
    if (this.cooking) {
      return deepClone(this.cooking);
    }
    if (this.domain.phase !== 'AUTO_FIRE_READY') {
      return undefined;
    }
    return this.beginCooking(this.domain.confirmAutoFire());
  }

  private beginCooking(result: CookResult): CookPresentation {
    const recipe = this.registry.recipeById.get(result.recipeId);
    if (!recipe) {
      throw new Error(`Cook result references missing recipe ${result.recipeId}`);
    }
    const sessionCookCount =
      this.domain.history.snapshot().sessionCookCounts[result.recipeId] ?? 0;
    this.cooking = {
      operationId: `${this.menu.dailyMenuId}:cook:${++this.operationCounter}`,
      result: deepClone(result),
      recipeName: recipe.name,
      recipeId: recipe.id,
      quick:
        !result.isNewDiscovery
        && recipe.rarity !== 'RARE'
        && !recipe.tags.includes('DARK'),
      sessionCookCount,
    };
    return deepClone(this.cooking);
  }

  public completeCooking(operationId: string): boolean {
    if (
      this.paused
      && this.cooking?.operationId === operationId
      && !this.completedCookingOperations.has(operationId)
    ) {
      this.pendingCookingOperationId = operationId;
      return false;
    }
    if (
      !this.cooking
      || this.cooking.operationId !== operationId
      || this.completedCookingOperations.has(operationId)
    ) {
      return false;
    }
    this.completedCookingOperations.add(operationId);
    this.pendingCookingOperationId = undefined;
    return true;
  }

  public completeReveal(cookResultId: string): boolean {
    if (
      this.paused
      || !this.cooking
      || this.cooking.result.cookResultId !== cookResultId
      || this.completedRevealResults.has(cookResultId)
      || this.domain.phase !== 'REVEAL'
    ) {
      return false;
    }
    this.completedRevealResults.add(cookResultId);
    this.domain.completeReveal();
    this.cooking = undefined;
    return true;
  }

  public completePartialResult(): boolean {
    if (this.paused || this.domain.phase !== 'PARTIAL_RESULT') {
      return false;
    }
    this.domain.completePartialResult();
    return true;
  }

  public tick(milliseconds: number): number {
    if (this.paused || this.cooking || this.domain.phase === 'ANIMATING') {
      return 0;
    }
    if (this.domain.phase === 'TIMEOUT_GRACE') {
      return this.domain.advanceGraceTime(milliseconds);
    }
    return this.domain.advanceActiveTime(milliseconds);
  }

  public pause(): boolean {
    if (this.paused || this.domain.phase === 'SUMMARY') {
      return false;
    }
    if (this.editor) {
      this.editor = undefined;
      this.domain.cancelLink();
    }
    this.paused = true;
    return true;
  }

  public resume(): boolean {
    if (!this.paused) {
      return false;
    }
    this.paused = false;
    if (this.pendingAnimationOperationId) {
      this.completeAnimation(this.pendingAnimationOperationId);
    }
    if (this.pendingCookingOperationId) {
      this.completeCooking(this.pendingCookingOperationId);
    }
    return true;
  }

  public restart(): void {
    this.domain = this.createDomain();
    this.editor = undefined;
    this.operationCounter = 0;
    this.activeAnimationOperationId = undefined;
    this.pendingAnimationOperationId = undefined;
    this.pendingCookingOperationId = undefined;
    this.cooking = undefined;
    this.paused = false;
    this.longestLink = 0;
    this.highestComboMultiplier = 1;
    this.completedAnimationOperations.clear();
    this.completedCookingOperations.clear();
    this.completedRevealResults.clear();
  }

  public snapshot(): SessionSnapshot {
    return this.domain.snapshot();
  }

  public activePath(): Coord[] {
    return this.editor?.snapshot() ?? [];
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public viewModel(): BattleViewModel {
    const snapshot = this.domain.snapshot();
    const clue = this.clueViewModel(snapshot.currentResearchClueId);
    const recipeCounts = snapshot.history.sessionCookCounts;
    const formalDishCount = Object.values(recipeCounts)
      .reduce((sum, count) => sum + (count ?? 0), 0);
    return {
      menu: deepClone(this.menu),
      phase: this.paused
        ? 'PAUSED'
        : this.cooking && !this.completedCookingOperations.has(this.cooking.operationId)
          ? 'COOKING'
          : snapshot.phase,
      board: deepClone(snapshot.board),
      boardHash: snapshot.boardHash,
      remainingActiveTimeMs: snapshot.remainingActiveTimeMs,
      timerText: formatTimer(snapshot.remainingActiveTimeMs),
      timerWarning:
        snapshot.remainingActiveTimeMs > 0
        && snapshot.remainingActiveTimeMs <= 10_000,
      totalScore: snapshot.totalScore,
      comboCount: snapshot.comboCount,
      comboMultiplier: comboMultiplierFor(this.registry, snapshot.comboCount),
      clue,
      throwRecords: deepClone(snapshot.pot.throws),
      canFire: snapshot.pot.throws.length >= this.registry.gameplay.pot.minimumUnitsToCook,
      potFull: snapshot.pot.throws.length >= this.registry.gameplay.pot.maximumUnits,
      activePath: this.activePath(),
      cooking: this.cooking ? deepClone(this.cooking) : undefined,
      partialUnits: snapshot.pot.throws.length,
      summary: {
        totalScore: snapshot.totalScore,
        formalDishCount,
        recipeCounts: deepClone(recipeCounts),
        newDiscoveries: [...snapshot.history.discoveredRecipeIds],
        longestLink: this.longestLink,
        highestComboMultiplier: this.highestComboMultiplier,
      },
    };
  }

  private clueViewModel(clueId?: string): ResearchClueViewModel {
    const clue = this.registry.orders
      .flatMap((order) => order.clues)
      .find(({ id }) => id === clueId);
    if (!clue) {
      throw new Error(`Current research clue ${clueId ?? '<none>'} is missing`);
    }
    const recipe = this.registry.recipeById.get(clue.recipeId);
    if (!recipe) {
      throw new Error(`Research clue references missing recipe ${clue.recipeId}`);
    }
    return {
      id: clue.id,
      text: clue.text,
      recipeId: clue.recipeId,
      ingredientHints: Object.entries(recipe.required)
        .map(([ingredientId, units]) => ({
          ingredientId: ingredientId as IngredientId,
          units: units ?? 0,
        }))
        .filter(({ units }) => units > 0),
    };
  }

  public latestAudioEvent(): AudioEvent | undefined {
    return this.domain.pot.throws[this.domain.pot.throws.length - 1]?.audioEvent;
  }

  public latestProcessingLevel(): ProcessingLevel | undefined {
    return this.domain.pot.throws[this.domain.pot.throws.length - 1]?.processingLevel;
  }
}
