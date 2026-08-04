import type {
  AudioEvent,
  BoardGrid,
  Coord,
  IngredientId,
  ThrowRecord,
} from '../../domain/cp0b/types';
import type { SessionSnapshot } from '../../domain/cp0b/core';

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
  throwRecords: ThrowRecord[];
  remainingActiveTimeMs: number;
  linkScoreDelta: number;
  dishScoreDelta: number;
  totalScore: number;
  comboCount: number;
  comboMultiplier: number;
  audioEvent?: AudioEvent;
  canFire: boolean;
  potFull: boolean;
  autoFireReady: boolean;
  inspirationSpawned?: Coord;
  inspirationCollected: boolean;
  inspirationLanding?: Coord;
  freeShuffleRequired: boolean;
  shuffled: boolean;
  snapshot: SessionSnapshot;
  snapshotHash: string;
}
