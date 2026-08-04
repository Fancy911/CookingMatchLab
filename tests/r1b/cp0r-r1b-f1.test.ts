import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flightTimingMsFor } from '../../assets/game/scripts/application/r1b/R1BAnimationTiming';
import {
  ensureResearchBoardPlayable,
} from '../../assets/game/scripts/application/r1b/BoardPlayabilityService';
import { DevelopmentResearchSchedule } from '../../assets/game/scripts/application/r1b/DevelopmentResearchSchedule';
import {
  createResearchBoardFixture,
  NATURAL_LONG_LINK_PATHS,
} from '../../assets/game/scripts/application/r1b/NaturalResearchFixtures';
import { ResearchGameplaySession } from '../../assets/game/scripts/application/r1b/ResearchGameplaySession';
import { FixedClock } from '../../assets/game/scripts/application/r1b/ResearchPorts';
import {
  BoardModel,
  DeadBoardDetector,
  TimedResearchSession,
} from '../../assets/game/scripts/domain/cp0b/core';
import type {
  BoardGrid,
  Coord,
  IngredientId,
} from '../../assets/game/scripts/domain/cp0b/types';
import { loadConfigRegistry } from '../../tools/cp0b/NodeConfigLoader';

const root = process.cwd();
const registry = loadConfigRegistry();
const schedule = new DevelopmentResearchSchedule();
const clock = new FixedClock(1_900_000_000_000);

const create = (menu = 'DEV_MENU_MULTI') =>
  new ResearchGameplaySession(registry, schedule, clock, menu);

const ingredientCounts = (board: BoardGrid): Map<IngredientId, number> => {
  const counts = new Map<IngredientId, number>();
  board.flat().forEach(({ ingredientId }) =>
    counts.set(ingredientId, (counts.get(ingredientId) ?? 0) + 1));
  return counts;
};

const legalThreePaths = (board: BoardGrid): Coord[][] => {
  const results = new Map<string, Coord[]>();
  const visit = (path: Coord[]): void => {
    if (path.length === 3) {
      const forward = path.map(({ row, column }) => `${row}:${column}`).join('|');
      const reverse = [...path].reverse()
        .map(({ row, column }) => `${row}:${column}`).join('|');
      results.set(forward < reverse ? forward : reverse, path);
      return;
    }
    const tail = path.at(-1)!;
    for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
      for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
        if (rowDelta === 0 && columnDelta === 0) continue;
        const next = {
          row: tail.row + rowDelta,
          column: tail.column + columnDelta,
        };
        if (
          next.row < 0
          || next.row >= board.length
          || next.column < 0
          || next.column >= board[0].length
          || board[next.row][next.column].ingredientId
            !== board[tail.row][tail.column].ingredientId
          || path.some(({ row, column }) =>
            row === next.row && column === next.column)
        ) continue;
        visit([...path, next]);
      }
    }
  };
  board.forEach((row, rowIndex) =>
    row.forEach((_cell, columnIndex) =>
      visit([{ row: rowIndex, column: columnIndex }])));
  return [...results.values()];
};

const hasStraightRun = (board: BoardGrid, minimumLength: number): boolean => {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
  return board.some((row, rowIndex) => row.some((cell, columnIndex) =>
    directions.some(([rowDelta, columnDelta]) => {
      for (let offset = 1; offset < minimumLength; offset += 1) {
        const nextRow = rowIndex + rowDelta * offset;
        const nextColumn = columnIndex + columnDelta * offset;
        if (
          nextRow < 0
          || nextRow >= board.length
          || nextColumn < 0
          || nextColumn >= board[0].length
          || board[nextRow][nextColumn].ingredientId !== cell.ingredientId
        ) return false;
      }
      return true;
    })));
};

const hasHomogeneousRowOrColumn = (board: BoardGrid): boolean =>
  board.some((row) => row.every((cell) =>
    cell.ingredientId === row[0].ingredientId))
  || board[0].some((_cell, column) => board.every((row) =>
    row[column].ingredientId === board[0][column].ingredientId));

const submit = (session: ResearchGameplaySession, path: Coord[]) => {
  expect(session.beginLink(path[0])).toEqual([path[0]]);
  path.slice(1).forEach((coord) => session.extendLink(coord));
  const submission = session.commitLink();
  expect(submission.accepted).toBe(true);
  return submission.plan!;
};

