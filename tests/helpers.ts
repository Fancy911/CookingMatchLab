import type {
  Cell,
  Coord,
  IngredientId,
} from '../assets/game/scripts/domain/cp0b/types';
import {
  defaultConfigDirectory,
  loadConfigRegistry,
} from '../tools/cp0b/NodeConfigLoader';

export const registry = loadConfigRegistry(defaultConfigDirectory());

export const cells = (
  ingredientId: IngredientId,
  count: number,
  inspirationIndices: number[] = [],
): Cell[] => Array.from({ length: count }, (_unused, index) => ({
  ingredientId,
  inspiration: inspirationIndices.includes(index),
}));

export const coord = (row: number, column: number): Coord => ({ row, column });
