import type {
  BoardGrid,
  Coord,
  IngredientId,
  ThrowRecord,
} from '../../domain/cp0b/types';

export interface BoardMove {
  from: Coord;
  to: Coord;
}

export interface RefillMove {
  queueIndex: number;
  from: Coord;
  to: Coord;
}

export interface EffectPlan {
  operationId: string;
  ingredientId: IngredientId;
  path: Coord[];
  flightOrder: Coord[];
  survivorMoves: BoardMove[];
  refillMoves: RefillMove[];
  throwRecord: ThrowRecord;
  throwSlotIndex: number;
  beforeBoardHash: string;
  settledBoardHash: string;
  finalBoardHash: string;
  settledBoard: BoardGrid;
  finalBoard: BoardGrid;
  remainingSteps: number;
  canFire: boolean;
  potFull: boolean;
  shuffled: boolean;
}
