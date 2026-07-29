import type { RunSnapshotData } from '../../domain/cp0b/core';
import type {
  BoardGrid,
  Coord,
  IngredientId,
  ThrowRecord,
} from '../../domain/cp0b/types';
import { deepClone, stableHash } from '../../domain/cp0b/stable';
import type { CommitResult } from './OrderSession';

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

const key = ({ row, column }: Coord): string => `${row}:${column}`;

export class EffectPlanBuilder {
  public build(
    operationId: string,
    path: Coord[],
    before: RunSnapshotData,
    after: RunSnapshotData,
    commit: CommitResult,
    minimumThrowsToCook: number,
    baseSlots: number,
  ): EffectPlan {
    if (!commit.committed || !commit.throwRecord || !commit.resolution) {
      throw new Error('An effect plan requires a committed domain action');
    }
    const removed = new Set(path.map(key));
    const survivorMoves: BoardMove[] = [];
    const refillMoves: RefillMove[] = [];
    const rows = before.board.length;
    const columns = before.board[0].length;

    for (let column = 0; column < columns; column += 1) {
      const survivors: number[] = [];
      for (let row = 0; row < rows; row += 1) {
        if (!removed.has(key({ row, column }))) {
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
    }

    commit.resolution.newCells.forEach((entry) => {
      refillMoves.push({
        queueIndex: entry.queueIndex,
        from: { row: -1, column: entry.coord.column },
        to: deepClone(entry.coord),
      });
    });

    const throwSlotIndex = after.pot.throws.length - 1;
    return {
      operationId,
      ingredientId: commit.throwRecord.ingredientId,
      path: deepClone(path),
      flightOrder: deepClone(path),
      survivorMoves,
      refillMoves,
      throwRecord: deepClone(commit.throwRecord),
      throwSlotIndex,
      beforeBoardHash: stableHash(before.board),
      settledBoardHash: stableHash(commit.resolution.boardBeforeShuffle),
      finalBoardHash: after.boardHash,
      settledBoard: deepClone(commit.resolution.boardBeforeShuffle),
      finalBoard: deepClone(after.board),
      remainingSteps: after.remainingSteps,
      canFire: after.pot.throws.length >= minimumThrowsToCook,
      potFull: after.pot.throws.length >= baseSlots,
      shuffled: commit.resolution.shuffled,
    };
  }
}
