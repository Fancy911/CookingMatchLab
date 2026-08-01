import { describe, expect, it } from 'vitest';
import { loadConfigRegistry } from '../../tools/cp0b/NodeConfigLoader';
import { runScenarioCase } from './helpers';

const registry = loadConfigRegistry();

describe('CP0-R0 fixed research sessions RS01-RS05', () => {
  it('RS01_TUTORIAL_REPEAT 同菜重复、计数1→2且首次奖励只发一次', () => {
    const scenario = registry.scenarioById.get('RS01_TUTORIAL_REPEAT')!;
    const run = runScenarioCase(registry, scenario, scenario.cases[0]);
    expect(run.session.cookResults.map((result) => result.recipeId))
      .toEqual(['RCP_TOMATO_EGG', 'RCP_TOMATO_EGG']);
    expect(run.session.cookResults.map((result) => result.isNewDiscovery))
      .toEqual([true, false]);
    expect(run.session.history.state.sessionCookCounts.RCP_TOMATO_EGG).toBe(2);
    expect(run.session.totalScore).toBe(3_392);
  });

  it('RS02_MULTI_RECIPE 多锅保留棋盘队列且线索逐锅推进', () => {
    const scenario = registry.scenarioById.get('RS02_MULTI_RECIPE')!;
    const run = runScenarioCase(registry, scenario, scenario.cases[0]);
    expect(run.session.cookResults.map((result) => result.recipeId)).toEqual([
      'RCP_SCALLION_POTATO_CAKE',
      'RCP_GARDEN_MUSHROOM_SOUP',
    ]);
    expect(run.session.researchClueIndex).toBe(2);
    expect(run.session.totalScore).toBe(4_392);
  });

  it('RS03_DARK 黑暗标签、黑暗加分及后续正常料理计数正确', () => {
    const scenario = registry.scenarioById.get('RS03_DARK')!;
    const run = runScenarioCase(registry, scenario, scenario.cases[0]);
    expect(run.session.cookResults[0].recipeId)
      .toBe('RCP_CHARRED_TOMATO_POTATO_BALL');
    expect(run.session.cookResults[0].tags).toContain('DARK');
    expect(run.session.cookResults[0].dishScore).toBe(2_150);
    expect(run.session.cookResults[1].recipeId).toBe('RCP_TOMATO_EGG');
    expect(run.session.history.state.sessionCookCounts).toEqual({
      RCP_CHARRED_TOMATO_POTATO_BALL: 1,
      RCP_TOMATO_EGG: 1,
    });
  });

  it('RS04_INSPIRATION 7连生成、采集仍1份并完成珍稀料理后续锅', () => {
    const scenario = registry.scenarioById.get('RS04_INSPIRATION')!;
    const run = runScenarioCase(registry, scenario, scenario.cases[0]);
    const linkObservations = run.observations.filter((item) => item.link);
    expect(linkObservations[0].link?.inspirationCoord).toEqual({ row: 0, column: 6 });
    expect(linkObservations[1].link?.throwRecord?.units).toBe(1);
    expect(linkObservations[1].link?.throwRecord?.containsInspiration).toBe(true);
    expect(run.session.cookResults.map((result) => result.recipeId)).toEqual([
      'RCP_STAR_MUSHROOM_EGG_CUP',
      'RCP_TOMATO_EGG',
    ]);
    expect(run.session.history.state.sessionCookCounts.RCP_STAR_MUSHROOM_EGG_CUP).toBe(1);
  });

  it('RS05_TIMER_END 5份自动开火与3份半成品两个子用例均稳定', () => {
    const scenario = registry.scenarioById.get('RS05_TIMER_END')!;
    const formal = runScenarioCase(registry, scenario, scenario.cases[0]);
    const partial = runScenarioCase(registry, scenario, scenario.cases[1]);
    expect(formal.session.phase).toBe('SUMMARY');
    expect(formal.session.cookResults[0].recipeId).toBe('RCP_TOMATO_EGG');
    expect(formal.session.eventLog).toContain('TIME_EXPIRED_AUTO_FIRE_READY');
    expect(partial.session.phase).toBe('PARTIAL_RESULT');
    expect(partial.session.cookResults).toHaveLength(0);
    expect(partial.session.partialResultCount).toBe(1);
  });
});
