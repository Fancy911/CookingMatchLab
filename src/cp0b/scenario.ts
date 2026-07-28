import {
  BoardModel,
  BoardResolver,
  DeadBoardDetector,
  DeterministicRng,
  DiscoveryModel,
  InspirationResolver,
  OrderResolver,
  PathValidator,
  PotModel,
  RecipeResolver,
  RunSnapshot,
  type RunSnapshotData,
  ShuffleResolver,
  StarCalculator,
  settleFire,
  type QueueState,
} from './core.js';
import { ConfigRegistry } from './config.js';
import {
  type Cell,
  type Coord,
  type DiscoveryState,
  type FireResult,
  type IngredientId,
  type OrderResult,
  type ScenarioAction,
  type ScenarioConfig,
  type ScenarioId,
  type ThrowRecord,
} from './types.js';
import { deepClone, stableHash, stableStringify } from './stable.js';

export interface CommitResult {
  committed: boolean;
  reason?: string;
  throwRecord?: ThrowRecord;
  inspirationCoord?: Coord;
  inspirationHintShown: boolean;
}

const actionPath = (action: ScenarioAction): Coord[] =>
  (action.path ?? []).map(([row, column]) => ({ row, column }));

export class ScenarioService {
  public constructor(private readonly registry: ConfigRegistry) {}

  public get(id: ScenarioId): ScenarioConfig {
    const scenario = this.registry.scenarioById.get(id);
    if (!scenario) {
      throw new Error(`Unknown scenario ${id}`);
    }
    return deepClone(scenario);
  }

  public list(): ScenarioConfig[] {
    return this.registry.scenarios.map(deepClone);
  }
}

export class OrderSession {
  public board: BoardModel;
  public readonly pot: PotModel;
  public remainingSteps: number;
  public orderResult: OrderResult = 'IN_PROGRESS';
  public lastFireResult?: FireResult;
  public queueState: QueueState;
  public readonly rng: DeterministicRng;

  private readonly pathValidator: PathValidator;
  private readonly boardResolver = new BoardResolver();
  private readonly inspirationResolver: InspirationResolver;
  private readonly recipeResolver: RecipeResolver;
  private readonly starCalculator: StarCalculator;
  private readonly orderResolver = new OrderResolver();
  private readonly detector = new DeadBoardDetector();
  private readonly shuffleResolver = new ShuffleResolver();

  public constructor(
    private readonly registry: ConfigRegistry,
    public readonly scenario: ScenarioConfig,
    public readonly discovery: DiscoveryModel = new DiscoveryModel(),
    seed = 0x43503042,
  ) {
    const order = registry.orderById.get(scenario.orderId);
    if (!order) {
      throw new Error(`Unknown order ${scenario.orderId}`);
    }
    this.board = new BoardModel(scenario.initialBoard.map((row) =>
      row.map((symbol) => this.cellForSymbol(symbol))));
    this.queueState = {
      values: Object.fromEntries(
        Object.entries(scenario.columnQueues).map(([column, queue]) => [
          column,
          queue.map((symbol) => this.cellForSymbol(symbol)),
        ]),
      ),
      cursors: Object.fromEntries(
        Array.from({ length: registry.gameplay.board.columns }, (_unused, column) => [String(column), 0]),
      ),
    };
    this.pot = new PotModel(registry.gameplay, registry.normalUnitValueById);
    this.remainingSteps = order.initialSteps;
    this.pathValidator = new PathValidator(
      registry.gameplay.board.connectionDirections,
      registry.gameplay.board.minimumLink,
    );
    this.inspirationResolver = new InspirationResolver(registry.gameplay);
    this.recipeResolver = new RecipeResolver(registry.recipes);
    this.starCalculator = new StarCalculator(registry.gameplay);
    this.rng = new DeterministicRng(seed);
  }

  private cellForSymbol(symbolWithMarker: string): Cell {
    const symbol = symbolWithMarker.replace('*', '');
    const ingredientId = this.registry.symbolToIngredient.get(symbol);
    if (!ingredientId) {
      throw new Error(`Unknown ingredient symbol ${symbolWithMarker}`);
    }
    return {
      ingredientId,
      inspiration: symbolWithMarker.endsWith('*'),
    };
  }

