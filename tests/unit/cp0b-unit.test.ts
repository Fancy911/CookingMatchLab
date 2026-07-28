import { describe, expect, it } from 'vitest';
import {
  BoardModel,
  BoardResolver,
  DeadBoardDetector,
  DiscoveryModel,
  InspirationResolver,
  OrderResolver,
  PathEditor,
  PathValidator,
  PotModel,
  RecipeResolver,
  RunSnapshot,
  StarCalculator,
  settleFire,
  type QueueState,
} from '../../src/cp0b/core.js';
import { ConfigRegistry } from '../../src/cp0b/config.js';
import { OrderSession, PrototypeTestRunner, ScenarioService } from '../../src/cp0b/scenario.js';
import { deepClone, stableHash } from '../../src/cp0b/stable.js';
import type {
  BoardGrid,
  IngredientId,
  IngredientUnits,
  ProcessingTag,
  RecipeId,
  ScenarioConfig,
} from '../../src/cp0b/types.js';
import { cells, coord, registry } from '../helpers.js';

const recipeResolver = new RecipeResolver(registry.recipes);
const starCalculator = new StarCalculator(registry.gameplay);

const makeUniformBoard = (ingredientId: IngredientId): BoardModel =>
  new BoardModel(Array.from({ length: 7 }, () =>
    Array.from({ length: 7 }, () => ({ ingredientId, inspiration: false }))));

const conflictCases: Array<{
  id: string;
  units: IngredientUnits;
  tags: ProcessingTag[];
  expected: RecipeId;
}> = [
  { id: 'C01', units: { ING_TOMATO: 5, ING_EGG: 4 }, tags: [], expected: 'RCP_TOMATO_EGG' },
  { id: 'C02', units: { ING_TOMATO: 6, ING_EGG: 5 }, tags: [], expected: 'RCP_TOMATO_EGG' },
  { id: 'C03', units: { ING_TOMATO: 7, ING_EGG: 4 }, tags: ['LONG_INSPIRATION'], expected: 'RCP_WARM_HOTPOT_MIX' },
  { id: 'C04', units: { ING_POTATO: 6, ING_EGG: 3, ING_SCALLION: 3 }, tags: [], expected: 'RCP_SCALLION_POTATO_CAKE' },
  { id: 'C05', units: { ING_MUSHROOM: 5, ING_CARROT: 4, ING_POTATO: 3 }, tags: [], expected: 'RCP_GARDEN_MUSHROOM_SOUP' },
  { id: 'C06', units: { ING_TOMATO: 7, ING_POTATO: 7, ING_MUSHROOM: 4 }, tags: [], expected: 'RCP_CHARRED_TOMATO_POTATO_BALL' },
  { id: 'C07', units: { ING_MUSHROOM: 11, ING_EGG: 4 }, tags: ['INSPIRATION'], expected: 'RCP_STAR_MUSHROOM_EGG_CUP' },
  { id: 'C08', units: { ING_MUSHROOM: 11, ING_EGG: 4 }, tags: [], expected: 'RCP_WARM_HOTPOT_MIX' },
  { id: 'C09', units: { ING_MUSHROOM: 11, ING_EGG: 4 }, tags: ['MASTER'], expected: 'RCP_WARM_HOTPOT_MIX' },
  { id: 'C10', units: { ING_TOMATO: 5, ING_EGG: 4, ING_MUSHROOM: 3 }, tags: [], expected: 'RCP_WARM_HOTPOT_MIX' },
  { id: 'C11', units: { ING_TOMATO: 7, ING_POTATO: 7, ING_MUSHROOM: 4 }, tags: ['INSPIRATION'], expected: 'RCP_CHARRED_TOMATO_POTATO_BALL' },
  { id: 'C12', units: { ING_TOMATO: 3, ING_EGG: 3 }, tags: ['MASTER'], expected: 'RCP_WARM_HOTPOT_MIX' },
];