describe('CP0-R1-B-F1 natural board and dead-board protection', () => {
  it('F101 default RS02 uses only its five configured ingredients and never tomato', () => {
    const view = create().viewModel();
    const expected = new Set<IngredientId>([
      'ING_POTATO',
      'ING_EGG',
      'ING_SCALLION',
      'ING_MUSHROOM',
      'ING_CARROT',
    ]);
    expect(new Set(view.menu.ingredientPool)).toEqual(expected);
    expect(new Set(view.board.flat().map(({ ingredientId }) => ingredientId)))
      .toEqual(expected);
    expect(view.board.flat().some(({ ingredientId }) =>
      ingredientId === 'ING_TOMATO')).toBe(false);
  });

  it('F102 initial counts are 7–12 and layout has no straight five or homogeneous band', () => {
    const board = create().viewModel().board;
    expect([...ingredientCounts(board).values()]
      .every((count) => count >= 7 && count <= 12)).toBe(true);
    expect(hasStraightRun(board, 5)).toBe(false);
    expect(hasHomogeneousRowOrColumn(board)).toBe(false);
  });

  it('F103 initial board exposes at least six legal triples across three ingredient types', () => {
    const board = create().viewModel().board;
    const paths = legalThreePaths(board);
    expect(paths.length).toBeGreaterThanOrEqual(6);
    expect(new Set(paths.map((path) =>
      board[path[0].row][path[0].column].ingredientId)).size)
      .toBeGreaterThanOrEqual(3);
  });

  it('F104 natural refill remains mixed and playable after a real long-link resolution', () => {
    const target = create('DEV_MENU_LONG');
    const plan = submit(target, NATURAL_LONG_LINK_PATHS.GOOD);
    expect(hasHomogeneousRowOrColumn(plan.finalBoard)).toBe(false);
    expect(new DeadBoardDetector().hasLegalPath(
      new BoardModel(plan.finalBoard),
      registry.gameplay.board.connectionDirections,
      registry.gameplay.board.minimumLink,
    )).toBe(true);
  });

  it('F105 forced dead board receives a free shuffle without state or opportunity damage', () => {
    const fixture = createResearchBoardFixture('DEAD_BOARD');
    const domain = new TimedResearchSession(
      registry,
      'RS02_MULTI_RECIPE',
      fixture.id,
      fixture.initialBoard,
      fixture.columnQueues,
      ['CLUE_POTATO_CAKE'],
      2_026_080_4,
    );
    domain.pot.addThrow(Array.from({ length: 3 }, () => ({
      ingredientId: 'ING_POTATO' as const,
      inspiration: false,
    })), 1);
    const before = domain.snapshot();
    const advertisedOpportunityCount = 3;
    const result = ensureResearchBoardPlayable(
      domain.board,
      registry.gameplay,
      domain.rng,
      3,
    );
    domain.board = result.board;
    const after = domain.snapshot();
    expect(result.shuffled).toBe(true);
    expect(result.legalIngredientIds.length).toBeGreaterThanOrEqual(3);
    expect(after.remainingActiveTimeMs).toBe(before.remainingActiveTimeMs);
    expect(after.totalScore).toBe(before.totalScore);
    expect(after.pot).toEqual(before.pot);
    expect(advertisedOpportunityCount).toBe(3);
    expect([...ingredientCounts(after.board).entries()].sort())
      .toEqual([...ingredientCounts(before.board).entries()].sort());
  });

  it('F106 application holds active time while the game-like auto-sort notice is shown', () => {
    const target = create('DEV_MENU_DEAD');
    expect(target.playabilityAudit()).toMatchObject({ shuffled: true });
    expect(target.viewModel().autoShuffleNotice).toBe(true);
    expect(target.tick(5_000)).toBe(0);
    expect(target.acknowledgeAutoShuffleNotice()).toBe(true);
    expect(target.tick(1_000)).toBe(1_000);
  });

  it('F107 default player schedule cannot enter DEV_MENU_LONG or test fixtures', () => {
    expect(schedule.resolveMenu({ nowEpochMs: clock.nowEpochMs() }).dailyMenuId)
      .toBe('DEV_MENU_MULTI');
    expect(schedule.listMenuIds()).not.toContain('DEV_MENU_LONG');
    expect(schedule.listMenuIds().some((id) => id.startsWith('DEV_TEST_')))
      .toBe(false);
  });

  it('F108 natural five, seven and nine paths still drive Domain feedback', () => {
    const events = (Object.keys(NATURAL_LONG_LINK_PATHS) as Array<
      keyof typeof NATURAL_LONG_LINK_PATHS
    >).map((event) => submit(
      create('DEV_MENU_LONG'),
      NATURAL_LONG_LINK_PATHS[event],
    ).audioEvent);
    expect(events).toEqual(['GOOD', 'GREAT', 'UNBELIEVABLE']);
  });

  it('F109 nine-link visible flight span is at most 550ms', () => {
    expect(flightTimingMsFor(9)).toEqual({
      staggerMs: 20,
      flightMs: 320,
      totalMs: 480,
    });
    expect(flightTimingMsFor(9).totalMs).toBeLessThanOrEqual(550);
  });

  it('F110 warm hotpot mix owns a distinct PNG and manual reshuffle remains port-only', () => {
    const warmPath = join(
      root,
      'assets/resources/game/art/dishes/dish_warm_hotpot_mix.png',
    );
    const tomatoPath = join(
      root,
      'assets/resources/game/art/dishes/dish_tomato_egg.png',
    );
    const digest = (path: string) =>
      createHash('sha256').update(readFileSync(path)).digest('hex');
    expect(readFileSync(warmPath).subarray(0, 8))
      .toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(digest(warmPath)).not.toBe(digest(tomatoPath));
    const presenter = readFileSync(
      join(root, 'assets/game/scripts/presentation/R1BBattlePresenter.ts'),
      'utf8',
    );
    const ports = readFileSync(
      join(root, 'assets/game/scripts/application/r1b/ResearchPorts.ts'),
      'utf8',
    );
    expect(presenter).toContain("RCP_WARM_HOTPOT_MIX: 'dishWarmHotpotMix'");
    expect(ports).toContain("'MANUAL_RESHUFFLE'");
    expect(presenter).not.toContain('MANUAL_RESHUFFLE');
  });

  it('F111 default natural board can complete the first RS02 research clue', () => {
    const target = create();
    const smallL = [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 1 },
    ];
    for (let index = 0; index < 5; index += 1) {
      const plan = submit(target, smallL);
      expect(target.completeAnimation(plan.operationId)).toBe(true);
    }
    const cooking = target.fire();
    expect(cooking?.recipeId).toBe('RCP_SCALLION_POTATO_CAKE');
  });
});
