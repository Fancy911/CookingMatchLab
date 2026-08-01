import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BoardModel,
  CookingHistoryModel,
  PathValidator,
  R0PotModel,
  R0RecipeResolver,
  R0StarCalculator,
  TimedResearchSession,
  calculateR0LinkScore,
  comboMultiplierFor,
  migrateSaveV1ToV2,
  processingLevelFor,
} from '../../assets/game/scripts/domain/cp0b/core';
import { deepClone, stableHash } from '../../assets/game/scripts/domain/cp0b/stable';
import type {
  Cell,
  CookingHistoryState,
  IngredientId,
  IngredientUnits,
  R0CookResult,
  R0ScenarioConfig,
  SaveDataV1,
} from '../../assets/game/scripts/domain/cp0b/types';
import { R0ConfigRegistry } from '../../assets/game/scripts/application/cp0c/R0ConfigRegistry';
import {
  defaultR0ConfigDirectory,
  loadR0ConfigRegistry,
} from '../../tools/cp0b/R0NodeConfigLoader';
import { runR0ScenarioCase } from './helpers';

const registry = loadR0ConfigRegistry();
const cells = (
  ingredientId: IngredientId,
  count: number,
  inspirationAt: number[] = [],
): Cell[] => Array.from({ length: count }, (_unused, index) => ({
  ingredientId,
  inspiration: inspirationAt.includes(index),
}));
const scenario = (id: R0ScenarioConfig['id']): R0ScenarioConfig =>
  registry.scenarioById.get(id)!;

const simpleSession = (pathIngredient: IngredientId = 'ING_TOMATO'): TimedResearchSession => {
  const symbol = registry.ingredientById.get(pathIngredient)!.symbol;
  const board = Array.from({ length: 7 }, () => Array(7).fill(symbol) as string[]);
  const queues = Object.fromEntries(Array.from({ length: 7 }, (_unused, column) => [
    String(column),
    Array.from({ length: 40 }, () => symbol),
  ]));
  return new TimedResearchSession(
    registry,
    'UNIT',
    'SIMPLE',
    board,
    queues,
    ['CLUE_TOMATO_EGG_A'],
    12345,
  );
};