  public commit(path: Coord[]): CommitResult {
    if (this.orderResult !== 'IN_PROGRESS') {
      throw new Error(`Cannot commit while order result is ${this.orderResult}`);
    }
    if (this.remainingSteps <= 0) {
      throw new Error('Cannot collect after steps are exhausted');
    }
    if (this.pot.isFull()) {
      throw new Error('Cannot collect after all base throw slots are occupied');
    }
    const validation = this.pathValidator.validate(this.board, path);
    if (!validation.valid) {
      return {
        committed: false,
        reason: validation.reason,
        inspirationHintShown: false,
      };
    }
    const pathCells = path.map((coord) => deepClone(this.board.get(coord)));
    const ingredientId: IngredientId = pathCells[0].ingredientId;
    const throwRecord = this.pot.addThrow(pathCells);
    this.remainingSteps -= 1;
    const resolution = this.boardResolver.resolve(this.board, path, this.queueState);
    this.board = resolution.board;
    this.queueState = resolution.queueState;

    let inspirationCoord: Coord | undefined;
    let inspirationHintShown = false;
    if (this.inspirationResolver.shouldSpawn(path.length)) {
      inspirationCoord = this.inspirationResolver.spawn(
        resolution,
        path[path.length - 1],
        ingredientId,
      );
      inspirationHintShown = this.discovery.showInspirationHintOnce();
    }

    if (this.detector.isDead(
      this.board,
      this.registry.gameplay.board.connectionDirections,
      this.registry.gameplay.board.minimumLink,
    )) {
      this.board = this.shuffleResolver.shuffle(this.board, this.registry.gameplay, this.rng);
    }
    return {
      committed: true,
      throwRecord,
      inspirationCoord,
      inspirationHintShown,
    };
  }

  public fire(): FireResult {
    const order = this.registry.orderById.get(this.scenario.orderId)!;
    const result = settleFire(
      this.recipeResolver,
      this.starCalculator,
      this.orderResolver,
      this.discovery,
      this.pot,
      order,
      this.remainingSteps,
    );
    this.orderResult = result.orderResult;
    this.lastFireResult = result;
    return result;
  }

  public continueAfterReveal(): void {
    if (this.orderResult !== 'CONTINUE_AFTER_REVEAL') {
      throw new Error(`Cannot continue from ${this.orderResult}`);
    }
    this.pot.clear();
    this.orderResult = 'IN_PROGRESS';
  }

  public snapshot(): RunSnapshotData {
    return RunSnapshot.create({
      remainingSteps: this.remainingSteps,
      board: this.board.grid,
      pot: this.pot.snapshot(),
      queueCursors: this.queueState.cursors,
      orderResult: this.orderResult,
      discovery: this.discovery.state,
    });
  }
}

export interface ActionLog {
  index: number;
  type: ScenarioAction['type'];
  status: 'PASS' | 'FAIL';
  firstDifference: string | null;
  path?: string[];
  before: {
    remainingSteps: number;
    potUnits: Record<string, number>;
    usedThrowSlots: number;
    processingTags: string[];
    queueCursors: Record<string, number>;
    boardHash: string;
    snapshotHash: string;
  };
  after: {
    remainingSteps: number;
    potUnits: Record<string, number>;
    usedThrowSlots: number;
    processingTags: string[];
    queueCursors: Record<string, number>;
    boardHash: string;
    snapshotHash: string;
  };
  committed?: boolean;
  inspirationAt?: string;
  inspirationHintShown?: boolean;
  recipeId?: string;
  stars?: number;
  orderResult?: OrderResult;
}

export interface ScenarioRun {
  engineVersion: string;
  gitBaselineCommit: string;
  configSchemaVersion: number;
  configHash: string;
  scenarioId: ScenarioId;
  status: 'PASS' | 'FAIL';
  firstDifference: string | null;
  rng: {
    algorithm: string;
    seed: string;
    fixedRefillUsesPrng: false;
  };
  actions: ActionLog[];
  fireResults: FireResult[];
  finalSnapshot: RunSnapshotData;
  finalSnapshotHash: string;
  finalRecipeId?: string;
}

const humanCoord = (coord: Coord): string => `r${coord.row + 1}c${coord.column + 1}`;

const expectedKeys = [
  'stepDelta',
  'potUnits',
  'inspirationAt',
  'pathCells',
  'throwUnits',
  'recipeId',
  'remainingSteps',
] as const;

interface ActionActual {
  stepDelta: number;
  potUnits: Record<string, number>;
  inspirationAt?: string;
  pathCells?: number;
  throwUnits?: number;
  recipeId?: string;
  remainingSteps: number;
}

type ActionLogDetail = Pick<ActionLog, 'status' | 'firstDifference'>
  & Partial<Omit<
    ActionLog,
    'index' | 'type' | 'path' | 'before' | 'after' | 'status' | 'firstDifference'
  >>;

const normalizePotUnits = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, units]) => typeof units === 'number' && units !== 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  ) as Record<string, number>;
};

const printable = (value: unknown): string =>
  value === undefined ? 'undefined' : stableStringify(value);

const compareExpected = (
  action: ScenarioAction,
  actual: ActionActual,
  actionIndex: number,
): string | null => {
  const expected = action.expected ?? {};
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(expected, key)) {
      continue;
    }
    const expectedValue = key === 'potUnits'
      ? normalizePotUnits(expected[key])
      : expected[key];
    const actualValue = key === 'potUnits'
      ? normalizePotUnits(actual[key])
      : actual[key];
    if (stableStringify(expectedValue) !== stableStringify(actualValue)) {
      return `action ${actionIndex + 1} ${key}: expected ${printable(expectedValue)}, received ${printable(actualValue)}`;
    }
  }
  return null;
};

