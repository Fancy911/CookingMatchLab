import type { Coord } from '../../domain/cp0b/types';

export type ResearchBoardFixtureId =
  | 'NATURAL_RS02'
  | 'NATURAL_LONG_LINKS'
  | 'DEAD_BOARD'
  | 'ROW_LINKS_TEST_ONLY';

const NATURAL_BOARD = [
  ['P', 'P', 'M', 'E', 'E', 'S', 'E'],
  ['E', 'P', 'P', 'P', 'C', 'S', 'P'],
  ['S', 'M', 'P', 'M', 'M', 'E', 'M'],
  ['P', 'C', 'S', 'E', 'M', 'M', 'S'],
  ['C', 'S', 'C', 'E', 'E', 'M', 'M'],
  ['P', 'C', 'S', 'C', 'S', 'C', 'M'],
  ['C', 'S', 'E', 'C', 'C', 'P', 'E'],
] as const;

const DEAD_BOARD = Array.from({ length: 7 }, (_unused, row) =>
  Array.from({ length: 7 }, (_unusedColumn, column) =>
    ['P', 'E', 'S', 'M', 'C'][(row * 2 + column) % 5]));

const MIXED_SYMBOLS = ['P', 'E', 'S', 'M', 'C'] as const;

const mixedColumnQueues = (): Record<string, string[]> => {
  const queues = Object.fromEntries(Array.from({ length: 7 }, (_unused, column) => [
    String(column),
    Array.from({ length: 96 }, (_entry, index) =>
      MIXED_SYMBOLS[(index * 2 + column * 3 + Math.floor(index / 7)) % MIXED_SYMBOLS.length]),
  ]));
  // The first clue remains genuinely playable without forming a uniform band:
  // three potato triples refill in the same small L-shape, followed by egg and
  // scallion triples. All other columns and later queue entries stay mixed.
  queues['0'].splice(0, 4, 'P', 'P', 'E', 'S');
  queues['1'].splice(0, 8, 'P', 'P', 'P', 'P', 'E', 'E', 'S', 'S');
  return queues;
};

const cloneBoard = (source: readonly (readonly string[])[]): string[][] =>
  source.map((row) => [...row]);

export interface ResearchBoardFixture {
  id: ResearchBoardFixtureId;
  initialBoard: string[][];
  columnQueues: Record<string, string[]>;
}

export const NATURAL_LONG_LINK_PATHS: Record<'GOOD' | 'GREAT' | 'UNBELIEVABLE', Coord[]> = {
  GOOD: [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
    { row: 1, column: 1 },
    { row: 1, column: 2 },
    { row: 2, column: 2 },
  ],
  GREAT: [
    { row: 2, column: 3 },
    { row: 2, column: 4 },
    { row: 3, column: 4 },
    { row: 3, column: 5 },
    { row: 4, column: 5 },
    { row: 4, column: 6 },
    { row: 5, column: 6 },
  ],
  UNBELIEVABLE: [
    { row: 6, column: 0 },
    { row: 5, column: 1 },
    { row: 4, column: 0 },
    { row: 3, column: 1 },
    { row: 4, column: 2 },
    { row: 5, column: 3 },
    { row: 6, column: 3 },
    { row: 6, column: 4 },
    { row: 5, column: 5 },
  ],
};

export const createResearchBoardFixture = (
  fixtureId: ResearchBoardFixtureId,
): ResearchBoardFixture => {
  if (fixtureId === 'ROW_LINKS_TEST_ONLY') {
    return {
      id: fixtureId,
      initialBoard: Array.from({ length: 7 }, () =>
        Array.from({ length: 7 }, () => 'M')),
      columnQueues: Object.fromEntries(
        Array.from({ length: 7 }, (_unused, column) => [
          String(column),
          Array.from({ length: 96 }, () => 'M'),
        ]),
      ),
    };
  }
  return {
    id: fixtureId,
    initialBoard: fixtureId === 'DEAD_BOARD'
      ? cloneBoard(DEAD_BOARD)
      : cloneBoard(NATURAL_BOARD),
    columnQueues: mixedColumnQueues(),
  };
};
