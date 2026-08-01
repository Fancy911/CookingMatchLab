import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  R1A_BOARD,
  R1A_QUERY_STATE,
  R1A_VIEW_MODELS,
} from '../../assets/game/scripts/presentation/R1AStaticViewModels';

const root = process.cwd();
const shell = readFileSync(
  join(root, 'assets/game/scripts/presentation/CP0ABattleShell.ts'),
  'utf8',
);

describe('CP0-R1-A static visual shell', () => {
  it('V101 exposes exactly three hidden acceptance states', () => {
    expect(Object.keys(R1A_VIEW_MODELS)).toEqual([
      'READY',
      'POT_REVIEW',
      'QUICK_REVEAL_REPEAT',
    ]);
    expect(R1A_QUERY_STATE).toEqual({
      ready: 'READY',
      pot: 'POT_REVIEW',
      reveal: 'QUICK_REVEAL_REPEAT',
    });
    expect(shell).toContain('KeyCode.DIGIT_1');
    expect(shell).toContain('KeyCode.DIGIT_2');
    expect(shell).toContain('KeyCode.DIGIT_3');
  });

  it('V102 contains no visible debug-state controls', () => {
    expect(shell).not.toMatch(/DebugButton|StateButton|调试按钮|切换状态/);
    expect(shell).not.toContain('Node.EventType.TOUCH_END');
  });

  it('V103 renders a 7×7 board using the five current base ingredients plus scallion', () => {
    expect(R1A_BOARD).toHaveLength(7);
    R1A_BOARD.forEach((row) => expect(row).toHaveLength(7));
    const ingredients = new Set(R1A_BOARD.flat());
    expect(ingredients).toEqual(new Set([
      'tomato',
      'egg',
      'potato',
      'carrot',
      'mushroom',
      'scallion',
    ]));
  });

  it('V104 READY uses the frozen timer, score, empty pot, six empty slots and disabled fire', () => {
    const ready = R1A_VIEW_MODELS.READY;
    expect(ready.timer).toBe('01:30');
    expect(ready.score).toBe('0');
    expect(ready.potIngredients).toEqual([]);
    expect(ready.slots).toHaveLength(6);
    expect(ready.slots.every((slot) => !slot.ingredientId)).toBe(true);
    expect(ready.fireEnabled).toBe(false);
  });

  it('V105 POT_REVIEW uses the frozen timer, score, combo and GOOD feedback', () => {
    const review = R1A_VIEW_MODELS.POT_REVIEW;
    expect(review.timer).toBe('01:08');
    expect(review.score).toBe('12,480');
    expect(review.combo).toBe('COMBO ×1.5');
    expect(review.goodSticker).toBe(true);
  });

  it('V106 POT_REVIEW fills five of six slots with one unit each', () => {
    const slots = R1A_VIEW_MODELS.POT_REVIEW.slots;
    expect(slots).toHaveLength(6);
    expect(slots.filter((slot) => slot.ingredientId)).toHaveLength(5);
    expect(slots.map((slot) => slot.ingredientId)).toEqual([
      'tomato',
      'egg',
      'tomato',
      'egg',
      'scallion',
      undefined,
    ]);
    expect(slots.filter((slot) => slot.units).every((slot) => slot.units === 1))
      .toBe(true);
  });

  it('V107 POT_REVIEW pot and enabled fire match the taskbook', () => {
    const review = R1A_VIEW_MODELS.POT_REVIEW;
    expect(review.potIngredients).toEqual(['tomato', 'egg', 'scallion']);
    expect(review.fireEnabled).toBe(true);
    expect(review.quickReveal).toBe(false);
  });

  it('V108 repeat reveal is compact and contains only the authorized reward copy', () => {
    expect(R1A_VIEW_MODELS.QUICK_REVEAL_REPEAT.quickReveal).toBe(true);
    [
      'QuickRevealOverlay',
      '普通料理',
      '番茄炒蛋',
      '+1,100',
      '累计 ×2',
      '下一条线索',
    ].forEach((text) => expect(shell).toContain(text));
    ['金币', '经验', '等级', '首次发现'].forEach(
      (text) => expect(shell).not.toContain(text),
    );
  });

  it('V109 removes the old remaining-steps player UI', () => {
    expect(shell).not.toContain('remainingSteps');
    expect(shell).not.toContain('StepBadge');
    expect(shell).not.toContain('StepValue');
    expect(shell).not.toContain('剩余步数');
  });

  it('V110 keeps the static shell detached from Domain sessions and gameplay input', () => {
    [
      'PrototypeSession',
      'TimedResearchSession',
      'BattleBoardController',
      'beginLink',
      'commitActiveLink',
      'TOUCH_START',
      'TOUCH_MOVE',
    ].forEach((text) => expect(shell).not.toContain(text));
  });

  it('V111 preserves the canonical Domain and config tree from the R1-A baseline', () => {
    const protectedPaths = [
      'assets/game/scripts/domain',
      'assets/game/scripts/application/cp0c',
      'assets/game/scripts/infrastructure/JsonConfigAdapter.ts',
      'assets/game/scripts/infrastructure/CocosJsonConfigLoader.ts',
      'assets/resources/game/config',
    ];
    const diff = execFileSync(
      'git',
      ['diff', '--name-only', 'cp0-r1a-baseline', '--', ...protectedPaths],
      { cwd: root, encoding: 'utf8' },
    ).trim();
    expect(diff).toBe('');
  });

  it('V112 declares the required physical UI nodes and fixed safe-area shell', () => {
    [
      'SafeAreaRoot',
      'KitchenTimer',
      'ScoreBoard',
      'ResearchClueTray',
      'BoardRoot',
      'ResearchPot',
      'SixSlotBoard',
      'FireButton',
    ].forEach((name) => expect(shell).toContain(name));
    expect(shell).toContain('`ThrowSlot${index + 1}`');
    expect(shell).toContain('SCREEN_WIDTH = 390');
    expect(shell).toContain('SCREEN_HEIGHT = 844');
    expect(shell).toContain('const slotSize = 70');
    expect(shell).toContain('const iconSize = 52');
    expect(shell).toContain('const step = 49');
    expect(shell).toContain("'throwTraySix'");
    expect(shell).toContain("'hudShell'");
    expect(shell).toContain("'nameplate'");
    expect(shell).not.toContain('roundedPanel');
  });
});
