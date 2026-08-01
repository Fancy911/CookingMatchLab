import { RecipeResolver, type ConfigBundle } from '../../domain/cp0b/core';
import { stableHash } from '../../domain/cp0b/stable';
import type {
  IngredientConfig,
  IngredientId,
  GameplayConfig,
  OrderConfig,
  RecipeConfig,
  ScenarioAction,
  ScenarioConfig,
  RecipeId,
  TutorialConfig,
} from '../../domain/cp0b/types';

export interface RawConfigData {
  gameplay: unknown;
  ingredients: unknown;
  recipes: unknown;
  orders: unknown;
  tutorials: unknown;
  scenarios: unknown[];
}

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const array = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

const number = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
};

const integer = (value: unknown, label: string): number => {
  const result = number(value, label);
  if (!Number.isInteger(result)) {
    throw new Error(`${label} must be an integer`);
  }
  return result;
};

const positiveInteger = (value: unknown, label: string): number => {
  const result = integer(value, label);
  if (result <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return result;
};

const nonNegativeInteger = (value: unknown, label: string): number => {
  const result = integer(value, label);
  if (result < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return result;
};

const schema2 = (value: unknown, label: string): Record<string, unknown> => {
  const result = object(value, label);
  if (integer(result.schemaVersion, `${label}.schemaVersion`) !== 2) {
    throw new Error(`${label}.schemaVersion must be 2`);
  }
  return result;
};

const INGREDIENT_IDS: IngredientId[] = [
  'ING_TOMATO',
  'ING_EGG',
  'ING_POTATO',
  'ING_CARROT',
  'ING_MUSHROOM',
  'ING_SCALLION',
];

const RECIPE_IDS: RecipeId[] = [
  'RCP_TOMATO_EGG',
  'RCP_SCALLION_POTATO_CAKE',
  'RCP_GARDEN_MUSHROOM_SOUP',
  'RCP_WARM_HOTPOT_MIX',
  'RCP_CHARRED_TOMATO_POTATO_BALL',
  'RCP_STAR_MUSHROOM_EGG_CUP',
];

const SCENARIO_IDS = [
  'RS01_TUTORIAL_REPEAT',
  'RS02_MULTI_RECIPE',
  'RS03_DARK',
  'RS04_INSPIRATION',
  'RS05_TIMER_END',
] as const;

export class ConfigRegistry implements ConfigBundle {
  public readonly symbolToIngredient: Map<string, IngredientId>;
  public readonly ingredientById: Map<IngredientId, IngredientConfig>;
  public readonly recipeById: Map<RecipeId, RecipeConfig>;
  public readonly orderById: Map<string, OrderConfig>;
  public readonly scenarioById: Map<string, ScenarioConfig>;
  public readonly configHash: string;

  public constructor(
    public readonly gameplay: GameplayConfig,
    public readonly ingredients: IngredientConfig[],
    public readonly recipes: RecipeConfig[],
    public readonly orders: OrderConfig[],
    public readonly tutorials: TutorialConfig[],
    public readonly scenarios: ScenarioConfig[],
  ) {
    this.symbolToIngredient = new Map(ingredients.map((item) => [item.symbol, item.id]));
    this.ingredientById = new Map(ingredients.map((item) => [item.id, item]));
    this.recipeById = new Map(recipes.map((item) => [item.id, item]));
    this.orderById = new Map(orders.map((item) => [item.id, item]));
    this.scenarioById = new Map(scenarios.map((item) => [item.id, item]));
    this.validate();
    this.configHash = stableHash({
      gameplay,
      ingredients,
      recipes,
      orders,
      tutorials,
      scenarios: [...scenarios].sort((left, right) => left.id.localeCompare(right.id)),
    });
  }

  public static fromRaw(raw: RawConfigData): ConfigRegistry {
    const gameplayRoot = schema2(raw.gameplay, 'gameplay');
    const ingredientsRoot = schema2(raw.ingredients, 'ingredients');
    const recipesRoot = schema2(raw.recipes, 'recipes');
    const ordersRoot = schema2(raw.orders, 'orders');
    const tutorialsRoot = schema2(raw.tutorials, 'tutorials');
    raw.scenarios.forEach((scenario, index) => schema2(scenario, `scenarios[${index}]`));
    return new ConfigRegistry(
      gameplayRoot as unknown as GameplayConfig,
      array(ingredientsRoot.ingredients, 'ingredients.ingredients') as IngredientConfig[],
      array(recipesRoot.recipes, 'recipes.recipes') as RecipeConfig[],
      array(ordersRoot.orders, 'orders.orders') as OrderConfig[],
      array(tutorialsRoot.tutorials, 'tutorials.tutorials') as TutorialConfig[],
      raw.scenarios as ScenarioConfig[],
    );
  }

  private validate(): void {
    this.validateGameplay();
    this.validateIngredients();
    this.validateRecipes();
    this.validateOrders();
    this.validateTutorials();
    this.validateScenarios();
    this.validateRecipeDeterminism();
  }

  private validateGameplay(): void {
    const gameplay = object(this.gameplay, 'gameplay');
    const board = object(gameplay.board, 'gameplay.board');
    const session = object(gameplay.session, 'gameplay.session');
    const pot = object(gameplay.pot, 'gameplay.pot');
    const longLink = object(gameplay.longLink, 'gameplay.longLink');
    const inspiration = object(gameplay.inspiration, 'gameplay.inspiration');
    const combo = object(gameplay.combo, 'gameplay.combo');
    const linkScore = object(gameplay.linkScore, 'gameplay.linkScore');
    const shuffle = object(gameplay.shuffle, 'gameplay.shuffle');
    const star = object(gameplay.star, 'gameplay.star');
    const dishScore = object(gameplay.dishScore, 'gameplay.dishScore');
    const history = object(gameplay.history, 'gameplay.history');

    if (integer(board.rows, 'gameplay.board.rows') !== 7
      || integer(board.columns, 'gameplay.board.columns') !== 7) {
      throw new Error('gameplay.board must be exactly 7x7');
    }
    positiveInteger(board.ingredientTypeCount, 'gameplay.board.ingredientTypeCount');
    if (![4, 8].includes(integer(board.connectionDirections, 'gameplay.board.connectionDirections'))) {
      throw new Error('gameplay.board.connectionDirections must be 4 or 8');
    }
    if (integer(board.minimumLink, 'gameplay.board.minimumLink') !== 3) {
      throw new Error('gameplay.board.minimumLink must be 3');
    }
    if (positiveInteger(session.activeTimeMs, 'gameplay.session.activeTimeMs') !== 90_000) {
      throw new Error('gameplay.session.activeTimeMs must be 90000');
    }
    if (positiveInteger(session.linkingGraceMs, 'gameplay.session.linkingGraceMs') !== 1_000) {
      throw new Error('gameplay.session.linkingGraceMs must be 1000');
    }
    const activeStates = array(session.activeTimeStates, 'gameplay.session.activeTimeStates')
      .map((value, index) => string(value, `gameplay.session.activeTimeStates[${index}]`));
    if (stableHash([...activeStates].sort()) !== stableHash(['LINKING', 'READY'])) {
      throw new Error('gameplay.session.activeTimeStates must contain READY and LINKING');
    }
    if (positiveInteger(pot.minimumUnitsToCook, 'gameplay.pot.minimumUnitsToCook') !== 4
      || positiveInteger(pot.maximumUnits, 'gameplay.pot.maximumUnits') !== 6) {
      throw new Error('gameplay.pot must use 4 minimum and 6 maximum units');
    }
    const precise = positiveInteger(longLink.precise, 'gameplay.longLink.precise');
    const inspirationThreshold =
      positiveInteger(longLink.inspiration, 'gameplay.longLink.inspiration');
    const master = positiveInteger(longLink.master, 'gameplay.longLink.master');
    if (!(precise < inspirationThreshold && inspirationThreshold < master)) {
      throw new Error('gameplay.longLink thresholds must be strictly increasing');
    }
    const processingScores = object(
      longLink.processingScores,
      'gameplay.longLink.processingScores',
    );
    ['NORMAL', 'PRECISE', 'INSPIRATION', 'MASTER'].forEach((level) =>
      nonNegativeInteger(
        processingScores[level],
        `gameplay.longLink.processingScores.${level}`,
      ));
    const audioEvents = object(longLink.audioEvents, 'gameplay.longLink.audioEvents');
    if (string(audioEvents.PRECISE, 'gameplay.longLink.audioEvents.PRECISE') !== 'GOOD'
      || string(audioEvents.INSPIRATION, 'gameplay.longLink.audioEvents.INSPIRATION') !== 'GREAT'
      || string(audioEvents.MASTER, 'gameplay.longLink.audioEvents.MASTER') !== 'UNBELIEVABLE') {
      throw new Error('gameplay.longLink.audioEvents must map to GOOD/GREAT/UNBELIEVABLE');
    }
    if (string(inspiration.spawnStrategy, 'gameplay.inspiration.spawnStrategy')
      !== 'PATH_END_COLUMN_FIRST_NEW_CELL') {
      throw new Error('gameplay.inspiration.spawnStrategy is unsupported');
    }
    nonNegativeInteger(
      inspiration.collectedScoreBonus,
      'gameplay.inspiration.collectedScoreBonus',
    );
    nonNegativeInteger(inspiration.processingBonus, 'gameplay.inspiration.processingBonus');
    positiveInteger(inspiration.processingMaximum, 'gameplay.inspiration.processingMaximum');

    if (positiveInteger(combo.windowMs, 'gameplay.combo.windowMs') !== 3_000) {
      throw new Error('gameplay.combo.windowMs must be 3000');
    }
    const comboTiers = array(combo.tiers, 'gameplay.combo.tiers');
    if (comboTiers.length !== 5) {
      throw new Error('gameplay.combo.tiers must contain five tiers');
    }
    comboTiers.forEach((rawTier, index) => {
      const tier = object(rawTier, `gameplay.combo.tiers[${index}]`);
      positiveInteger(tier.minimumCount, `gameplay.combo.tiers[${index}].minimumCount`);
      if (tier.maximumCount !== null) {
        positiveInteger(tier.maximumCount, `gameplay.combo.tiers[${index}].maximumCount`);
      }
      if (number(tier.multiplier, `gameplay.combo.tiers[${index}].multiplier`) <= 0) {
        throw new Error(`gameplay.combo.tiers[${index}].multiplier must be positive`);
      }
    });
    positiveInteger(linkScore.pointsPerCell, 'gameplay.linkScore.pointsPerCell');
    const lengthRewards = array(linkScore.lengthRewards, 'gameplay.linkScore.lengthRewards');
    if (lengthRewards.length !== 4) {
      throw new Error('gameplay.linkScore.lengthRewards must contain four tiers');
    }
    lengthRewards.forEach((rawReward, index) => {
      const reward = object(rawReward, `gameplay.linkScore.lengthRewards[${index}]`);
      positiveInteger(reward.minimumLength, `gameplay.linkScore.lengthRewards[${index}].minimumLength`);
      if (reward.maximumLength !== null) {
        positiveInteger(
          reward.maximumLength,
          `gameplay.linkScore.lengthRewards[${index}].maximumLength`,
        );
      }
      nonNegativeInteger(reward.bonus, `gameplay.linkScore.lengthRewards[${index}].bonus`);
    });
    if (string(shuffle.algorithm, 'gameplay.shuffle.algorithm')
      !== 'fisher-yates-xorshift32-v1') {
      throw new Error('gameplay.shuffle.algorithm is unsupported');
    }
    positiveInteger(shuffle.maximumAttempts, 'gameplay.shuffle.maximumAttempts');

    const recipeAccuracy = object(star.recipeAccuracy, 'gameplay.star.recipeAccuracy');
    nonNegativeInteger(recipeAccuracy.explicit, 'gameplay.star.recipeAccuracy.explicit');
    nonNegativeInteger(recipeAccuracy.fallback, 'gameplay.star.recipeAccuracy.fallback');
    const starWeights = object(star.weights, 'gameplay.star.weights');
    const accuracyWeight = number(starWeights.accuracy, 'gameplay.star.weights.accuracy');
    const processingWeight = number(starWeights.processing, 'gameplay.star.weights.processing');
    if (Math.abs(accuracyWeight + processingWeight - 1) > 1e-9) {
      throw new Error('gameplay.star.weights must sum to 1');
    }
    const thresholds = object(star.thresholds, 'gameplay.star.thresholds');
    const two = number(thresholds.two, 'gameplay.star.thresholds.two');
    const three = number(thresholds.three, 'gameplay.star.thresholds.three');
    if (!(two >= 0 && two < three && three <= 100)) {
      throw new Error('gameplay.star.thresholds must be ordered within 0..100');
    }
    nonNegativeInteger(star.fallbackMaximumScore, 'gameplay.star.fallbackMaximumScore');
    positiveInteger(star.fallbackMaximumStars, 'gameplay.star.fallbackMaximumStars');

    const rarityBase = object(dishScore.rarityBase, 'gameplay.dishScore.rarityBase');
    ['NORMAL', 'FEATURED', 'RARE'].forEach((rarity) =>
      nonNegativeInteger(rarityBase[rarity], `gameplay.dishScore.rarityBase.${rarity}`));
    nonNegativeInteger(dishScore.darkTagBonus, 'gameplay.dishScore.darkTagBonus');
    nonNegativeInteger(dishScore.perStar, 'gameplay.dishScore.perStar');
    nonNegativeInteger(dishScore.firstDiscovery, 'gameplay.dishScore.firstDiscovery');
    nonNegativeInteger(dishScore.researchClueMatch, 'gameplay.dishScore.researchClueMatch');
    positiveInteger(history.processedCookResultLimit, 'gameplay.history.processedCookResultLimit');
  }

  private validateIngredients(): void {
    if (this.ingredients.length !== INGREDIENT_IDS.length) {
      throw new Error('ingredients.ingredients must contain exactly six ingredients');
    }
    const ids = this.ingredients.map((ingredient) =>
      string(ingredient.id, 'ingredient.id') as IngredientId);
    INGREDIENT_IDS.forEach((id) => {
      if (!ids.includes(id)) {
        throw new Error(`ingredients is missing ${id}`);
      }
    });
    this.ingredients.forEach((ingredient) => {
      string(ingredient.symbol, `${ingredient.id}.symbol`);
      string(ingredient.name, `${ingredient.id}.name`);
    });
  }

  private validateRecipes(): void {
    if (this.recipes.length !== RECIPE_IDS.length) {
      throw new Error('recipes.recipes must contain exactly six recipes');
    }
    RECIPE_IDS.forEach((id) => {
      if (!this.recipeById.has(id)) {
        throw new Error(`recipes is missing ${id}`);
      }
    });
    const fallback = this.recipes.filter((recipe) => recipe.fallback);
    if (fallback.length !== 1 || fallback[0].id !== 'RCP_WARM_HOTPOT_MIX') {
      throw new Error('recipes must contain one warm-hotpot fallback');
    }
    this.recipes.forEach((recipe) => {
      string(recipe.id, 'recipe.id');
      string(recipe.name, `${recipe.id}.name`);
      if (!['NORMAL', 'FEATURED', 'RARE'].includes(recipe.rarity)) {
        throw new Error(`${recipe.id}.rarity is invalid`);
      }
      positiveInteger(recipe.priority + (recipe.fallback ? 1 : 0), `${recipe.id}.priority`);
      const required = object(recipe.required, `${recipe.id}.required`);
      let total = 0;
      Object.entries(required).forEach(([ingredientId, amount]) => {
        if (!this.ingredientById.has(ingredientId as IngredientId)) {
          throw new Error(`${recipe.id}.required references unknown ingredient ${ingredientId}`);
        }
        total += positiveInteger(amount, `${recipe.id}.required.${ingredientId}`);
      });
      if (!recipe.fallback && total !== 5) {
        throw new Error(`${recipe.id}.required must total exactly 5 units`);
      }
      array(recipe.requiredConditions, `${recipe.id}.requiredConditions`).forEach(
        (condition, index) => {
          if (!['INSPIRATION', 'MASTER'].includes(
            string(condition, `${recipe.id}.requiredConditions[${index}]`),
          )) {
            throw new Error(`${recipe.id}.requiredConditions[${index}] is invalid`);
          }
        },
      );
    });
  }

  private validateOrders(): void {
    if (this.orders.length !== 3) {
      throw new Error('orders.orders must contain exactly three orders');
    }
    const clueIds = new Set<string>();
    this.orders.forEach((order) => {
      string(order.id, 'order.id');
      string(order.title, `${order.id}.title`);
      if (positiveInteger(order.initialActiveTimeMs, `${order.id}.initialActiveTimeMs`)
        !== this.gameplay.session.activeTimeMs) {
        throw new Error(`${order.id}.initialActiveTimeMs must match gameplay session time`);
      }
      array(order.ingredientPool, `${order.id}.ingredientPool`).forEach((id, index) => {
        if (!this.ingredientById.has(id as IngredientId)) {
          throw new Error(`${order.id}.ingredientPool[${index}] references unknown ingredient`);
        }
      });
      const clues = array(order.clues, `${order.id}.clues`);
      if (clues.length === 0) {
        throw new Error(`${order.id}.clues must not be empty`);
      }
      clues.forEach((rawClue, index) => {
        const clue = object(rawClue, `${order.id}.clues[${index}]`);
        const clueId = string(clue.id, `${order.id}.clues[${index}].id`);
        const recipeId = string(
          clue.recipeId,
          `${order.id}.clues[${index}].recipeId`,
        ) as RecipeId;
        string(clue.text, `${order.id}.clues[${index}].text`);
        if (!this.recipeById.has(recipeId)) {
          throw new Error(`${order.id}.clues[${index}] references unknown recipe ${recipeId}`);
        }
        if (clueIds.has(clueId)) {
          throw new Error(`Duplicate research clue id ${clueId}`);
        }
        clueIds.add(clueId);
      });
    });
  }

  private validateTutorials(): void {
    this.tutorials.forEach((tutorial) => {
      string(tutorial.id, 'tutorial.id');
      string(tutorial.trigger, `${tutorial.id}.trigger`);
      string(tutorial.text, `${tutorial.id}.text`);
      if (typeof tutorial.once !== 'boolean') {
        throw new Error(`${tutorial.id}.once must be boolean`);
      }
    });
  }

  private validateScenarios(): void {
    if (this.scenarios.length !== SCENARIO_IDS.length) {
      throw new Error('scenarios must contain exactly RS01 through RS05');
    }
    const clueIds = new Set(this.orders.flatMap((order) => order.clues.map((clue) => clue.id)));
    SCENARIO_IDS.forEach((scenarioId) => {
      if (!this.scenarioById.has(scenarioId)) {
        throw new Error(`scenarios is missing ${scenarioId}`);
      }
    });
    this.scenarios.forEach((scenario) => {
      if (!this.orderById.has(scenario.orderId)) {
        throw new Error(`${scenario.id}.orderId references unknown order ${scenario.orderId}`);
      }
      integer(scenario.seed, `${scenario.id}.seed`);
      const cases = array(scenario.cases, `${scenario.id}.cases`);
      if (cases.length === 0) {
        throw new Error(`${scenario.id}.cases must not be empty`);
      }
      cases.forEach((rawCase, caseIndex) => {
        const testCase = object(rawCase, `${scenario.id}.cases[${caseIndex}]`);
        const caseLabel = `${scenario.id}.cases[${caseIndex}]`;
        string(testCase.id, `${caseLabel}.id`);
        const board = array(testCase.initialBoard, `${caseLabel}.initialBoard`);
        if (board.length !== this.gameplay.board.rows) {
          throw new Error(`${caseLabel}.initialBoard must have 7 rows`);
        }
        board.forEach((rawRow, rowIndex) => {
          const row = array(rawRow, `${caseLabel}.initialBoard[${rowIndex}]`);
          if (row.length !== this.gameplay.board.columns) {
            throw new Error(`${caseLabel}.initialBoard[${rowIndex}] must have 7 columns`);
          }
          row.forEach((symbol, columnIndex) => {
            const base = string(
              symbol,
              `${caseLabel}.initialBoard[${rowIndex}][${columnIndex}]`,
            ).replace('*', '');
            if (!this.symbolToIngredient.has(base)) {
              throw new Error(`${caseLabel}.initialBoard contains unknown symbol ${symbol}`);
            }
          });
        });
        const queues = object(testCase.columnQueues, `${caseLabel}.columnQueues`);
        for (let column = 0; column < this.gameplay.board.columns; column += 1) {
          const queue = array(queues[String(column)], `${caseLabel}.columnQueues.${column}`);
          if (queue.length === 0) {
            throw new Error(`${caseLabel}.columnQueues.${column} must not be empty`);
          }
          queue.forEach((symbol, index) => {
            const base = string(
              symbol,
              `${caseLabel}.columnQueues.${column}[${index}]`,
            ).replace('*', '');
            if (!this.symbolToIngredient.has(base)) {
              throw new Error(`${caseLabel}.columnQueues.${column} contains unknown symbol ${symbol}`);
            }
          });
        }
        array(testCase.researchClueQueue, `${caseLabel}.researchClueQueue`).forEach(
          (clueId, index) => {
            if (!clueIds.has(string(clueId, `${caseLabel}.researchClueQueue[${index}]`))) {
              throw new Error(`${caseLabel}.researchClueQueue[${index}] is unknown`);
            }
          },
        );
        const actions = array(testCase.actions, `${caseLabel}.actions`) as ScenarioAction[];
        if (actions.length === 0) {
          throw new Error(`${caseLabel}.actions must not be empty`);
        }
        actions.forEach((action, actionIndex) =>
          this.validateScenarioAction(action, `${caseLabel}.actions[${actionIndex}]`));
        string(testCase.expectedFinalSnapshotHash, `${caseLabel}.expectedFinalSnapshotHash`);
      });
    });
  }

  private validateScenarioAction(action: ScenarioAction, label: string): void {
    const raw = object(action, label);
    const type = string(raw.type, `${label}.type`);
    if (![
      'ADVANCE_ACTIVE_TIME',
      'LINK',
      'COMPLETE_ANIMATION',
      'FIRE',
      'CONFIRM_AUTO_FIRE',
      'COMPLETE_REVEAL',
    ].includes(type)) {
      throw new Error(`${label}.type is unsupported`);
    }
    const expected = object(raw.expected, `${label}.expected`);
    const potUnits = object(expected.potUnits, `${label}.expected.potUnits`);
    Object.entries(potUnits).forEach(([ingredientId, amount]) => {
      if (!this.ingredientById.has(ingredientId as IngredientId)) {
        throw new Error(`${label}.expected.potUnits references unknown ingredient ${ingredientId}`);
      }
      nonNegativeInteger(amount, `${label}.expected.potUnits.${ingredientId}`);
    });
    nonNegativeInteger(
      expected.remainingActiveTimeMs,
      `${label}.expected.remainingActiveTimeMs`,
    );
    nonNegativeInteger(expected.comboCount, `${label}.expected.comboCount`);
    nonNegativeInteger(expected.totalScore, `${label}.expected.totalScore`);
    array(expected.tags, `${label}.expected.tags`);
    string(expected.phase, `${label}.expected.phase`);
    if (type === 'ADVANCE_ACTIVE_TIME') {
      nonNegativeInteger(raw.milliseconds, `${label}.milliseconds`);
    }
    if (type === 'LINK') {
      const path = array(raw.path, `${label}.path`);
      if (path.length < this.gameplay.board.minimumLink) {
        throw new Error(`${label}.path must contain at least three coordinates`);
      }
      path.forEach((coord, index) => {
        const pair = array(coord, `${label}.path[${index}]`);
        if (pair.length !== 2) {
          throw new Error(`${label}.path[${index}] must be a coordinate pair`);
        }
        pair.forEach((value, axis) => nonNegativeInteger(
          value,
          `${label}.path[${index}][${axis}]`,
        ));
      });
      positiveInteger(expected.pathLength, `${label}.expected.pathLength`);
      string(expected.ingredientId, `${label}.expected.ingredientId`);
      nonNegativeInteger(expected.linkScore, `${label}.expected.linkScore`);
    }
    if (Object.prototype.hasOwnProperty.call(raw, 'expectedRecipeId')) {
      const recipeId = string(raw.expectedRecipeId, `${label}.expectedRecipeId`) as RecipeId;
      if (!this.recipeById.has(recipeId)) {
        throw new Error(`${label}.expectedRecipeId references unknown recipe ${recipeId}`);
      }
    }
  }

  private validateRecipeDeterminism(): void {
    const resolver = new RecipeResolver(this.recipes);
    const tags: Array<Array<'INSPIRATION' | 'MASTER'>> = [
      [],
      ['INSPIRATION'],
      ['MASTER'],
      ['INSPIRATION', 'MASTER'],
    ];
    const units: Partial<Record<IngredientId, number>> = {};
    const enumerate = (ingredientIndex: number, remaining: number): void => {
      if (ingredientIndex === INGREDIENT_IDS.length - 1) {
        units[INGREDIENT_IDS[ingredientIndex]] = remaining;
        tags.forEach((tagSet) => {
          const matches = resolver.matchingExplicit(units, tagSet);
          if (matches.length > 1) {
            throw new Error(`Recipe conflict: ${matches.map((recipe) => recipe.id).join(', ')}`);
          }
          resolver.resolve(units, tagSet);
        });
        return;
      }
      const ingredientId = INGREDIENT_IDS[ingredientIndex];
      for (let amount = 0; amount <= remaining; amount += 1) {
        units[ingredientId] = amount;
        enumerate(ingredientIndex + 1, remaining - amount);
      }
    };
    [4, 5, 6].forEach((total) => enumerate(0, total));
  }
}