describe('CP0-B unit rules', () => {
  it('U01 八方向相邻合法；四方向模式下斜线非法', () => {
    const board = makeUniformBoard('ING_TOMATO');
    const diagonal = [coord(0, 0), coord(1, 1), coord(2, 2)];
    expect(new PathValidator(8, 3).validate(board, diagonal).valid).toBe(true);
    expect(new PathValidator(4, 3).validate(board, diagonal).valid).toBe(false);
  });

  it('U02 少于3连取消且所有状态不变', () => {
    const scenario = new ScenarioService(registry).get('O1_TUTORIAL_001');
    const session = new OrderSession(registry, scenario);
    const before = session.snapshot();
    const rngBefore = session.rng.snapshot();
    const result = session.commit([coord(0, 0), coord(0, 1)]);
    expect(result.committed).toBe(false);
    expect(session.snapshot()).toEqual(before);
    expect(session.rng.snapshot()).toBe(rngBefore);
  });

  it('U03 路径不可重复；返回倒数第二格只撤销最后格', () => {
    const board = makeUniformBoard('ING_TOMATO');
    const validator = new PathValidator(8, 3);
    expect(validator.validate(board, [coord(0, 0), coord(0, 1), coord(0, 0)]).reason)
      .toContain('repeated');
    const editor = new PathEditor(board, validator);
    expect(editor.append(coord(0, 0))).toBe('ADDED');
    expect(editor.append(coord(0, 1))).toBe('ADDED');
    expect(editor.append(coord(1, 1))).toBe('ADDED');
    expect(editor.append(coord(0, 1))).toBe('BACKTRACKED');
    expect(editor.snapshot()).toEqual([coord(0, 0), coord(0, 1)]);
  });

  it('U04 普通食材1格等于1入锅单位', () => {
    const pot = new PotModel(registry.gameplay, registry.normalUnitValueById);
    expect(pot.addThrow(cells('ING_TOMATO', 4)).units).toBe(4);
    expect(pot.units.ING_TOMATO).toBe(4);
  });

  it('U05 灵感食材连接占1格、入锅等于2单位', () => {
    const pot = new PotModel(registry.gameplay, registry.normalUnitValueById);
    const result = pot.addThrow(cells('ING_MUSHROOM', 3, [2]));
    expect(result.pathLength).toBe(3);
    expect(result.units).toBe(4);
    expect(pot.tags.has('INSPIRATION')).toBe(true);
  });

  it('U06 5、7、9长连阈值从配置读取', () => {
    const resolver = new InspirationResolver(registry.gameplay);
    expect(resolver.tagsForPath(registry.gameplay.longLink.fine)).toContain('FINE');
    expect(resolver.tagsForPath(registry.gameplay.longLink.inspiration)).toContain('LONG_INSPIRATION');
    expect(resolver.tagsForPath(registry.gameplay.longLink.master)).toContain('MASTER');
    const custom = deepClone(registry.gameplay);
    custom.longLink = { fine: 4, inspiration: 6, master: 8 };
    expect(new InspirationResolver(custom).tagsForPath(6)).toEqual(['FINE', 'LONG_INSPIRATION']);
  });

  it('U07 7连先完成当前投料，再在补盘生成灵感', () => {
    const session = new OrderSession(
      registry,
      new ScenarioService(registry).get('O3_INSPIRATION'),
    );
    const result = session.commit([
      coord(0, 0), coord(0, 1), coord(1, 1), coord(1, 2),
      coord(2, 2), coord(2, 3), coord(3, 3),
    ]);
    expect(result.throwRecord?.units).toBe(7);
    expect(session.pot.units.ING_MUSHROOM).toBe(7);
    expect(session.pot.tags.has('INSPIRATION')).toBe(false);
    expect(result.inspirationCoord).toEqual(coord(1, 3));
  });

  it('U08 灵感位于路径终点列的第一个新补格', () => {
    const session = new OrderSession(
      registry,
      new ScenarioService(registry).get('O3_INSPIRATION'),
    );
    const result = session.commit([
      coord(0, 0), coord(0, 1), coord(1, 1), coord(1, 2),
      coord(2, 2), coord(2, 3), coord(3, 3),
    ]);
    expect(result.inspirationCoord).toEqual(coord(1, 3));
    expect(session.board.get(coord(1, 3))).toEqual({
      ingredientId: 'ING_MUSHROOM',
      inspiration: true,
    });
  });

  it('U09 掉落保持同列原有相对顺序', () => {
    const grid: BoardGrid = [
      [{ ingredientId: 'ING_TOMATO', inspiration: false }],
      [{ ingredientId: 'ING_EGG', inspiration: false }],
      [{ ingredientId: 'ING_POTATO', inspiration: false }],
      [{ ingredientId: 'ING_CARROT', inspiration: false }],
    ];
    const queueState: QueueState = {
      values: { '0': cells('ING_MUSHROOM', 4) },
      cursors: { '0': 0 },
    };
    const result = new BoardResolver().resolve(
      new BoardModel(grid),
      [coord(1, 0), coord(3, 0)],
      queueState,
    );
    expect(result.board.grid.map((row) => row[0].ingredientId))
      .toEqual(['ING_MUSHROOM', 'ING_MUSHROOM', 'ING_TOMATO', 'ING_POTATO']);
  });

  it('U10 补盘不自动消除、不自动入锅', () => {
    const session = new OrderSession(
      registry,
      new ScenarioService(registry).get('O1_TUTORIAL_001'),
    );
    session.commit([coord(0, 0), coord(0, 1), coord(1, 1), coord(1, 2), coord(2, 2)]);
    expect(session.pot.throws).toHaveLength(1);
    expect(session.pot.units).toEqual({ ING_TOMATO: 5 });
    expect(session.board.grid.flat()).toHaveLength(49);
  });

  it('U11 死盘免费洗牌，不改变步数和锅', () => {
    const symbols = ['T', 'E', 'P', 'C', 'M'];
    const deadSymbols = Array.from({ length: 7 }, (_unused, row) =>
      Array.from({ length: 7 }, (_unusedCell, column) =>
        symbols[(row * 2 + column) % symbols.length]));
    const dead = new BoardModel(deadSymbols.map((row) => row.map((symbol) => ({
      ingredientId: registry.symbolToIngredient.get(symbol)!,
      inspiration: false,
    }))));
    const detector = new DeadBoardDetector();
    expect(detector.isDead(dead, 8, 3)).toBe(true);
    const initialBoard = deepClone(deadSymbols);
    initialBoard[0][0] = 'T';
    initialBoard[1][0] = 'T';
    initialBoard[2][0] = 'T';
    const scenario: ScenarioConfig = {
      schemaVersion: 1,
      id: 'O1_TUTORIAL_001',
      orderId: 'ORD_01',
      refillMode: 'COLUMN_QUEUE',
      initialBoard,
      columnQueues: {
        '0': [deadSymbols[2][0], deadSymbols[1][0], deadSymbols[0][0]],
        '1': ['T'],
        '2': ['T'],
        '3': ['T'],
        '4': ['T'],
        '5': ['T'],
        '6': ['T'],
      },
      expectedActionScript: [],
      expectedFinalResult: 'RCP_TOMATO_EGG',
    };
    const session = new OrderSession(registry, scenario, undefined, 12345);
    session.pot.addThrow(cells('ING_EGG', 3));
    const stepsBeforeCommit = session.remainingSteps;
    const deadMultiset = dead.grid.flat().map((cell) => cell.ingredientId).sort();

    const commit = session.commit([coord(0, 0), coord(1, 0), coord(2, 0)]);

    expect(commit.committed).toBe(true);
    expect(session.remainingSteps).toBe(stepsBeforeCommit - 1);
    expect(session.pot.units).toEqual({ ING_EGG: 3, ING_TOMATO: 3 });
    expect(session.pot.throws).toHaveLength(2);
    expect(session.pot.throws.map((item) => item.ingredientId))
      .toEqual(['ING_EGG', 'ING_TOMATO']);
    expect(session.board.grid.flat().map((cell) => cell.ingredientId).sort())
      .toEqual(deadMultiset);
    expect(detector.hasLegalPath(session.board, 8, 3)).toBe(true);
    expect(session.board.hash()).not.toBe(dead.hash());
  });

  it('U12 一次合法连线只占一个投料位', () => {
    const pot = new PotModel(registry.gameplay, registry.normalUnitValueById);
    pot.addThrow(cells('ING_TOMATO', 9));
    expect(pot.throws).toHaveLength(1);
  });

  it('U13 至少两次投料才能开火；第三次后不自动开火', () => {
    const pot = new PotModel(registry.gameplay, registry.normalUnitValueById);
    pot.addThrow(cells('ING_TOMATO', 5));
    expect(pot.canFire()).toBe(false);
    pot.addThrow(cells('ING_EGG', 4));
    expect(pot.canFire()).toBe(true);
    pot.addThrow(cells('ING_POTATO', 3));
    expect(pot.isFull()).toBe(true);
    expect(pot.canFire()).toBe(true);
  });

  it('U14 投料顺序不同但最终输入相同，生成同一道料理', () => {
    const first = new PotModel(registry.gameplay, registry.normalUnitValueById);
    first.addThrow(cells('ING_TOMATO', 5));
    first.addThrow(cells('ING_EGG', 4));
    const second = new PotModel(registry.gameplay, registry.normalUnitValueById);
    second.addThrow(cells('ING_EGG', 4));
    second.addThrow(cells('ING_TOMATO', 5));
    expect(recipeResolver.resolve(first.units, first.tags).id)
      .toBe(recipeResolver.resolve(second.units, second.tags).id);
  });

  it('U15 G2冲突表C01～C12全部通过', () => {
    for (const testCase of conflictCases) {
      expect(recipeResolver.resolve(testCase.units, testCase.tags).id, testCase.id)
        .toBe(testCase.expected);
    }
  });

  it('U16 0～12全量整数枚举无两道明确配方同时命中', () => {
    const ids: IngredientId[] = [
      'ING_TOMATO', 'ING_EGG', 'ING_POTATO',
      'ING_CARROT', 'ING_MUSHROOM', 'ING_SCALLION',
    ];
    let overlaps = 0;
    const units: IngredientUnits = {};
    for (let tomato = 0; tomato <= 12; tomato += 1) {
      units[ids[0]] = tomato;
      for (let egg = 0; egg <= 12; egg += 1) {
        units[ids[1]] = egg;
        for (let potato = 0; potato <= 12; potato += 1) {
          units[ids[2]] = potato;
          for (let carrot = 0; carrot <= 12; carrot += 1) {
            units[ids[3]] = carrot;
            for (let mushroom = 0; mushroom <= 12; mushroom += 1) {
              units[ids[4]] = mushroom;
              for (let scallion = 0; scallion <= 12; scallion += 1) {
                units[ids[5]] = scallion;
                if (recipeResolver.matchingExplicit(units, ['INSPIRATION']).length > 1) {
                  overlaps += 1;
                }
              }
            }
          }
        }
      }
    }
    expect(overlaps).toBe(0);
  }, 60_000);

  it('U17 五道明确料理理想路径均为3星', () => {
    const cases: Array<[RecipeId, IngredientUnits, number]> = [
      ['RCP_TOMATO_EGG', { ING_TOMATO: 5, ING_EGG: 4 }, 70],
      ['RCP_SCALLION_POTATO_CAKE', { ING_POTATO: 6, ING_EGG: 3, ING_SCALLION: 3 }, 200 / 3],
      ['RCP_GARDEN_MUSHROOM_SOUP', { ING_MUSHROOM: 5, ING_CARROT: 4, ING_POTATO: 3 }, 200 / 3],
      ['RCP_CHARRED_TOMATO_POTATO_BALL', { ING_TOMATO: 7, ING_POTATO: 7, ING_MUSHROOM: 4 }, 80],
      ['RCP_STAR_MUSHROOM_EGG_CUP', { ING_MUSHROOM: 11, ING_EGG: 4 }, 220 / 3],
    ];
    const order = registry.orderById.get('ORD_03')!;
    for (const [recipeId, units, processing] of cases) {
      const recipe = registry.recipeById.get(recipeId)!;
      expect(starCalculator.calculate(recipe, units, processing, 5, order).stars, recipeId)
        .toBe(3);
    }
  });

  it('U18 暖锅杂烩总分最高70，因此最多二星', () => {
    const fallback = registry.recipeById.get('RCP_WARM_HOTPOT_MIX')!;
    const order = registry.orderById.get('ORD_01')!;
    const score = starCalculator.calculate(fallback, { ING_TOMATO: 3 }, 100, 7, order);
    expect(score.totalScore).toBe(70);
    expect(score.stars).toBe(2);
  });

  it('U19 星级计算不读取当前订单目标身份', () => {
    const recipe = registry.recipeById.get('RCP_TOMATO_EGG')!;
    const units = { ING_TOMATO: 5, ING_EGG: 4 };
    const ord1 = registry.orderById.get('ORD_01')!;
    const otherTargetOrder = { ...ord1, targetRecipeId: 'RCP_GARDEN_MUSHROOM_SOUP' as const };
    expect(starCalculator.calculate(recipe, units, 70, 5, ord1))
      .toEqual(starCalculator.calculate(recipe, units, 70, 5, otherTargetOrder));
  });

  it('U20 非目标有剩余步数时只清锅并保留棋盘、特殊格、步数和队列', () => {
    const scenario = new ScenarioService(registry).get('O2_BLACK');
    const session = new OrderSession(registry, scenario);
    for (const action of scenario.expectedActionScript.slice(0, 3)) {
      session.commit((action.path ?? []).map(([row, column]) => coord(row, column)));
    }
    const fire = session.fire();
    expect(fire.orderResult).toBe('CONTINUE_AFTER_REVEAL');
    const before = session.snapshot();
    session.continueAfterReveal();
    const after = session.snapshot();
    expect(after.pot.units).toEqual({});
    expect(after.pot.throws).toEqual([]);
    expect(after.remainingSteps).toBe(before.remainingSteps);
    expect(after.boardHash).toBe(before.boardHash);
    expect(after.queueCursors).toEqual(before.queueCursors);
    expect(after.board.flat().filter((cell) => cell.inspiration)).toHaveLength(2);
  });

  it('U21 非目标且剩余0步时进入订单未完成', () => {
    const discovery = new DiscoveryModel();
    const pot = new PotModel(registry.gameplay, registry.normalUnitValueById);
    pot.addThrow(cells('ING_TOMATO', 3));
    pot.addThrow(cells('ING_POTATO', 3));
    const result = settleFire(
      recipeResolver,
      starCalculator,
      new OrderResolver(),
      discovery,
      pot,
      registry.orderById.get('ORD_01')!,
      0,
    );
    expect(result.orderResult).toBe('NOT_COMPLETED');
  });

  it('U22 订单失败不回滚首次发现和历史最高星级', () => {
    const discovery = new DiscoveryModel();
    const pot = new PotModel(registry.gameplay, registry.normalUnitValueById);
    pot.addThrow(cells('ING_TOMATO', 3));
    pot.addThrow(cells('ING_POTATO', 3));
    const result = settleFire(
      recipeResolver,
      starCalculator,
      new OrderResolver(),
      discovery,
      pot,
      registry.orderById.get('ORD_01')!,
      0,
    );
    expect(result.orderResult).toBe('NOT_COMPLETED');
    expect(discovery.state.discoveredRecipeIds).toContain('RCP_WARM_HOTPOT_MIX');
    expect(discovery.state.bestStarsByRecipe.RCP_WARM_HOTPOT_MIX).toBe(result.stars);
  });

  it('U23 配置缺字段、非法食材或固定队列耗尽时明确失败', () => {
    const baseRaw = {
      gameplay: deepClone(registry.gameplay),
      ingredients: { schemaVersion: 1, ingredients: deepClone(registry.ingredients) },
      recipes: { schemaVersion: 1, recipes: deepClone(registry.recipes) },
      orders: { schemaVersion: 1, orders: deepClone(registry.orders) },
      tutorials: { schemaVersion: 1, tutorials: deepClone(registry.tutorials) },
      scenarios: deepClone(registry.scenarios),
    };
    const missing = deepClone(baseRaw) as typeof baseRaw & { gameplay: Record<string, unknown> };
    delete (missing.gameplay.board as Record<string, unknown>).rows;
    expect(() => ConfigRegistry.fromRaw(missing)).toThrow(/rows/);

    const requiredFieldCases: Array<{
      label: RegExp;
      remove: (raw: typeof baseRaw) => void;
    }> = [
      {
        label: /thresholds\.three/,
        remove: (raw) => {
          delete (raw.gameplay.star.thresholds as Record<string, unknown>).three;
        },
      },
      {
        label: /weights\.recipe/,
        remove: (raw) => {
          delete (raw.gameplay.star.weights as Record<string, unknown>).recipe;
        },
      },
      {
        label: /shuffle\.maximumAttempts/,
        remove: (raw) => {
          delete (raw.gameplay.shuffle as Record<string, unknown>).maximumAttempts;
        },
      },
      {
        label: /initialSteps/,
        remove: (raw) => {
          delete (raw.orders.orders[0] as unknown as Record<string, unknown>).initialSteps;
        },
      },
      {
        label: /highEfficiencySteps/,
        remove: (raw) => {
          delete (raw.orders.orders[0] as unknown as Record<string, unknown>).highEfficiencySteps;
        },
      },
      {
        label: /passEfficiencySteps/,
        remove: (raw) => {
          delete (raw.orders.orders[0] as unknown as Record<string, unknown>).passEfficiencySteps;
        },
      },
      {
        label: /expectedActionScript\[0\]\.type/,
        remove: (raw) => {
          delete (raw.scenarios[0].expectedActionScript[0] as unknown as Record<string, unknown>).type;
        },
      },
      {
        label: /expectedActionScript\[0\]\.path/,
        remove: (raw) => {
          delete (raw.scenarios[0].expectedActionScript[0] as unknown as Record<string, unknown>).path;
        },
      },
      {
        label: /expectedActionScript\[0\]\.expected/,
        remove: (raw) => {
          delete (raw.scenarios[0].expectedActionScript[0] as unknown as Record<string, unknown>).expected;
        },
      },
    ];
    requiredFieldCases.forEach(({ label, remove }) => {
      const raw = deepClone(baseRaw);
      remove(raw);
      expect(() => ConfigRegistry.fromRaw(raw)).toThrow(label);
    });

    const illegal = deepClone(baseRaw);
    illegal.scenarios[0].initialBoard[0][0] = 'X';
    expect(() => ConfigRegistry.fromRaw(illegal)).toThrow(/unknown symbol/);

    const queueState: QueueState = { values: { '0': [] }, cursors: { '0': 0 } };
    expect(() => new BoardResolver().resolve(
      new BoardModel([[{ ingredientId: 'ING_TOMATO', inspiration: false }]]),
      [coord(0, 0)],
      queueState,
    )).toThrow(/exhausted/);
  });

  it('U24 同一配置、seed和操作序列生成相同快照hash', () => {
    const runner = new PrototypeTestRunner(registry);
    const first = runner.run('O1_TUTORIAL_001', undefined, 8675309);
    const second = runner.run('O1_TUTORIAL_001', undefined, 8675309);
    expect(first.finalSnapshotHash).toBe(second.finalSnapshotHash);
    expect(first.actions.map((action) => action.after.snapshotHash))
      .toEqual(second.actions.map((action) => action.after.snapshotHash));
    expect(RunSnapshot.hash(first.finalSnapshot)).toBe(RunSnapshot.hash(second.finalSnapshot));
    expect(stableHash(first.fireResults)).toBe(stableHash(second.fireResults));
  });
});