describe('CP0-R0 R001-R024', () => {
  it('R001 3/5/7/9连均只增加1份', () => {
    [3, 5, 7, 9].forEach((length) => {
      const pot = new R0PotModel(registry.gameplay);
      const result = pot.addThrow(cells('ING_TOMATO', length), 1);
      expect(result.units).toBe(1);
      expect(pot.units).toEqual({ ING_TOMATO: 1 });
    });
  });

  it('R002 无效短连不改变任何真值或RNG', () => {
    const target = simpleSession();
    const before = target.snapshot();
    const hashBefore = target.hash();
    expect(target.commitLink([{ row: 0, column: 0 }, { row: 0, column: 1 }]).committed)
      .toBe(false);
    expect(target.snapshot()).toEqual(before);
    expect(target.hash()).toBe(hashBefore);
  });

  it('R003 4份可开火，6份进入满锅自动开火准备', () => {
    const pot = new R0PotModel(registry.gameplay);
    for (let index = 0; index < 4; index += 1) {
      pot.addThrow(cells('ING_TOMATO', 3), index + 1);
    }
    expect(pot.canFire()).toBe(true);
    expect(pot.isFull()).toBe(false);
    pot.addThrow(cells('ING_EGG', 3), 5);
    pot.addThrow(cells('ING_EGG', 3), 6);
    expect(pot.isFull()).toBe(true);
    const target = simpleSession();
    for (let index = 0; index < 6; index += 1) {
      target.commitLink([{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }]);
      target.completeAnimation();
    }
    expect(target.phase).toBe('AUTO_FIRE_READY');
    expect(target.eventLog).toContain('POT_FULL_AUTO_FIRE_READY');
  });

  it('R004 90秒只由显式有效操作时钟推进', () => {
    const target = simpleSession();
    expect(target.remainingActiveTimeMs).toBe(90_000);
    expect(target.advanceActiveTime(1_250)).toBe(1_250);
    expect(target.remainingActiveTimeMs).toBe(88_750);
    target.commitLink([{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }]);
    expect(target.phase).toBe('ANIMATING');
    expect(target.advanceActiveTime(5_000)).toBe(0);
    expect(target.remainingActiveTimeMs).toBe(88_750);
  });

  it('R005 时间归零时当前连线拥有显式1秒宽限', () => {
    const withinGrace = simpleSession();
    withinGrace.beginLink();
    withinGrace.advanceActiveTime(90_000);
    expect(withinGrace.phase).toBe('TIMEOUT_GRACE');
    expect(withinGrace.graceRemainingMs).toBe(1_000);
    withinGrace.advanceGraceTime(999);
    const result = withinGrace.commitLink([
      { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 },
    ]);
    expect(result.committed).toBe(true);
    withinGrace.completeAnimation();
    expect(withinGrace.phase).toBe('PARTIAL_RESULT');

    const expired = simpleSession();
    expired.beginLink();
    expired.advanceActiveTime(90_000);
    expired.advanceGraceTime(1_000);
    expect(expired.phase).toBe('SUMMARY');
    expect(expired.snapshot().pot.throws).toHaveLength(0);
  });

  it('R006 四档连线分和AudioEvent严格匹配配置', () => {
    const cases = [
      [3, 'NORMAL', 30, undefined],
      [5, 'PRECISE', 80, 'GOOD'],
      [7, 'INSPIRATION', 150, 'GREAT'],
      [9, 'MASTER', 240, 'UNBELIEVABLE'],
    ] as const;
    cases.forEach(([length, level, score, audio]) => {
      expect(processingLevelFor(registry.gameplay, length)).toBe(level);
      expect(calculateR0LinkScore(registry.gameplay, length, false, 1)).toBe(score);
      expect(registry.gameplay.longLink.audioEvents[level]).toBe(audio);
    });
  });

  it('R007 连击窗口和倍率边界正确', () => {
    const expected = new Map([
      [1, 1], [2, 1], [3, 1.2], [4, 1.2], [5, 1.5],
      [6, 1.5], [7, 2], [9, 2], [10, 3], [20, 3],
    ]);
    expected.forEach((multiplier, count) =>
      expect(comboMultiplierFor(registry.gameplay, count)).toBe(multiplier));
    const target = simpleSession();
    target.commitLink([{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }]);
    target.completeAnimation();
    target.advanceActiveTime(3_000);
    target.commitLink([{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }]);
    expect(target.comboCount).toBe(2);
    target.completeAnimation();
    target.advanceActiveTime(3_001);
    target.commitLink([{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }]);
    expect(target.comboCount).toBe(1);
  });

  it('R008 演出、揭晓和暂停等非有效状态不消耗时间', () => {
    const target = simpleSession();
    target.commitLink([{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }]);
    const before = target.remainingActiveTimeMs;
    expect(target.advanceActiveTime(10_000)).toBe(0);
    expect(target.remainingActiveTimeMs).toBe(before);
    target.completeAnimation();
    target.phase = 'PAUSED';
    expect(target.advanceActiveTime(10_000)).toBe(0);
    target.phase = 'SHUFFLING';
    expect(target.advanceActiveTime(10_000)).toBe(0);
  });

  it('R009 灵感格只投1份并写入INSPIRATION标签', () => {
    const pot = new R0PotModel(registry.gameplay);
    const result = pot.addThrow(cells('ING_MUSHROOM', 3, [2]), 1);
    expect(result.units).toBe(1);
    expect(pot.units).toEqual({ ING_MUSHROOM: 1 });
    expect(pot.tags.has('INSPIRATION')).toBe(true);
    expect(result.processingScore).toBe(70);
  });

  it('R010 六道配方标准输入得到唯一正确料理', () => {
    const resolver = new R0RecipeResolver(registry.recipes);
    const cases: Array<[IngredientUnits, Array<'INSPIRATION' | 'MASTER'>, string]> = [
      [{ ING_TOMATO: 2, ING_EGG: 2, ING_SCALLION: 1 }, [], 'RCP_TOMATO_EGG'],
      [{ ING_POTATO: 3, ING_EGG: 1, ING_SCALLION: 1 }, [], 'RCP_SCALLION_POTATO_CAKE'],
      [{ ING_MUSHROOM: 2, ING_CARROT: 1, ING_POTATO: 1, ING_SCALLION: 1 }, [], 'RCP_GARDEN_MUSHROOM_SOUP'],
      [{ ING_TOMATO: 1, ING_EGG: 1, ING_POTATO: 1, ING_CARROT: 1 }, [], 'RCP_WARM_HOTPOT_MIX'],
      [{ ING_TOMATO: 2, ING_POTATO: 2, ING_MUSHROOM: 1 }, [], 'RCP_CHARRED_TOMATO_POTATO_BALL'],
      [{ ING_MUSHROOM: 3, ING_EGG: 2 }, ['INSPIRATION'], 'RCP_STAR_MUSHROOM_EGG_CUP'],
    ];
    cases.forEach(([units, tags, recipeId]) =>
      expect(resolver.resolve(units, tags).id).toBe(recipeId));
  });

  it('R011 4～6份全量枚举无重叠、无空结果且稳定', () => {
    const resolver = new R0RecipeResolver(registry.recipes);
    const ids = [...registry.ingredientById.keys()];
    const tagStates: Array<Array<'INSPIRATION' | 'MASTER'>> = [
      [], ['INSPIRATION'], ['MASTER'], ['INSPIRATION', 'MASTER'],
    ];
    let total = 0;
    let conflicts = 0;
    let empty = 0;
    const units: IngredientUnits = {};
    const enumerate = (index: number, remaining: number): void => {
      if (index === ids.length - 1) {
        units[ids[index]] = remaining;
        tagStates.forEach((tags) => {
          total += 1;
          const matches = resolver.matchingExplicit(units, tags);
          conflicts += matches.length > 1 ? 1 : 0;
          const first = resolver.resolve(units, tags);
          const second = resolver.resolve(deepClone(units), [...tags]);
          empty += first ? 0 : 1;
          expect(stableHash(first)).toBe(stableHash(second));
        });
        return;
      }
      for (let amount = 0; amount <= remaining; amount += 1) {
        units[ids[index]] = amount;
        enumerate(index + 1, remaining - amount);
      }
    };
    [4, 5, 6].forEach((sum) => enumerate(0, sum));
    expect(total).toBe(3_360);
    expect(conflicts).toBe(0);
    expect(empty).toBe(0);
  });

  it('R012 星级公式正确且暖锅最高2星', () => {
    const calculator = new R0StarCalculator(registry.gameplay);
    const explicit = registry.recipeById.get('RCP_TOMATO_EGG')!;
    expect(calculator.calculate(explicit, 60)).toEqual({
      stars: 2,
      qualityScore: 84,
      recipeAccuracyScore: 100,
      processingScore: 60,
    });
    expect(calculator.calculate(explicit, 100).stars).toBe(3);
    const fallback = registry.recipeById.get('RCP_WARM_HOTPOT_MIX')!;
    expect(calculator.calculate(fallback, 100)).toEqual({
      stars: 2,
      qualityScore: 70,
      recipeAccuracyScore: 50,
      processingScore: 100,
    });
  });

  it('R013 研究线索不改变料理身份和星级', () => {
    const resolver = new R0RecipeResolver(registry.recipes);
    const calculator = new R0StarCalculator(registry.gameplay);
    const units = { ING_TOMATO: 2, ING_EGG: 2, ING_SCALLION: 1 };
    const recipe = resolver.resolve(units, []);
    const first = calculator.calculate(recipe, 80);
    const second = calculator.calculate(resolver.resolve(units, []), 80);
    expect(recipe.id).toBe('RCP_TOMATO_EGG');
    expect(first).toEqual(second);
  });

  it('R014 同菜可在一局重复生成并从1计数到2', () => {
    const run = runR0ScenarioCase(
      registry,
      scenario('RS01_TUTORIAL_REPEAT'),
      scenario('RS01_TUTORIAL_REPEAT').cases[0],
    );
    expect(run.session.snapshot().cookResults.map((result) => result.recipeId))
      .toEqual(['RCP_TOMATO_EGG', 'RCP_TOMATO_EGG']);
    expect(run.session.history.state.sessionCookCounts.RCP_TOMATO_EGG).toBe(2);
    expect(run.session.snapshot().cookResults.map((result) => result.isNewDiscovery))
      .toEqual([true, false]);
  });

  it('R015 cookResultId重复提交不会二次累计', () => {
    const history = new CookingHistoryModel();
    const result: R0CookResult = {
      cookResultId: 'fixed-result',
      recipeId: 'RCP_TOMATO_EGG',
      stars: 2,
      qualityScore: 84,
      dishScore: 1_700,
      isNewDiscovery: true,
      matchedResearchClue: true,
      tags: [],
    };
    expect(history.record(result)).toBe(true);
    const once = history.snapshot();
    expect(history.record({ ...result, dishScore: 9_999 })).toBe(false);
    expect(history.snapshot()).toEqual(once);
  });

  it('R016 多锅只清锅并保留棋盘、队列、总分、连击和时间', () => {
    const config = scenario('RS02_MULTI_RECIPE');
    const testCase = config.cases[0];
    const target = new TimedResearchSession(
      registry,
      config.id,
      testCase.id,
      testCase.initialBoard,
      testCase.columnQueues,
      testCase.researchClueQueue,
      config.seed,
    );
    target.advanceActiveTime(2_500);
    for (let index = 0; index < 5; index += 1) {
      const action = testCase.actions[index + 1];
      if (action.type !== 'LINK') throw new Error('fixture');
      target.commitLink(action.path.map(([row, column]) => ({ row, column })));
      target.completeAnimation();
    }
    const beforeFire = target.snapshot();
    target.fire();
    const beforeReveal = target.snapshot();
    target.completeReveal();
    const after = target.snapshot();
    expect(after.pot.throws).toEqual([]);
    expect(after.boardHash).toBe(beforeFire.boardHash);
    expect(after.queueCursors).toEqual(beforeFire.queueCursors);
    expect(after.remainingActiveTimeMs).toBe(beforeFire.remainingActiveTimeMs);
    expect(after.comboCount).toBe(beforeFire.comboCount);
    expect(after.totalScore).toBe(beforeReveal.totalScore);
  });

  it('R017 每道正式料理后研究线索确定推进', () => {
    const run = runR0ScenarioCase(
      registry,
      scenario('RS02_MULTI_RECIPE'),
      scenario('RS02_MULTI_RECIPE').cases[0],
    );
    expect(run.session.researchClueIndex).toBe(2);
    expect(run.session.snapshot().currentResearchClueId).toBe('CLUE_POTATO_CAKE');
  });

  it('R018 1～3份超时只生成半成品且不计制作次数', () => {
    const config = scenario('RS05_TIMER_END');
    const run = runR0ScenarioCase(registry, config, config.cases[1]);
    expect(run.session.phase).toBe('PARTIAL_RESULT');
    expect(run.session.partialResultCount).toBe(1);
    expect(run.session.cookResults).toHaveLength(0);
    expect(run.session.history.state.sessionCookCounts).toEqual({});
  });

  it('R019 时间自动开火与主动开火结果一致', () => {
    const config = scenario('RS05_TIMER_END');
    const testCase = config.cases[0];
    const create = () => new TimedResearchSession(
      registry,
      config.id,
      testCase.id,
      testCase.initialBoard,
      testCase.columnQueues,
      testCase.researchClueQueue,
      config.seed,
    );
    const manual = create();
    const automatic = create();
    const links = testCase.actions.filter((action) => action.type === 'LINK');
    links.forEach((action) => {
      const path = action.path.map(([row, column]) => ({ row, column }));
      manual.commitLink(path);
      automatic.commitLink(path);
      manual.completeAnimation();
      automatic.completeAnimation();
    });
    const manualResult = manual.fire();
    automatic.advanceActiveTime(90_000);
    const autoResult = automatic.confirmAutoFire();
    expect({
      recipeId: autoResult.recipeId,
      stars: autoResult.stars,
      qualityScore: autoResult.qualityScore,
      dishScore: autoResult.dishScore,
    }).toEqual({
      recipeId: manualResult.recipeId,
      stars: manualResult.stars,
      qualityScore: manualResult.qualityScore,
      dishScore: manualResult.dishScore,
    });
  });

  it('R020 同配置、seed、时间脚本和操作得到同hash', () => {
    const config = scenario('RS04_INSPIRATION');
    const first = runR0ScenarioCase(registry, config, config.cases[0]).session;
    const second = runR0ScenarioCase(registry, config, config.cases[0]).session;
    expect(first.hash()).toBe(second.hash());
  });

  it('R021 缺字段、非法配方和非法时间在加载阶段明确失败', () => {
    const directory = defaultR0ConfigDirectory();
    const read = (name: string) =>
      JSON.parse(readFileSync(join(directory, name), 'utf8')) as unknown;
    const base = {
      gameplay: read('gameplay.json'),
      ingredients: read('ingredients.json'),
      recipes: read('recipes.json'),
      orders: read('orders.json'),
      tutorials: read('tutorials.json'),
      scenarios: registry.scenarios.map(deepClone),
    };
    const missing = deepClone(base) as typeof base;
    delete (missing.gameplay as Record<string, unknown>).session;
    expect(() => R0ConfigRegistry.fromRaw(missing)).toThrow(/gameplay\.session/);
    const badTime = deepClone(base) as typeof base;
    ((badTime.gameplay as Record<string, unknown>).session as Record<string, unknown>)
      .activeTimeMs = -1;
    expect(() => R0ConfigRegistry.fromRaw(badTime)).toThrow(/activeTimeMs/);
    const badRecipe = deepClone(base) as typeof base;
    const recipeRoot = badRecipe.recipes as { recipes: Array<Record<string, unknown>> };
    recipeRoot.recipes[0].required = { ING_TOMATO: 2, ING_UNKNOWN: 3 };
    expect(() => R0ConfigRegistry.fromRaw(badRecipe)).toThrow(/ING_UNKNOWN/);
  });

  it('R022 Domain无cc导入、无Math.random且只有单一规则目录', () => {
    const domainFiles = [
      'assets/game/scripts/domain/cp0b/core.ts',
      'assets/game/scripts/domain/cp0b/types.ts',
      'assets/game/scripts/domain/cp0b/stable.ts',
    ];
    const source = domainFiles.map((path) =>
      readFileSync(join(process.cwd(), path), 'utf8')).join('\n');
    expect(source).not.toMatch(/from\s+['"]cc['"]/);
    expect(source).not.toContain('Math.random(');
    expect(readFileSync(join(process.cwd(), 'tsconfig.cp0b.json'), 'utf8'))
      .toContain('assets/game/scripts/domain/cp0b');
  });

  it('R023 v1存档迁移保留发现与最高星级并安全补默认值', () => {
    const v1: SaveDataV1 = {
      schemaVersion: 1,
      discoveredRecipeIds: ['RCP_TOMATO_EGG', 'RCP_WARM_HOTPOT_MIX'],
      bestStarsByRecipe: {
        RCP_TOMATO_EGG: 3,
        RCP_WARM_HOTPOT_MIX: 2,
      },
      firstResearchRecordIds: ['RCP_TOMATO_EGG'],
      settings: { musicEnabled: false, sfxEnabled: true },
    };
    expect(migrateSaveV1ToV2(v1)).toEqual({
      schemaVersion: 2,
      discoveredRecipeIds: ['RCP_TOMATO_EGG', 'RCP_WARM_HOTPOT_MIX'],
      historicalCookCounts: {
        RCP_TOMATO_EGG: 0,
        RCP_SCALLION_POTATO_CAKE: 0,
        RCP_GARDEN_MUSHROOM_SOUP: 0,
        RCP_WARM_HOTPOT_MIX: 0,
        RCP_CHARRED_TOMATO_POTATO_BALL: 0,
        RCP_STAR_MUSHROOM_EGG_CUP: 0,
      },
      bestStarsByRecipe: {
        RCP_TOMATO_EGG: 3,
        RCP_WARM_HOTPOT_MIX: 2,
      },
      bestDishScoreByRecipe: {
        RCP_TOMATO_EGG: 0,
        RCP_SCALLION_POTATO_CAKE: 0,
        RCP_GARDEN_MUSHROOM_SOUP: 0,
        RCP_WARM_HOTPOT_MIX: 0,
        RCP_CHARRED_TOMATO_POTATO_BALL: 0,
        RCP_STAR_MUSHROOM_EGG_CUP: 0,
      },
      firstResearchRecordIds: ['RCP_TOMATO_EGG'],
      tutorialFlags: { inspirationHintShown: false },
      settings: { musicEnabled: false, sfxEnabled: true, voiceEnabled: true },
      processedCookResultIds: [],
    });
  });

  it('R024 GOOD/GREAT/UNBELIEVABLE事件每次合法提交只发出一次', () => {
    const cases = [
      [5, 'GOOD'],
      [7, 'GREAT'],
      [9, 'UNBELIEVABLE'],
    ] as const;
    cases.forEach(([length, event]) => {
      const target = simpleSession();
      const snake = [
        { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 },
        { row: 0, column: 3 }, { row: 0, column: 4 }, { row: 0, column: 5 },
        { row: 0, column: 6 }, { row: 1, column: 6 }, { row: 1, column: 5 },
      ];
      const path = snake.slice(0, length);
      const beforeCount = target.eventLog.filter((item) => item === event).length;
      expect(target.commitLink(path).committed).toBe(true);
      target.completeAnimation();
      target.snapshot();
      expect(target.eventLog.filter((item) => item === event)).toHaveLength(beforeCount + 1);
    });
  });
});
