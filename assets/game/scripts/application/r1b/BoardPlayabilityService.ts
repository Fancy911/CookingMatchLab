import {
  BoardModel,
  DeadBoardDetector,
  ShuffleResolver,
  type DeterministicRng,
} from '../../domain/cp0b/core';
import { stableHash } from '../../domain/cp0b/stable';
import type {
  Coord,
  GameplayConfig,
  IngredientId,
} from '../../domain/cp0b/types';

export interface PlayabilityResult {
  shuffled: boolean;
  board: BoardModel;
  beforeBoardHash: string;
  afterBoardHash: string;
  legalIngredientIds: IngredientId[];
}

export const legalIngredientIds = (
  board: BoardModel,
  gameplay: GameplayConfig,
): IngredientId[] => {
  const rows = board.grid.length;
  const columns = board.grid[0].length;
  const minimumLink = gameplay.board.minimumLink;
  const directions = gameplay.board.connectionDirections;
  const legal = new Set<IngredientId>();
  const key = ({ row, column }: Coord): string => `${row}:${column}`;
  const adjacent = (left: Coord, right: Coord): boolean => {
    const rowDelta = Math.abs(left.row - right.row);
    const columnDelta = Math.abs(left.column - right.column);
    return directions === 8
      ? Math.max(rowDelta, columnDelta) === 1
      : rowDelta + columnDelta === 1;
  };
  const search = (path: Coord[]): boolean => {
    if (path.length >= minimumLink) return true;
    const tail = path.at(-1)!;
    for (let row = tail.row - 1; row <= tail.row + 1; row += 1) {
      for (let column = tail.column - 1; column <= tail.column + 1; column += 1) {
        const next = { row, column };
        if (
          row < 0
          || row >= rows
          || column < 0
          || column >= columns
          || !adjacent(tail, next)
          || path.some((coord) => key(coord) === key(next))
          || board.grid[row][column].ingredientId
            !== board.grid[tail.row][tail.column].ingredientId
        ) continue;
        if (search([...path, next])) return true;
      }
    }
    return false;
  };
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const ingredientId = board.grid[row][column].ingredientId;
      if (!legal.has(ingredientId) && search([{ row, column }])) {
        legal.add(ingredientId);
      }
    }
  }
  return Array.from(legal).sort();
};

export const ensureResearchBoardPlayable = (
  board: BoardModel,
  gameplay: GameplayConfig,
  rng: DeterministicRng,
  minimumLegalIngredientTypes = 3,
): PlayabilityResult => {
  const beforeBoardHash = stableHash(board.grid);
  const currentLegalIngredientIds = legalIngredientIds(board, gameplay);
  if (currentLegalIngredientIds.length > 0) {
    return {
      shuffled: false,
      board,
      beforeBoardHash,
      afterBoardHash: beforeBoardHash,
      legalIngredientIds: currentLegalIngredientIds,
    };
  }
  const shuffle = new ShuffleResolver();
  let candidate = board;
  for (let attempt = 0; attempt < gameplay.shuffle.maximumAttempts; attempt += 1) {
    candidate = shuffle.shuffle(candidate, gameplay, rng);
    const candidateLegalIngredientIds = legalIngredientIds(candidate, gameplay);
    if (candidateLegalIngredientIds.length >= minimumLegalIngredientTypes) {
      return {
        shuffled: true,
        board: candidate,
        beforeBoardHash,
        afterBoardHash: stableHash(candidate.grid),
        legalIngredientIds: candidateLegalIngredientIds,
      };
    }
  }
  throw new Error(
    `Unable to produce ${minimumLegalIngredientTypes} playable ingredient types after `
      + `${gameplay.shuffle.maximumAttempts} controlled shuffle passes`,
  );
};
