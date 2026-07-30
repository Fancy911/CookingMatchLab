import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PrototypeSession } from '../../assets/game/scripts/application/cp0c/PrototypeSession';
import { DiscoveryModel } from '../../assets/game/scripts/domain/cp0b/core';
import type { BoardGrid, Coord } from '../../assets/game/scripts/domain/cp0b/types';
import { stableHash } from '../../assets/game/scripts/domain/cp0b/stable';
import {
  assertC1ConfigHash,
  C1_SCENARIO_IDS,
  registryFromDocuments,
} from '../../assets/game/scripts/infrastructure/JsonConfigAdapter';
import {
  LocalSaveRepository,
  type StoragePort,
} from '../../assets/game/scripts/infrastructure/LocalSaveRepository';
import {
  defaultConfigDirectory,
  loadConfigRegistry,
} from '../../tools/cp0b/NodeConfigLoader';

const tomatoFive: Coord[] = [
  { row: 0, column: 0 },
  { row: 0, column: 1 },
  { row: 1, column: 1 },
  { row: 1, column: 2 },
  { row: 2, column: 2 },
];
const tomatoThree: Coord[] = tomatoFive.slice(0, 3);
const eggFour: Coord[] = [
  { row: 6, column: 3 },
  { row: 6, column: 4 },
  { row: 6, column: 5 },
  { row: 6, column: 6 },
];

const commit = (session: PrototypeSession, path: Coord[]) => {
  session.beginLink(path[0]);
  path.slice(1).forEach((coord) => session.extendLink(coord));
  const result = session.commitLink();
  if (result.plan) {
    session.completeAnimation(result.plan.operationId);
  }
  return result;
};

const findPath = (board: BoardGrid, length: number): Coord[] => {
  const directions = [-1, 0, 1].flatMap((row) =>
    [-1, 0, 1].map((column) => ({ row, column })))
    .filter(({ row, column }) => row !== 0 || column !== 0);
  const walk = (path: Coord[]): Coord[] | undefined => {
    if (path.length === length) {
      return path;
    }
    const last = path[path.length - 1];
    const ingredient = board[last.row][last.column].ingredientId;
    for (const direction of directions) {
      const next = {
        row: last.row + direction.row,
        column: last.column + direction.column,
      };
      if (!board[next.row]?.[next.column]
        || board[next.row][next.column].ingredientId !== ingredient
        || path.some((coord) => coord.row === next.row && coord.column === next.column)) {
        continue;
      }
      const found = walk([...path, next]);
      if (found) {
        return found;
      }
    }
    return undefined;
  };
  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      const result = walk([{ row, column }]);
      if (result) {
        return result;
      }
    }
  }
  throw new Error(`No ${length}-cell path found`);
};

