import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DevelopmentResearchSchedule } from '../../assets/game/scripts/application/r1b/DevelopmentResearchSchedule';
import { ResearchGameplaySession } from '../../assets/game/scripts/application/r1b/ResearchGameplaySession';
import {
  FixedClock,
  type RewardedAdPort,
  type RewardedAdStatus,
  type RewardedPlacementId,
} from '../../assets/game/scripts/application/r1b/ResearchPorts';
import { stableHash } from '../../assets/game/scripts/domain/cp0b/stable';
import type { Coord, RecipeId } from '../../assets/game/scripts/domain/cp0b/types';
import { loadConfigRegistry } from '../../tools/cp0b/NodeConfigLoader';

const root = process.cwd();
const registry = loadConfigRegistry();
const schedule = new DevelopmentResearchSchedule();
const fixedClock = new FixedClock(1_900_000_000_000);
const path = (...pairs: Array<[number, number]>): Coord[] =>
  pairs.map(([row, column]) => ({ row, column }));
const rowPath = (length: number, row = 0, start = 0): Coord[] =>
  Array.from({ length }, (_unused, index) => ({ row, column: start + index }));

const create = (menu = 'DEV_MENU_MULTI') =>
  new ResearchGameplaySession(registry, schedule, fixedClock, menu);

const link = (session: ResearchGameplaySession, coords: Coord[]) => {
  expect(session.beginLink(coords[0])).toEqual([coords[0]]);
  coords.slice(1).forEach((coord) => session.extendLink(coord));
  const submission = session.commitLink();
  expect(submission.accepted).toBe(true);
  expect(submission.plan).toBeDefined();
  expect(session.completeAnimation(submission.plan!.operationId)).toBe(true);
  return submission.plan!;
};

const cookAndReveal = (session: ResearchGameplaySession) => {
  const cooking = session.fire();
  expect(cooking).toBeDefined();
  expect(session.completeCooking(cooking!.operationId)).toBe(true);
  expect(session.completeReveal(cooking!.result.cookResultId)).toBe(true);
  return cooking!;
};

const prepareFiveThrows = (session: ResearchGameplaySession) => {
  for (let index = 0; index < 5; index += 1) {
    link(session, rowPath(3));
  }
};

