import {
  RunSnapshot,
  type RunSnapshotData,
} from '../../assets/game/scripts/domain/cp0b/core';
import type {
  Coord,
  OrderResult,
  ScenarioAction,
} from '../../assets/game/scripts/domain/cp0b/types';

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

export type ActionLogDetail = Pick<ActionLog, 'status' | 'firstDifference'>
  & Partial<Omit<
    ActionLog,
    'index' | 'type' | 'path' | 'before' | 'after' | 'status' | 'firstDifference'
  >>;

export const actionPath = (action: ScenarioAction): Coord[] =>
  (action.path ?? []).map(([row, column]) => ({ row, column }));

export const humanCoord = (coord: Coord): string =>
  `r${coord.row + 1}c${coord.column + 1}`;

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
