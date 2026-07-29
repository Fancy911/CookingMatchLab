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
} from '../../domain/cp0b/core';
import {
  type Cell,
  type Coord,
  type FireResult,
  type IngredientId,
  type OrderResult,
  type ScenarioConfig,
  type ThrowRecord,
} from '../../domain/cp0b/types';
import { deepClone } from '../../domain/cp0b/stable';
import { ConfigRegistry } from './ConfigRegistry';

export interface CommitResult {
  committed: boolean;
  reason?: string;
  throwRecord?: ThrowRecord;
  inspirationCoord?: Coord;
  inspirationHintShown: boolean;
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
        Array.from(
          { length: registry.gameplay.board.columns },
          (_unused, column) => [String(column), 0],
        ),
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