const compactSnapshot = (snapshot: RunSnapshotData) => ({
  remainingSteps: snapshot.remainingSteps,
  potUnits: snapshot.pot.units as Record<string, number>,
  usedThrowSlots: snapshot.pot.throws.length,
  processingTags: snapshot.pot.tags,
  queueCursors: snapshot.queueCursors,
  boardHash: snapshot.boardHash,
  snapshotHash: RunSnapshot.hash(snapshot),
});

export class RunLogger {
  public readonly actions: ActionLog[] = [];

  public record(
    index: number,
    action: ScenarioAction,
    before: RunSnapshotData,
    after: RunSnapshotData,
    detail: ActionLogDetail,
  ): void {
    this.actions.push({
      index,
      type: action.type,
      path: actionPath(action).map(humanCoord),
      before: compactSnapshot(before),
      after: compactSnapshot(after),
      ...detail,
    });
  }
}

export class PrototypeTestRunner {
  public constructor(
    private readonly registry: ConfigRegistry,
    private readonly engineVersion = '3.8.8',
    private readonly gitBaselineCommit = 'cba34c9920be44cb546653635c8a4dab60c5aa14',
  ) {}

  public run(
    scenarioId: ScenarioId,
    discoveryState?: DiscoveryState,
    seed = 0x43503042,
  ): ScenarioRun {
    const scenario = new ScenarioService(this.registry).get(scenarioId);
    return this.runScenario(scenario, discoveryState, seed);
  }

  public runScenario(
    scenario: ScenarioConfig,
    discoveryState?: DiscoveryState,
    seed = 0x43503042,
  ): ScenarioRun {
    const discovery = new DiscoveryModel(discoveryState ?? {
      tutorialFlags: { inspirationUnitHintShown: false },
      discoveredRecipeIds: [],
      bestStarsByRecipe: {},
      firstResearchRecordIds: [],
    });
    const session = new OrderSession(this.registry, scenario, discovery, seed);
    const logger = new RunLogger();
    const fireResults: FireResult[] = [];

    scenario.expectedActionScript.forEach((action, index) => {
      const before = session.snapshot();
      const detail: ActionLogDetail = {
        status: 'PASS',
        firstDifference: null,
      };
      let actionThrow: ThrowRecord | undefined;
      if (action.type === 'LINK') {
        const commit = session.commit(actionPath(action));
        actionThrow = commit.throwRecord;
        detail.committed = commit.committed;
        detail.inspirationAt = commit.inspirationCoord
          ? humanCoord(commit.inspirationCoord)
          : undefined;
        detail.inspirationHintShown = commit.inspirationHintShown;
      } else if (action.type === 'FIRE') {
        const fire = session.fire();
        fireResults.push(fire);
        detail.recipeId = fire.recipeId;
        detail.stars = fire.stars;
        detail.orderResult = fire.orderResult;
      } else {
        session.continueAfterReveal();
      }
      const after = session.snapshot();
      const actual: ActionActual = {
        stepDelta: after.remainingSteps - before.remainingSteps,
        potUnits: after.pot.units as Record<string, number>,
        inspirationAt: detail.inspirationAt,
        pathCells: actionThrow?.pathLength,
        throwUnits: actionThrow?.units,
        recipeId: detail.recipeId,
        remainingSteps: after.remainingSteps,
      };
      const firstDifference = compareExpected(action, actual, index);
      detail.status = firstDifference === null ? 'PASS' : 'FAIL';
      detail.firstDifference = firstDifference;
      logger.record(index, action, before, after, detail);
    });

    const finalSnapshot = session.snapshot();
    const finalRecipeId = fireResults.at(-1)?.recipeId;
    const actionDifference = logger.actions.find((action) => action.status === 'FAIL')
      ?.firstDifference ?? null;
    const finalDifference = finalRecipeId === scenario.expectedFinalResult
      ? null
      : `expectedFinalResult: expected ${scenario.expectedFinalResult}, received ${printable(finalRecipeId)}`;
    const firstDifference = actionDifference ?? finalDifference;
    return {
      engineVersion: this.engineVersion,
      gitBaselineCommit: this.gitBaselineCommit,
      configSchemaVersion: this.registry.gameplay.schemaVersion,
      configHash: this.registry.configHash,
      scenarioId: scenario.id,
      status: firstDifference === null ? 'PASS' : 'FAIL',
      firstDifference,
      rng: {
        algorithm: DeterministicRng.algorithm,
        seed: `0x${seed.toString(16).padStart(8, '0')}`,
        fixedRefillUsesPrng: false,
      },
      actions: logger.actions,
      fireResults,
      finalSnapshot,
      finalSnapshotHash: stableHash(finalSnapshot),
      finalRecipeId,
    };
  }
}
