import { ConfigRegistry, defaultConfigDirectory } from '../src/cp0b/config.js';
import type { Cell, Coord, IngredientId } from '../src/cp0b/types.js';

export const registry = ConfigRegistry.fromDirectory(defaultConfigDirectory());

export const cells = (
  ingredientId: IngredientId,
  count: number,
  inspirationIndices: number[] = [],
): Cell[] => Array.from({ length: count }, (_unused, index) => ({
  ingredientId,
  inspiration: inspirationIndices.includes(index),
}));

export const coord = (row: number, column: number): Coord => ({ row, column });