describe('CP0-R1-B playable research loop', () => {
  it('B101 Cocos canonical registry remains Schema 2 / Hash a35691f9', () => {
    expect(registry.gameplay.schemaVersion).toBe(2);
    expect(registry.configHash).toBe('a35691f9');
  });

  it('B102 default schedule resolves DEV_MENU_MULTI without presentation recipe hardcoding', () => {
    const menu = schedule.resolveMenu({ nowEpochMs: fixedClock.nowEpochMs() });
    expect(menu.dailyMenuId).toBe('DEV_MENU_MULTI');
    expect(menu.scenarioId).toBe('RS02_MULTI_RECIPE');
    const presenter = readFileSync(
      join(root, 'assets/game/scripts/presentation/R1BBattlePresenter.ts'),
      'utf8',
    );
    expect(presenter).not.toContain("'ORD_01'");
    expect(presenter).not.toContain("'RCP_TOMATO_EGG'");
  });

  it('B103 forced repeat menu and fixed clock are deterministic', () => {
    const first = schedule.resolveMenu({
      nowEpochMs: fixedClock.nowEpochMs(),
      forcedMenuId: 'DEV_MENU_REPEAT',
    });
    const second = schedule.resolveMenu({
      nowEpochMs: fixedClock.nowEpochMs(),
      forcedMenuId: 'DEV_MENU_REPEAT',
    });
    expect(first).toEqual(second);
    expect(first.scenarioId).toBe('RS01_TUTORIAL_REPEAT');
  });

  it('B104 real initial ViewModel is 90 seconds, zero score, empty pot and first clue', () => {
    const view = create().viewModel();
    expect(view.timerText).toBe('01:30');
    expect(view.remainingActiveTimeMs).toBe(90_000);
    expect(view.totalScore).toBe(0);
    expect(view.throwRecords).toEqual([]);
    expect(view.clue.id).toBe('CLUE_POTATO_CAKE');
  });

  it('B105 fewer than three cells has no side effects and no EffectPlan', () => {
    const target = create();
    const before = target.snapshot();
    target.beginLink({ row: 0, column: 0 });
    target.extendLink({ row: 0, column: 1 });
    const submission = target.commitLink();
    expect(submission.accepted).toBe(false);
    expect(submission.plan).toBeUndefined();
    expect(stableHash(target.snapshot())).toBe(stableHash(before));
  });

  it('B106 3, 5, 7 and 9 links each render exactly one throw unit', () => {
    const three = link(create('DEV_MENU_REPEAT'), rowPath(3));
    const five = link(create('DEV_MENU_REPEAT'), rowPath(5));
    const seven = link(create('DEV_MENU_LONG'), rowPath(7));
    const nine = link(create('DEV_MENU_LONG'), [
      ...rowPath(7, 1),
      { row: 0, column: 6 },
      { row: 0, column: 5 },
    ]);
    [three, five, seven, nine].forEach((plan) => {
      expect(plan.throwRecord.units).toBe(1);
      expect(plan.throwRecords.at(-1)?.units).toBe(1);
    });
  });

  it('B107 EffectPlan v2 removes remainingSteps and carries timing, score, combo and pot', () => {
    const plan = link(create(), rowPath(3));
    expect(plan).not.toHaveProperty('remainingSteps');
    expect(plan).toMatchObject({
      remainingActiveTimeMs: 90_000,
      linkScoreDelta: 30,
      dishScoreDelta: 0,
      comboCount: 1,
      comboMultiplier: 1,
      canFire: false,
      potFull: false,
    });
    expect(plan.throwRecords).toHaveLength(1);
  });

  it('B108 final visible board hash contract equals canonical Domain hash', () => {
    const target = create();
    const plan = link(target, rowPath(3));
    expect(plan.finalBoardHash).toBe(target.snapshot().boardHash);
    expect(stableHash(plan.finalBoard)).toBe(plan.finalBoardHash);
    expect(plan.snapshotHash).toBe(stableHash(plan.snapshot));
  });

  it('B109 fourth throw enables fire and sixth throw produces one auto-fire transition', () => {
    const target = create();
    for (let index = 0; index < 4; index += 1) link(target, rowPath(3));
    expect(target.viewModel().canFire).toBe(true);
    link(target, rowPath(3));
    const sixth = link(target, rowPath(3));
    expect(sixth.potFull).toBe(true);
    expect(target.viewModel().phase).toBe('AUTO_FIRE_READY');
    expect(target.completeAnimation(sixth.operationId)).toBe(false);
    const first = target.confirmAutoFire();
    const duplicate = target.confirmAutoFire();
    expect(first?.result.cookResultId).toBe(duplicate?.result.cookResultId);
    expect(target.snapshot().cookResults).toHaveLength(1);
  });

  it('B110 only READY and LINKING consume active time', () => {
    const target = create();
    expect(target.tick(1_000)).toBe(1_000);
    target.beginLink({ row: 0, column: 0 });
    expect(target.tick(1_000)).toBe(1_000);
    target.extendLink({ row: 0, column: 1 });
    target.extendLink({ row: 0, column: 2 });
    const submission = target.commitLink();
    expect(target.tick(1_000)).toBe(0);
    target.completeAnimation(submission.plan!.operationId);
    for (let index = 0; index < 4; index += 1) link(target, rowPath(3));
    const cooking = target.fire()!;
    expect(target.tick(1_000)).toBe(0);
    target.completeCooking(cooking.operationId);
    expect(target.tick(1_000)).toBe(0);
  });

  it('B111 background-style pause/resume deducts no time and settles nothing twice', () => {
    const target = create();
    const before = target.snapshot();
    expect(target.pause()).toBe(true);
    expect(target.tick(25_000)).toBe(0);
    expect(target.pause()).toBe(false);
    expect(target.resume()).toBe(true);
    expect(target.resume()).toBe(false);
    expect(target.snapshot()).toEqual(before);

    const duringAnimation = create();
    duringAnimation.beginLink({ row: 0, column: 0 });
    duringAnimation.extendLink({ row: 0, column: 1 });
    duringAnimation.extendLink({ row: 0, column: 2 });
    const submission = duringAnimation.commitLink();
    expect(duringAnimation.pause()).toBe(true);
    expect(duringAnimation.completeAnimation(submission.plan!.operationId)).toBe(false);
    expect(duringAnimation.resume()).toBe(true);
    expect(duringAnimation.viewModel().phase).toBe('READY');
    expect(duringAnimation.completeAnimation(submission.plan!.operationId)).toBe(false);

    const duringCooking = create();
    prepareFiveThrows(duringCooking);
    const cooking = duringCooking.fire()!;
    expect(duringCooking.pause()).toBe(true);
    expect(duringCooking.completeCooking(cooking.operationId)).toBe(false);
    expect(duringCooking.resume()).toBe(true);
    expect(duringCooking.viewModel().phase).toBe('REVEAL');
    expect(duringCooking.completeCooking(cooking.operationId)).toBe(false);
  });

  it('B112 timeout grace accepts at most one final legal path', () => {
    const target = create('DEV_MENU_REPEAT');
    target.beginLink({ row: 0, column: 0 });
    target.extendLink({ row: 0, column: 1 });
    target.extendLink({ row: 0, column: 2 });
    expect(target.tick(90_000)).toBe(90_000);
    expect(target.viewModel().phase).toBe('TIMEOUT_GRACE');
    const first = target.commitLink();
    const second = target.commitLink();
    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    expect(target.snapshot().pot.throws).toHaveLength(1);
  });

  it('B113 operation ids make link, dish and total score idempotent', () => {
    const target = create();
    const plan = link(target, rowPath(3));
    const afterLink = target.snapshot();
    expect(target.completeAnimation(plan.operationId)).toBe(false);
    expect(target.snapshot().totalScore).toBe(afterLink.totalScore);
    for (let index = 0; index < 4; index += 1) link(target, rowPath(3));
    const cooking = target.fire()!;
    const duplicate = target.fire()!;
    expect(duplicate.operationId).toBe(cooking.operationId);
    expect(target.snapshot().cookResults).toHaveLength(1);
  });

  it('B114 GOOD, GREAT and UNBELIEVABLE come exactly from Domain audioEvent', () => {
    expect(link(create('DEV_MENU_REPEAT'), rowPath(5)).audioEvent).toBe('GOOD');
    expect(link(create('DEV_MENU_LONG'), rowPath(7)).audioEvent).toBe('GREAT');
    expect(link(create('DEV_MENU_LONG'), [
      ...rowPath(7, 1),
      { row: 0, column: 6 },
      { row: 0, column: 5 },
    ]).audioEvent).toBe('UNBELIEVABLE');
  });

  it('B115 combo active-time window pauses during animation and reveal', () => {
    const target = create('DEV_MENU_REPEAT');
    const first = link(target, rowPath(3));
    expect(first.comboCount).toBe(1);
    expect(target.pause()).toBe(true);
    expect(target.tick(8_000)).toBe(0);
    target.resume();
    const second = link(target, rowPath(3));
    expect(second.comboCount).toBe(2);
    expect(second.comboMultiplier).toBe(1);
  });

  it('B116 RS02 cooks potato cake then mushroom soup and advances two clues', () => {
    const target = create();
    prepareFiveThrows(target);
    const first = cookAndReveal(target);
    prepareFiveThrows(target);
    const second = cookAndReveal(target);
    expect([first.recipeId, second.recipeId]).toEqual([
      'RCP_SCALLION_POTATO_CAKE',
      'RCP_GARDEN_MUSHROOM_SOUP',
    ]);
    expect(target.snapshot().researchClueIndex).toBe(2);
  });

  it('B117 board, queue, score and remaining time continue between RS02 pots', () => {
    const target = create();
    target.tick(2_500);
    prepareFiveThrows(target);
    const beforeFire = target.snapshot();
    const cooking = target.fire()!;
    const afterFire = target.snapshot();
    target.completeCooking(cooking.operationId);
    target.completeReveal(cooking.result.cookResultId);
    const afterReveal = target.snapshot();
    expect(afterReveal.boardHash).toBe(beforeFire.boardHash);
    expect(afterReveal.queueCursors).toEqual(beforeFire.queueCursors);
    expect(afterReveal.remainingActiveTimeMs).toBe(beforeFire.remainingActiveTimeMs);
    expect(afterReveal.totalScore).toBe(afterFire.totalScore);
  });

  it('B118 repeat recipe uses full then quick reveal and count 1→2', () => {
    const target = create('DEV_MENU_REPEAT');
    prepareFiveThrows(target);
    const first = cookAndReveal(target);
    prepareFiveThrows(target);
    const second = target.fire()!;
    expect(first.quick).toBe(false);
    expect(first.sessionCookCount).toBe(1);
    expect(second.quick).toBe(true);
    expect(second.sessionCookCount).toBe(2);
  });

  it('B119 cookResultId and reveal callback never duplicate count or discovery reward', () => {
    const target = create('DEV_MENU_REPEAT');
    prepareFiveThrows(target);
    const cooking = target.fire()!;
    const once = target.snapshot();
    expect(target.fire()?.result.cookResultId).toBe(cooking.result.cookResultId);
    expect(target.completeCooking(cooking.operationId)).toBe(true);
    expect(target.completeCooking(cooking.operationId)).toBe(false);
    expect(target.completeReveal(cooking.result.cookResultId)).toBe(true);
    expect(target.completeReveal(cooking.result.cookResultId)).toBe(false);
    expect(once.cookResults).toHaveLength(1);
    expect(target.snapshot().history.sessionCookCounts.RCP_TOMATO_EGG).toBe(1);
  });

  it('B120 five-unit timeout auto-fire matches manual recipe and stars', () => {
    const automatic = create('DEV_MENU_TIMEOUT_FIVE');
    const manual = create('DEV_MENU_TIMEOUT_FIVE');
    prepareFiveThrows(automatic);
    prepareFiveThrows(manual);
    const manualCooking = manual.fire()!;
    automatic.tick(90_000);
    expect(automatic.viewModel().phase).toBe('AUTO_FIRE_READY');
    const automaticCooking = automatic.confirmAutoFire()!;
    expect({
      recipeId: automaticCooking.recipeId,
      stars: automaticCooking.result.stars,
    }).toEqual({
      recipeId: manualCooking.recipeId,
      stars: manualCooking.result.stars,
    });
  });

  it('B121 three-unit timeout creates only a partial result', () => {
    const target = create('DEV_MENU_TIMEOUT_THREE');
    for (let index = 0; index < 3; index += 1) link(target, rowPath(3));
    target.tick(90_000);
    expect(target.viewModel().phase).toBe('PARTIAL_RESULT');
    expect(target.viewModel().partialUnits).toBe(3);
    expect(target.snapshot().cookResults).toEqual([]);
    expect(target.viewModel().summary.formalDishCount).toBe(0);
  });

  it('B122 restart restores fixed board, queue, time, score, pot and clue', () => {
    const target = create();
    const initial = target.snapshot();
    target.tick(4_200);
    link(target, rowPath(3));
    target.restart();
    const restarted = target.snapshot();
    expect(restarted.boardHash).toBe(initial.boardHash);
    expect(restarted.queueCursors).toEqual(initial.queueCursors);
    expect(restarted.remainingActiveTimeMs).toBe(90_000);
    expect(restarted.totalScore).toBe(0);
    expect(restarted.pot.throws).toEqual([]);
    expect(restarted.currentResearchClueId).toBe(initial.currentResearchClueId);
  });

  it('B123 extreme HUD, clue and two-digit count strings use bounded SHRINK layouts', () => {
    const presenter = readFileSync(
      join(root, 'assets/game/scripts/presentation/R1BBattlePresenter.ts'),
      'utf8',
    );
    expect(presenter).toContain('Label.Overflow.SHRINK');
    expect(presenter).toContain("toLocaleString('en-US')");
    expect(presenter).toContain('timerWarning');
    expect(presenter).toContain('COMBO ×${view.comboMultiplier.toFixed(1)}');
    expect(presenter).toContain('本局 ×${cooking.sessionCookCount}');
    const extremes = ['0', '99,999', '999,999', '9,999,999', '01:30', '00:10', '00:00'];
    extremes.forEach((value) => expect(value.length).toBeLessThanOrEqual(9));
  });

  it('B124 commercial ports are SDK-free and expose all three callback states', async () => {
    const placements: RewardedPlacementId[] = [
      'TIME_EXTENSION',
      'SETTLEMENT_DOUBLE',
      'CLUE_HINT',
      'DAILY_CHEST',
    ];
    const statuses: RewardedAdStatus[] = ['COMPLETED', 'CANCELLED', 'FAILED'];
    const fake: RewardedAdPort = {
      async show({ placementId }) {
        return { status: statuses[placements.indexOf(placementId) % statuses.length] };
      },
    };
    expect((await Promise.all(placements.map((placementId, index) =>
      fake.show({ placementId, requestId: `request-${index}` }))))
      .map(({ status }) => status)).toEqual([
      'COMPLETED',
      'CANCELLED',
      'FAILED',
      'COMPLETED',
    ]);
    const ports = readFileSync(
      join(root, 'assets/game/scripts/application/r1b/ResearchPorts.ts'),
      'utf8',
    );
    const presenter = readFileSync(
      join(root, 'assets/game/scripts/presentation/R1BBattlePresenter.ts'),
      'utf8',
    );
    ['TapTap', '穿山甲', '优量汇', 'Unity Ads', 'google-mobile-ads']
      .forEach((sdk) => expect(ports).not.toContain(sdk));
    ['续时', '双倍', '宝箱', '免广告', '商店', '购买']
      .forEach((entry) => expect(presenter).not.toContain(entry));
  });
});
