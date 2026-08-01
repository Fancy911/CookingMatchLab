import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TimedResearchSession,
  type ConfigBundle,
} from '../assets/game/scripts/domain/cp0b/core';
import type {
  IngredientConfig,
  IngredientId,
  GameplayConfig,
  OrderConfig,
  RecipeConfig,
  ScenarioAction,
  ScenarioCase,
  ScenarioConfig,
  RecipeId,
} from '../assets/game/scripts/domain/cp0b/types';

const root = process.cwd();
const configDirectory = join(root, 'assets', 'resources', 'game', 'config', 'cp0-b');
const scenarioDirectory = join(configDirectory, 'scenarios');
const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(join(configDirectory, file), 'utf8')) as T;

const gameplay = readJson<GameplayConfig>('gameplay.json');
const ingredients = readJson<{ ingredients: IngredientConfig[] }>('ingredients.json').ingredients;
const recipes = readJson<{ recipes: RecipeConfig[] }>('recipes.json').recipes;
const orders = readJson<{ orders: OrderConfig[] }>('orders.json').orders;
const bundle: ConfigBundle = {
  gameplay,
  recipes,
  orders,
  symbolToIngredient: new Map(ingredients.map((ingredient) => [
    ingredient.symbol,
    ingredient.id,
  ])),
};

type BlueprintAction =
  | { type: 'ADVANCE_ACTIVE_TIME'; milliseconds: number }
  | { type: 'LINK'; path: [number, number][] }
  | { type: 'FIRE'; expectedRecipeId: RecipeId }
  | { type: 'CONFIRM_AUTO_FIRE'; expectedRecipeId: RecipeId };

interface CaseBlueprint {
  id: string;
  initialBoard: string[][];
  columnQueues: Record<string, string[]>;
  researchClueQueue: string[];
  actions: BlueprintAction[];
}

