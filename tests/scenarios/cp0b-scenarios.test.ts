import { describe, expect, it } from 'vitest';
import { PrototypeTestRunner } from '../../src/cp0b/scenario.js';
import type { DiscoveryState } from '../../src/cp0b/types.js';
import { registry } from '../helpers.js';

const runner = new PrototypeTestRunner(registry);

describe('CP0-B deterministic scenarios', () => {
  it('S01 O1番茄5连＋鸡蛋4连生成番茄炒蛋，剩5步', () => {
    const run = runner.run('O1_TUTORIAL_001');
    expect(run.finalRecipeId).toBe('RCP_TOMATO_EGG');
    expect(run.finalSnapshot.remainingSteps).toBe(5);
    expect(run.fireResults[0].orderResult).toBe('SUCCESS');
  });

  it('S02 O2_STANDARD生成香葱土豆饼，剩5步', () => {
    const run = runner.run('O2_STANDARD');
    expect(run.finalRecipeId).toBe('RCP_SCALLION_POTATO_CAKE');
    expect(run.finalSnapshot.remainingSteps).toBe(5);
    expect(run.fireResults[0].orderResult).toBe('SUCCESS');
  });

  it('S03 O2_BLACK第一锅生成黏糊番茄薯团，剩5步', () => {
    const run = runner.run('O2_BLACK');
    expect(run.fireResults[0].recipeId).toBe('RCP_CHARRED_TOMATO_POTATO_BALL');
    expect(run.actions.find((action) => action.recipeId === 'RCP_CHARRED_TOMATO_POTATO_BALL')
      ?.after.remainingSteps).toBe(5);
    expect(run.fireResults[0].orderResult).toBe('CONTINUE_AFTER_REVEAL');
  });

  it('S04 O2_BLACK清锅后继续生成订单目标，剩2步', () => {
    const run = runner.run('O2_BLACK');
    expect(run.fireResults[1].recipeId).toBe('RCP_SCALLION_POTATO_CAKE');
    expect(run.finalSnapshot.remainingSteps).toBe(2);
    expect(run.fireResults[1].orderResult).toBe('SUCCESS');
  });

  it('S05 O3_STANDARD生成田园菌菇汤，剩5步', () => {
    const run = runner.run('O3_STANDARD');
    expect(run.finalRecipeId).toBe('RCP_GARDEN_MUSHROOM_SOUP');
    expect(run.finalSnapshot.remainingSteps).toBe(5);
    expect(run.fireResults[0].orderResult).toBe('SUCCESS');
  });

  it('S06 O3_INSPIRATION灵感固定在r2c4，后续3格加入4单位', () => {
    const run = runner.run('O3_INSPIRATION');
    expect(run.actions[0].inspirationAt).toBe('r2c4');
    expect(run.actions[0].after.potUnits.ING_MUSHROOM).toBe(7);
    expect(run.actions[1].after.usedThrowSlots).toBe(2);
    expect(run.actions[1].after.potUnits.ING_MUSHROOM
      - run.actions[1].before.potUnits.ING_MUSHROOM).toBe(4);
  });

  it('S07 O3_INSPIRATION第一锅生成星辉菌菇蛋盅，剩5步', () => {
    const run = runner.run('O3_INSPIRATION');
    expect(run.fireResults[0].recipeId).toBe('RCP_STAR_MUSHROOM_EGG_CUP');
    expect(run.actions.find((action) => action.recipeId === 'RCP_STAR_MUSHROOM_EGG_CUP')
      ?.after.remainingSteps).toBe(5);
    expect(run.fireResults[0].orderResult).toBe('CONTINUE_AFTER_REVEAL');
  });

  it('S08 O3_INSPIRATION清锅后继续生成订单目标，剩2步', () => {
    const run = runner.run('O3_INSPIRATION');
    expect(run.fireResults[1].recipeId).toBe('RCP_GARDEN_MUSHROOM_SOUP');
    expect(run.finalSnapshot.remainingSteps).toBe(2);
    expect(run.fireResults[1].orderResult).toBe('SUCCESS');
  });

  it('S09 O3_INSPIRATION重跑时首次提示不重复且料理不变', () => {
    const discovery: DiscoveryState = {
      tutorialFlags: { inspirationUnitHintShown: false },
      discoveredRecipeIds: [],
      bestStarsByRecipe: {},
      firstResearchRecordIds: [],
    };
    const first = runner.run('O3_INSPIRATION', discovery);
    const second = runner.run('O3_INSPIRATION', discovery);
    expect(first.actions[0].inspirationHintShown).toBe(true);
    expect(second.actions[0].inspirationHintShown).toBe(false);
    expect(second.fireResults.map((result) => result.recipeId))
      .toEqual(first.fireResults.map((result) => result.recipeId));
  });
});