describe('CP0-C-C1 acceptance', () => {
  it('C001 loads the same validated config tree through the portable adapter', () => {
    const directory = defaultConfigDirectory();
    const read = (name: string) =>
      JSON.parse(readFileSync(join(directory, name), 'utf8')) as unknown;
    const adapterRegistry = registryFromDocuments({
      gameplay: read('gameplay.json'),
      ingredients: read('ingredients.json'),
      recipes: read('recipes.json'),
      orders: read('orders.json'),
      tutorials: read('tutorials.json'),
      scenarios: Object.fromEntries(C1_SCENARIO_IDS.map((id) => [
        id,
        read(join('scenarios', `${id}.json`)),
      ])),
    });
    const nodeRegistry = loadConfigRegistry(directory);
    assertC1ConfigHash(adapterRegistry);
    expect(adapterRegistry.configHash).toBe('8737fa94');
    expect(stableHash(adapterRegistry.scenarios)).toBe(stableHash(nodeRegistry.scenarios));
    expect(stableHash(adapterRegistry.recipes)).toBe(stableHash(nodeRegistry.recipes));
  });

  it('C002 cancels a two-cell link without state or effect plan', () => {
    const session = new PrototypeSession(loadConfigRegistry());
    const before = session.snapshot();
    session.beginLink(tomatoFive[0]);
    session.extendLink(tomatoFive[1]);
    const result = session.commitLink();
    expect(result.accepted).toBe(false);
    expect(result.plan).toBeUndefined();
    expect(session.snapshot()).toEqual(before);
  });

  it('C003 builds the deterministic tomato-five effect plan', () => {
    const session = new PrototypeSession(loadConfigRegistry());
    const result = commit(session, tomatoFive);
    expect(result.accepted).toBe(true);
    expect(result.plan).toMatchObject({
      ingredientId: 'ING_TOMATO',
      path: tomatoFive,
      flightOrder: tomatoFive,
      throwSlotIndex: 0,
      throwRecord: { units: 5, pathLength: 5 },
      remainingSteps: 6,
      canFire: false,
      potFull: false,
    });
    expect(result.plan!.refillMoves).toHaveLength(5);
  });

  it('C004 makes the effect plan final board hash equal the Domain snapshot', () => {
    const session = new PrototypeSession(loadConfigRegistry());
    const result = commit(session, tomatoFive);
    expect(result.plan!.finalBoardHash).toBe(session.snapshot().boardHash);
    expect(stableHash(result.plan!.finalBoard)).toBe(session.snapshot().boardHash);
  });

  it('C005 enables fire after two throws with exact 5/4 units', () => {
    const session = new PrototypeSession(loadConfigRegistry());
    commit(session, tomatoFive);
    const second = commit(session, eggFour);
    expect(second.plan).toMatchObject({ throwSlotIndex: 1, canFire: true, potFull: false });
    expect(session.snapshot().pot.units).toEqual({ ING_TOMATO: 5, ING_EGG: 4 });
    expect(session.snapshot().remainingSteps).toBe(5);
  });

  it('C006 fires the target tomato egg recipe with three stars and success', () => {
    const session = new PrototypeSession(loadConfigRegistry());
    commit(session, tomatoFive);
    commit(session, eggFour);
    const result = session.fire();
    expect(result).toMatchObject({
      recipeId: 'RCP_TOMATO_EGG',
      stars: 3,
      isNewDiscovery: true,
      orderResult: 'SUCCESS',
    });
    expect(session.phase).toBe('COOKING');
    expect(session.completeCooking(session.currentOperationId())).toBe(true);
    expect(session.phase).toBe('REVEAL');
  });

  it('C007 accepts a third throw but never auto-fires', () => {
    const session = new PrototypeSession(loadConfigRegistry());
    commit(session, tomatoFive);
    commit(session, eggFour);
    const thirdPath = findPath(session.snapshot().board, 3);
    const third = commit(session, thirdPath);
    expect(third.accepted).toBe(true);
    expect(third.plan).toMatchObject({ throwSlotIndex: 2, canFire: true, potFull: true });
    expect(session.fireResult).toBeUndefined();
    expect(session.snapshot().orderResult).toBe('IN_PROGRESS');
    expect(session.phase).toBe('POT_REVIEW');
  });

  it('C008 continues after warm hotpot reveal without mutating board, queues, or steps', () => {
    const session = new PrototypeSession(loadConfigRegistry());
    commit(session, tomatoThree);
    commit(session, eggFour);
    const beforeFire = session.snapshot();
    expect(session.fire()).toMatchObject({
      recipeId: 'RCP_WARM_HOTPOT_MIX',
      orderResult: 'CONTINUE_AFTER_REVEAL',
    });
    session.completeCooking(session.currentOperationId());
    const result = session.continueAfterReveal();
    const after = session.snapshot();
    expect(result).toMatchObject({
      boardHash: beforeFire.boardHash,
      remainingSteps: 5,
      orderResult: 'IN_PROGRESS',
    });
    expect(stableHash(after.queueCursors)).toBe(stableHash(beforeFire.queueCursors));
    expect(after.pot.throws).toEqual([]);
    expect(after.pot.units).toEqual({});
  });

  it('C009 persists only allowed discovery and best stars, never active-order state', () => {
    const values = new Map<string, string>();
    const storage: StoragePort = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const repository = new LocalSaveRepository(storage);
    const session = new PrototypeSession(loadConfigRegistry());
    commit(session, tomatoFive);
    commit(session, eggFour);
    session.fire();
    const saved = repository.saveDiscovery(session.snapshot().discovery);
    expect(saved).toEqual({
      schemaVersion: 1,
      discoveredRecipeIds: ['RCP_TOMATO_EGG'],
      bestStarsByRecipe: { RCP_TOMATO_EGG: 3 },
    });
    expect(JSON.stringify(saved)).not.toContain('remainingSteps');
    expect(JSON.stringify(saved)).not.toContain('board');
    const reloadedRepository = new LocalSaveRepository(storage);
    expect(reloadedRepository.load()).toEqual(saved);
    const refreshed = new PrototypeSession(
      loadConfigRegistry(),
      0x43503042,
      new DiscoveryModel(reloadedRepository.loadDiscoveryState()),
    );
    expect(refreshed.snapshot().remainingSteps).toBe(7);
    expect(refreshed.snapshot().pot.throws).toEqual([]);
    expect(refreshed.snapshot().discovery.bestStarsByRecipe.RCP_TOMATO_EGG).toBe(3);
  });

  it('C010 ignores duplicate animation/cooking callbacks and saves once', () => {
    const session = new PrototypeSession(loadConfigRegistry());
    session.beginLink(tomatoFive[0]);
    tomatoFive.slice(1).forEach((coord) => session.extendLink(coord));
    const first = session.commitLink();
    expect(session.commitLink().accepted).toBe(false);
    expect(session.completeAnimation(first.plan!.operationId)).toBe(true);
    expect(session.completeAnimation(first.plan!.operationId)).toBe(false);
    commit(session, eggFour);
    session.fire();
    const cookingOperation = session.currentOperationId();
    expect(session.fire()).toBeUndefined();
    expect(session.completeCooking(cookingOperation)).toBe(true);
    expect(session.completeCooking(cookingOperation)).toBe(false);

    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };
    const repository = new LocalSaveRepository(storage);
    repository.saveDiscovery(session.snapshot().discovery);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('C011 cancels an uncommitted link when pausing without mutating run state', () => {
    const readySession = new PrototypeSession(loadConfigRegistry());
    const readyBefore = readySession.snapshot();
    readySession.beginLink(tomatoFive[0]);
    readySession.extendLink(tomatoFive[1]);
    readySession.extendLink(tomatoFive[2]);
    expect(readySession.phase).toBe('LINKING');
    expect(readySession.activePath()).toHaveLength(3);
    expect(readySession.pause()).toBe(true);
    expect(readySession.phase).toBe('PAUSED');
    expect(readySession.activePath()).toEqual([]);
    expect(readySession.snapshot()).toEqual(readyBefore);
    expect(readySession.resume()).toBe(true);
    expect(readySession.phase).toBe('READY');

    const potSession = new PrototypeSession(loadConfigRegistry());
    commit(potSession, tomatoFive);
    const potBefore = potSession.snapshot();
    const path = findPath(potBefore.board, 3);
    potSession.beginLink(path[0]);
    path.slice(1).forEach((coord) => potSession.extendLink(coord));
    expect(potSession.phase).toBe('LINKING');
    expect(potSession.pause()).toBe(true);
    expect(potSession.activePath()).toEqual([]);
    expect(potSession.snapshot()).toEqual(potBefore);
    expect(potSession.resume()).toBe(true);
    expect(potSession.phase).toBe('POT_REVIEW');
    expect(stableHash(potSession.snapshot())).toBe(stableHash(potBefore));
  });
});