const symbolById = Object.fromEntries(
  ingredients.map((ingredient) => [ingredient.id, ingredient.symbol]),
) as Record<IngredientId, string>;
const filler = ['T', 'E', 'P', 'C', 'M', 'S'];
const topThree: [number, number][] = [[0, 0], [0, 1], [0, 2]];
const topSeven: [number, number][] = [
  [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
];
const topRightThree: [number, number][] = [[0, 4], [0, 5], [0, 6]];

const boardFor = (first: IngredientId): string[][] => [
  Array(7).fill(symbolById[first]) as string[],
  Array(7).fill('E') as string[],
  Array(7).fill('P') as string[],
  Array(7).fill('C') as string[],
  Array(7).fill('M') as string[],
  Array(7).fill('S') as string[],
  ['T', 'E', 'P', 'C', 'M', 'S', 'T'],
];

const queueTail = (length = 48): string[] =>
  Array.from({ length }, (_unused, index) => filler[index % filler.length]);

const standardCase = (
  id: string,
  sequence: IngredientId[],
  researchClueQueue: string[],
  actionTail: BlueprintAction[],
  initialAdvanceMs = 2_500,
): CaseBlueprint => {
  const nextSymbols = sequence.slice(1).map((ingredientId) => symbolById[ingredientId]);
  const columnQueues = Object.fromEntries(Array.from({ length: 7 }, (_unused, column) => [
    String(column),
    column < 3 ? [...nextSymbols, ...queueTail()] : queueTail(),
  ]));
  const actions: BlueprintAction[] = [
    { type: 'ADVANCE_ACTIVE_TIME', milliseconds: initialAdvanceMs },
  ];
  sequence.forEach((ingredientId, index) => {
    actions.push({ type: 'LINK', path: topThree });
    if (index === 4 && actionTail.length > 0) {
      actions.push(actionTail[0]);
    }
  });
  if (actionTail.length > 1) {
    actions.push(...actionTail.slice(1));
  }
  return {
    id,
    initialBoard: boardFor(sequence[0]),
    columnQueues,
    researchClueQueue,
    actions,
  };
};

const repeatedRecipeCase = (): CaseBlueprint => {
  const sequence: IngredientId[] = [
    'ING_TOMATO', 'ING_TOMATO', 'ING_EGG', 'ING_EGG', 'ING_SCALLION',
    'ING_TOMATO', 'ING_TOMATO', 'ING_EGG', 'ING_EGG', 'ING_SCALLION',
  ];
  const blueprint = standardCase(
    'REPEAT_TOMATO_EGG',
    sequence,
    ['CLUE_TOMATO_EGG_A', 'CLUE_TOMATO_EGG_B'],
    [],
  );
  blueprint.actions.splice(6, 0, {
    type: 'FIRE',
    expectedRecipeId: 'RCP_TOMATO_EGG',
  });
  blueprint.actions.push({
    type: 'FIRE',
    expectedRecipeId: 'RCP_TOMATO_EGG',
  });
  return blueprint;
};

const twoRecipeCase = (): CaseBlueprint => {
  const sequence: IngredientId[] = [
    'ING_POTATO', 'ING_POTATO', 'ING_POTATO', 'ING_EGG', 'ING_SCALLION',
    'ING_MUSHROOM', 'ING_MUSHROOM', 'ING_CARROT', 'ING_POTATO', 'ING_SCALLION',
  ];
  const blueprint = standardCase(
    'POTATO_CAKE_THEN_SOUP',
    sequence,
    ['CLUE_POTATO_CAKE', 'CLUE_GARDEN_SOUP'],
    [],
  );
  blueprint.actions.splice(6, 0, {
    type: 'FIRE',
    expectedRecipeId: 'RCP_SCALLION_POTATO_CAKE',
  });
  blueprint.actions.push({
    type: 'FIRE',
    expectedRecipeId: 'RCP_GARDEN_MUSHROOM_SOUP',
  });
  return blueprint;
};

const darkCase = (): CaseBlueprint => {
  const sequence: IngredientId[] = [
    'ING_TOMATO', 'ING_TOMATO', 'ING_POTATO', 'ING_POTATO', 'ING_MUSHROOM',
    'ING_TOMATO', 'ING_TOMATO', 'ING_EGG', 'ING_EGG', 'ING_SCALLION',
  ];
  const blueprint = standardCase(
    'DARK_THEN_NORMAL',
    sequence,
    ['CLUE_DARK', 'CLUE_TOMATO_EGG_C'],
    [],
  );
  blueprint.actions.splice(6, 0, {
    type: 'FIRE',
    expectedRecipeId: 'RCP_CHARRED_TOMATO_POTATO_BALL',
  });
  blueprint.actions.push({
    type: 'FIRE',
    expectedRecipeId: 'RCP_TOMATO_EGG',
  });
  return blueprint;
};

const inspirationCase = (): CaseBlueprint => {
  const nextForRight = ['M', 'M', 'E', 'E', 'T', 'T', 'E', 'E', 'S'];
  const columnQueues = Object.fromEntries(Array.from({ length: 7 }, (_unused, column) => [
    String(column),
    column >= 4
      ? [...nextForRight, ...queueTail()]
      : ['M', ...queueTail()],
  ]));
  const actions: BlueprintAction[] = [
    { type: 'ADVANCE_ACTIVE_TIME', milliseconds: 2_500 },
    { type: 'LINK', path: topSeven },
    { type: 'LINK', path: topRightThree },
    { type: 'LINK', path: topRightThree },
    { type: 'LINK', path: topRightThree },
    { type: 'LINK', path: topRightThree },
    { type: 'FIRE', expectedRecipeId: 'RCP_STAR_MUSHROOM_EGG_CUP' },
    { type: 'LINK', path: topRightThree },
    { type: 'LINK', path: topRightThree },
    { type: 'LINK', path: topRightThree },
    { type: 'LINK', path: topRightThree },
    { type: 'LINK', path: topRightThree },
    { type: 'FIRE', expectedRecipeId: 'RCP_TOMATO_EGG' },
  ];
  return {
    id: 'INSPIRATION_THEN_NEXT_POT',
    initialBoard: boardFor('ING_MUSHROOM'),
    columnQueues,
    researchClueQueue: ['CLUE_STAR', 'CLUE_TOMATO_EGG_C'],
    actions,
  };
};

const timerCases = (): CaseBlueprint[] => {
  const formal = standardCase(
    'FIVE_UNITS_AUTO_FIRE',
    ['ING_TOMATO', 'ING_TOMATO', 'ING_EGG', 'ING_EGG', 'ING_SCALLION'],
    ['CLUE_TOMATO_EGG_A'],
    [],
    0,
  );
  formal.actions.push(
    { type: 'ADVANCE_ACTIVE_TIME', milliseconds: 90_000 },
    { type: 'CONFIRM_AUTO_FIRE', expectedRecipeId: 'RCP_TOMATO_EGG' },
  );
  const partial = standardCase(
    'THREE_UNITS_PARTIAL',
    ['ING_TOMATO', 'ING_TOMATO', 'ING_EGG'],
    ['CLUE_TOMATO_EGG_A'],
    [],
    0,
  );
  partial.actions.push({ type: 'ADVANCE_ACTIVE_TIME', milliseconds: 90_000 });
  return [formal, partial];
};

const expectedFor = (session: TimedResearchSession) => {
  const snapshot = session.snapshot();
  return {
    potUnits: snapshot.pot.units,
    remainingActiveTimeMs: snapshot.remainingActiveTimeMs,
    comboCount: snapshot.comboCount,
    totalScore: snapshot.totalScore,
    tags: snapshot.pot.tags,
    phase: snapshot.phase,
  };
};

const materializeCase = (
  scenarioId: ScenarioConfig['id'],
  seed: number,
  blueprint: CaseBlueprint,
): ScenarioCase => {
  const session = new TimedResearchSession(
    bundle,
    scenarioId,
    blueprint.id,
    blueprint.initialBoard,
    blueprint.columnQueues,
    blueprint.researchClueQueue,
    seed,
  );
  const actions: ScenarioAction[] = [];
  blueprint.actions.forEach((action) => {
    if (action.type === 'ADVANCE_ACTIVE_TIME') {
      session.advanceActiveTime(action.milliseconds);
      actions.push({
        type: action.type,
        milliseconds: action.milliseconds,
        expected: expectedFor(session),
      });
      return;
    }
    if (action.type === 'LINK') {
      const result = session.commitLink(action.path.map(([row, column]) => ({ row, column })));
      if (!result.committed || !result.throwRecord) {
        throw new Error(`${scenarioId}/${blueprint.id} generated an invalid fixed path`);
      }
      session.completeAnimation();
      actions.push({
        type: action.type,
        path: action.path,
        expected: {
          ...expectedFor(session),
          pathLength: result.throwRecord.pathLength,
          ingredientId: result.throwRecord.ingredientId,
          linkScore: result.throwRecord.linkScore,
          ...(result.throwRecord.audioEvent
            ? { audioEvent: result.throwRecord.audioEvent }
            : {}),
        },
      });
      return;
    }
    const result = action.type === 'FIRE'
      ? session.fire()
      : session.confirmAutoFire();
    if (result.recipeId !== action.expectedRecipeId) {
      throw new Error(
        `${scenarioId}/${blueprint.id} expected ${action.expectedRecipeId}, got ${result.recipeId}`,
      );
    }
    session.completeReveal();
    actions.push({
      type: action.type,
      expectedRecipeId: action.expectedRecipeId,
      expected: expectedFor(session),
    });
  });
  return {
    id: blueprint.id,
    initialBoard: blueprint.initialBoard,
    columnQueues: blueprint.columnQueues,
    researchClueQueue: blueprint.researchClueQueue,
    actions,
    expectedFinalSnapshotHash: session.hash(),
  };
};

const scenarioBlueprints: Array<{
  id: ScenarioConfig['id'];
  orderId: ScenarioConfig['orderId'];
  seed: number;
  cases: CaseBlueprint[];
}> = [
  {
    id: 'RS01_TUTORIAL_REPEAT',
    orderId: 'ORD_01',
    seed: 0x52533031,
    cases: [repeatedRecipeCase()],
  },
  {
    id: 'RS02_MULTI_RECIPE',
    orderId: 'ORD_02',
    seed: 0x52533032,
    cases: [twoRecipeCase()],
  },
  {
    id: 'RS03_DARK',
    orderId: 'ORD_03',
    seed: 0x52533033,
    cases: [darkCase()],
  },
  {
    id: 'RS04_INSPIRATION',
    orderId: 'ORD_03',
    seed: 0x52533034,
    cases: [inspirationCase()],
  },
  {
    id: 'RS05_TIMER_END',
    orderId: 'ORD_01',
    seed: 0x52533035,
    cases: timerCases(),
  },
];

scenarioBlueprints.forEach((blueprint) => {
  const scenario: ScenarioConfig = {
    schemaVersion: 2,
    id: blueprint.id,
    orderId: blueprint.orderId,
    seed: blueprint.seed,
    cases: blueprint.cases.map((testCase) =>
      materializeCase(blueprint.id, blueprint.seed, testCase)),
  };
  writeFileSync(
    join(scenarioDirectory, `${scenario.id}.json`),
    `${JSON.stringify(scenario, null, 2)}\n`,
  );
  console.log(`${scenario.id}: ${scenario.cases.map((testCase) =>
    testCase.expectedFinalSnapshotHash).join(', ')}`);
});
