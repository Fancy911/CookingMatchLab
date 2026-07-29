import { RecipeResolver } from '../../domain/cp0b/core';
import {
  type GameplayConfig,
  type IngredientConfig,
  type IngredientId,
  type OrderConfig,
  type ProcessingTag,
  type RecipeConfig,
  type ScenarioConfig,
  type ScenarioId,
  type TutorialConfig,
} from '../../domain/cp0b/types';
import { stableHash } from '../../domain/cp0b/stable';

export interface RawConfigData {
  gameplay: unknown;
  ingredients: unknown;
  recipes: unknown;
  orders: unknown;
  tutorials: unknown;
  scenarios: unknown[];
}

const requiredObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const requiredArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
};

const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

const requiredNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
};

const requiredInteger = (value: unknown, label: string): number => {
  const number = requiredNumber(value, label);
  if (!Number.isInteger(number)) {
    throw new Error(`${label} must be an integer`);
  }
  return number;
};

const requiredNonNegativeNumber = (value: unknown, label: string): number => {
  const number = requiredNumber(value, label);
  if (number < 0) {
    throw new Error(`${label} must be non-negative`);
  }
  return number;
};

const requiredNonNegativeInteger = (value: unknown, label: string): number => {
  const number = requiredInteger(value, label);
  if (number < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return number;
};

const requiredPositiveInteger = (value: unknown, label: string): number => {
  const number = requiredInteger(value, label);
  if (number <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return number;
};

const requireUnitSum = (
  entries: Array<[label: string, value: unknown]>,
  groupLabel: string,
): number[] => {
  const values = entries.map(([label, value]) => requiredNonNegativeNumber(value, label));
  if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) {
    throw new Error(`${groupLabel} must sum to 1`);
  }
  return values;
};

export class ConfigRegistry {
  public readonly ingredientById: Map<IngredientId, IngredientConfig>;
  public readonly recipeById: Map<string, RecipeConfig>;
  public readonly orderById: Map<string, OrderConfig>;
  public readonly scenarioById: Map<ScenarioId, ScenarioConfig>;
  public readonly symbolToIngredient: Map<string, IngredientId>;
  public readonly normalUnitValueById: Record<IngredientId, number>;
  public readonly configHash: string;

  public constructor(
    public readonly gameplay: GameplayConfig,
    public readonly ingredients: IngredientConfig[],
    public readonly recipes: RecipeConfig[],
    public readonly orders: OrderConfig[],
    public readonly tutorials: TutorialConfig[],
    public readonly scenarios: ScenarioConfig[],
  ) {
    this.ingredientById = new Map(ingredients.map((item) => [item.id, item]));
    this.recipeById = new Map(recipes.map((item) => [item.id, item]));
    this.orderById = new Map(orders.map((item) => [item.id, item]));
    this.scenarioById = new Map(scenarios.map((item) => [item.id, item]));
    this.symbolToIngredient = new Map(ingredients.map((item) => [item.symbol, item.id]));
    this.normalUnitValueById = Object.fromEntries(
      ingredients.map((item) => [item.id, item.normalUnitValue]),
    ) as Record<IngredientId, number>;
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
    const gameplayObject = requiredObject(raw.gameplay, 'gameplay');
    ConfigRegistry.assertSchema(gameplayObject, 'gameplay');
    const ingredientRoot = requiredObject(raw.ingredients, 'ingredients');
    const recipeRoot = requiredObject(raw.recipes, 'recipes');
    const orderRoot = requiredObject(raw.orders, 'orders');
    const tutorialRoot = requiredObject(raw.tutorials, 'tutorials');
    ConfigRegistry.assertSchema(ingredientRoot, 'ingredients');
    ConfigRegistry.assertSchema(recipeRoot, 'recipes');
    ConfigRegistry.assertSchema(orderRoot, 'orders');
    ConfigRegistry.assertSchema(tutorialRoot, 'tutorials');
    raw.scenarios.forEach((scenario, index) =>
      ConfigRegistry.assertSchema(requiredObject(scenario, `scenarios[${index}]`), `scenarios[${index}]`));

    return new ConfigRegistry(
      gameplayObject as unknown as GameplayConfig,
      requiredArray(ingredientRoot.ingredients, 'ingredients.ingredients') as IngredientConfig[],
      requiredArray(recipeRoot.recipes, 'recipes.recipes') as RecipeConfig[],
      requiredArray(orderRoot.orders, 'orders.orders') as OrderConfig[],
      requiredArray(tutorialRoot.tutorials, 'tutorials.tutorials') as TutorialConfig[],
      raw.scenarios as ScenarioConfig[],
    );
  }

  private static assertSchema(object: Record<string, unknown>, label: string): void {
    if (requiredNumber(object.schemaVersion, `${label}.schemaVersion`) !== 1) {
      throw new Error(`${label}.schemaVersion must be 1`);
    }
  }

  private validate(): void {
    const gameplay = requiredObject(this.gameplay, 'gameplay');
    const board = requiredObject(gameplay.board, 'gameplay.board');
    const pot = requiredObject(gameplay.pot, 'gameplay.pot');
    const longLink = requiredObject(gameplay.longLink, 'gameplay.longLink');
    const inspiration = requiredObject(gameplay.inspiration, 'gameplay.inspiration');
    const shuffle = requiredObject(gameplay.shuffle, 'gameplay.shuffle');
    const star = requiredObject(gameplay.star, 'gameplay.star');
    if (requiredNumber(board.rows, 'gameplay.board.rows') !== 7
      || requiredNumber(board.columns, 'gameplay.board.columns') !== 7) {
      throw new Error('CP0-B board must be exactly 7x7');
    }
    requiredPositiveInteger(board.ingredientTypeCount, 'gameplay.board.ingredientTypeCount');
    if (![4, 8].includes(requiredNumber(board.connectionDirections, 'gameplay.board.connectionDirections'))) {
      throw new Error('Connection directions must be 4 or 8');
    }
    if (requiredNumber(board.minimumLink, 'gameplay.board.minimumLink') < 3) {
      throw new Error('Minimum link must be at least 3');
    }
    if (requiredNumber(pot.baseSlots, 'gameplay.pot.baseSlots') !== 3
      || requiredNumber(pot.minimumThrowsToCook, 'gameplay.pot.minimumThrowsToCook') !== 2) {
      throw new Error('CP0-B pot requires 3 base slots and 2 throws to cook');
    }
    requiredNonNegativeInteger(pot.temporarySlots, 'gameplay.pot.temporarySlots');
    if (!(requiredNumber(longLink.fine, 'gameplay.longLink.fine')
      < requiredNumber(longLink.inspiration, 'gameplay.longLink.inspiration')
      && requiredNumber(longLink.inspiration, 'gameplay.longLink.inspiration')
      < requiredNumber(longLink.master, 'gameplay.longLink.master'))) {
      throw new Error('Long-link thresholds must be strictly increasing');
    }
    if (requiredNumber(inspiration.unitValue, 'gameplay.inspiration.unitValue') !== 2) {
      throw new Error('CP0-B inspiration unit value must be 2');
    }
    if (requiredString(inspiration.spawnStrategy, 'gameplay.inspiration.spawnStrategy')
      !== 'PATH_END_COLUMN_FIRST_NEW_CELL') {
      throw new Error('gameplay.inspiration.spawnStrategy is unsupported');
    }
    if (requiredString(shuffle.algorithm, 'gameplay.shuffle.algorithm')
      !== 'fisher-yates-xorshift32-v1') {
      throw new Error('gameplay.shuffle.algorithm is unsupported');
    }
    requiredPositiveInteger(shuffle.maximumAttempts, 'gameplay.shuffle.maximumAttempts');

    const recipeWeights = requiredObject(star.recipeWeights, 'gameplay.star.recipeWeights');
    const processingScores = requiredObject(star.processingScores, 'gameplay.star.processingScores');
    const efficiencyScores = requiredObject(star.efficiencyScores, 'gameplay.star.efficiencyScores');
    const weights = requiredObject(star.weights, 'gameplay.star.weights');
    const thresholds = requiredObject(star.thresholds, 'gameplay.star.thresholds');
    if (requiredNumber(star.quantityDeviationFactor, 'gameplay.star.quantityDeviationFactor') <= 0) {
      throw new Error('gameplay.star.quantityDeviationFactor must be positive');
    }
    requireUnitSum([
      ['gameplay.star.recipeWeights.quantity', recipeWeights.quantity],
      ['gameplay.star.recipeWeights.ratio', recipeWeights.ratio],
    ], 'gameplay.star.recipeWeights');
    [
      'normal',
      'fine',
      'inspiration',
      'master',
      'inspirationBonus',
      'maximum',
    ].forEach((key) =>
      requiredNonNegativeNumber(
        processingScores[key],
        `gameplay.star.processingScores.${key}`,
      ));
    ['high', 'pass', 'low'].forEach((key) =>
      requiredNonNegativeNumber(
        efficiencyScores[key],
        `gameplay.star.efficiencyScores.${key}`,
      ));
    requireUnitSum([
      ['gameplay.star.weights.recipe', weights.recipe],
      ['gameplay.star.weights.processing', weights.processing],
      ['gameplay.star.weights.efficiency', weights.efficiency],
    ], 'gameplay.star.weights');
    const twoStarThreshold = requiredNonNegativeNumber(
      thresholds.two,
      'gameplay.star.thresholds.two',
    );
    const threeStarThreshold = requiredNonNegativeNumber(
      thresholds.three,
      'gameplay.star.thresholds.three',
    );
    if (!(twoStarThreshold < threeStarThreshold && threeStarThreshold <= 100)) {
      throw new Error('gameplay.star.thresholds must satisfy 0 <= two < three <= 100');
    }

    if (this.ingredients.length !== 6 || this.ingredientById.size !== 6) {
      throw new Error('Exactly six unique ingredients are required');
    }
    const expectedIngredientIds: IngredientId[] = [
      'ING_TOMATO',
      'ING_EGG',
      'ING_POTATO',
      'ING_CARROT',
      'ING_MUSHROOM',
      'ING_SCALLION',
    ];
    if (expectedIngredientIds.some((id) => !this.ingredientById.has(id))) {
      throw new Error('Ingredient IDs do not match the frozen CP0-B set');
    }
    for (const ingredient of this.ingredients) {
      requiredString(ingredient.id, 'ingredient.id');
      requiredString(ingredient.name, `ingredient ${ingredient.id}.name`);
      requiredString(ingredient.symbol, `ingredient ${ingredient.id}.symbol`);
      if (ingredient.normalUnitValue !== 1) {
        throw new Error(`${ingredient.id}.normalUnitValue must be 1`);
      }
      requiredString(ingredient.boardSprite, `${ingredient.id}.boardSprite`);
      requiredString(ingredient.potLayer, `${ingredient.id}.potLayer`);
      if (!Array.isArray(ingredient.inspirationOverlay)
        || ingredient.inspirationOverlay.length === 0
        || ingredient.inspirationOverlay.some((path) => typeof path !== 'string' || path.length === 0)) {
        throw new Error(`${ingredient.id}.inspirationOverlay must contain resource IDs`);
      }
    }

    if (this.recipes.length !== 6 || this.recipeById.size !== 6) {
      throw new Error('Exactly six unique recipes are required');
    }
    const fallbacks = this.recipes.filter((recipe) => recipe.fallback);
    if (fallbacks.length !== 1 || fallbacks[0].id !== 'RCP_WARM_HOTPOT_MIX') {
      throw new Error('RCP_WARM_HOTPOT_MIX must be the only fallback recipe');
    }
    const allowedConditions = new Set<ProcessingTag>([
      'FINE',
      'LONG_INSPIRATION',
      'MASTER',
      'INSPIRATION',
    ]);
    for (const recipe of this.recipes) {
      requiredString(recipe.id, 'recipe.id');
      requiredString(recipe.name, `recipe ${recipe.id}.name`);
      requiredString(recipe.dishAsset, `${recipe.id}.dishAsset`);
      if (recipe.potId !== 'POT_BASE_RESEARCH') {
        throw new Error(`${recipe.id} references unknown pot ${String(recipe.potId)}`);
      }
      for (const [ingredientId, range] of Object.entries(recipe.required)) {
        if (!this.ingredientById.has(ingredientId as IngredientId)) {
          throw new Error(`${recipe.id} references unknown ingredient ${ingredientId}`);
        }
        const rangeObject = requiredObject(range, `${recipe.id}.required.${ingredientId}`);
        const min = requiredNumber(rangeObject.min, `${recipe.id}.${ingredientId}.min`);
        const max = requiredNumber(rangeObject.max, `${recipe.id}.${ingredientId}.max`);
        const ideal = requiredNumber(rangeObject.ideal, `${recipe.id}.${ingredientId}.ideal`);
        if (min > ideal || ideal > max) {
          throw new Error(`${recipe.id}.${ingredientId} must satisfy min <= ideal <= max`);
        }
      }
      recipe.forbidden.forEach((id) => {
        if (!this.ingredientById.has(id)) {
          throw new Error(`${recipe.id} forbids unknown ingredient ${id}`);
        }
      });
      recipe.requiredConditions.forEach((condition) => {
        if (!allowedConditions.has(condition)) {
          throw new Error(`${recipe.id} references unknown condition ${condition}`);
        }
      });
      recipe.ratios.forEach((ratio, index) => {
        [...ratio.numerator, ...ratio.denominator].forEach((id) => {
          if (!this.ingredientById.has(id)) {
            throw new Error(`${recipe.id}.ratios[${index}] references unknown ingredient ${id}`);
          }
        });
        if (ratio.accepted[0] > ratio.ideal[0]
          || ratio.ideal[1] > ratio.accepted[1]
          || ratio.ideal[0] > ratio.ideal[1]) {
          throw new Error(`${recipe.id}.ratios[${index}] has an invalid range`);
        }
      });
    }

    if (this.orders.length !== 3 || this.orderById.size !== 3) {
      throw new Error('Exactly three unique orders are required');
    }
    for (const [orderIndex, order] of this.orders.entries()) {
      const orderObject = requiredObject(order, `orders.orders[${orderIndex}]`);
      const orderId = requiredString(orderObject.id, `orders.orders[${orderIndex}].id`);
      requiredString(orderObject.title, `${orderId}.title`);
      const targetRecipeId = requiredString(orderObject.targetRecipeId, `${orderId}.targetRecipeId`);
      const initialSteps = requiredPositiveInteger(orderObject.initialSteps, `${orderId}.initialSteps`);
      const highEfficiencySteps = requiredNonNegativeInteger(
        orderObject.highEfficiencySteps,
        `${orderId}.highEfficiencySteps`,
      );
      const passEfficiencySteps = requiredNonNegativeInteger(
        orderObject.passEfficiencySteps,
        `${orderId}.passEfficiencySteps`,
      );
      if (!(initialSteps >= highEfficiencySteps && highEfficiencySteps >= passEfficiencySteps)) {
        throw new Error(
          `${orderId} steps must satisfy initialSteps >= highEfficiencySteps >= passEfficiencySteps`,
        );
      }
      const orderMode = requiredString(orderObject.orderMode, `${orderId}.orderMode`);
      if (!['TUTORIAL', 'KNOWN', 'RESEARCH'].includes(orderMode)) {
        throw new Error(`${orderId}.orderMode must be TUTORIAL, KNOWN, or RESEARCH`);
      }
      const defaultScenarioId = requiredString(
        orderObject.defaultScenarioId,
        `${orderId}.defaultScenarioId`,
      );
      if (!this.scenarioById.has(defaultScenarioId as ScenarioId)) {
        throw new Error(`${orderId}.defaultScenarioId references unknown scenario ${defaultScenarioId}`);
      }
      requiredArray(orderObject.clues, `${orderId}.clues`).forEach((clue, index) =>
        requiredString(clue, `${orderId}.clues[${index}]`));
      requiredArray(orderObject.tutorialFlags, `${orderId}.tutorialFlags`).forEach((flag, index) =>
        requiredString(flag, `${orderId}.tutorialFlags[${index}]`));
      const ingredientPool = requiredArray(
        orderObject.ingredientPool,
        `${orderId}.ingredientPool`,
      ) as IngredientId[];
      if (!this.recipeById.has(targetRecipeId)) {
        throw new Error(`${orderId} references unknown recipe ${targetRecipeId}`);
      }
      if (ingredientPool.length !== this.gameplay.board.ingredientTypeCount) {
        throw new Error(`${orderId} must contain exactly five ingredient types`);
      }
      ingredientPool.forEach((id) => {
        if (!this.ingredientById.has(id)) {
          throw new Error(`${orderId} references unknown ingredient ${id}`);
        }
      });
      const target = this.recipeById.get(targetRecipeId)!;
      if (Object.keys(target.required).length > this.gameplay.pot.baseSlots) {
        throw new Error(`${target.id} is not reachable with three base throws`);
      }
    }

    if (this.scenarios.length !== 5 || this.scenarioById.size !== 5) {
      throw new Error('Exactly five unique scenarios are required');
    }
    const actionTypes = new Set(['LINK', 'FIRE', 'CONTINUE']);
    const expectedKeys = new Set([
      'stepDelta',
      'potUnits',
      'inspirationAt',
      'pathCells',
      'throwUnits',
      'recipeId',
      'remainingSteps',
    ]);
    for (const [scenarioIndex, scenario] of this.scenarios.entries()) {
      const scenarioObject = requiredObject(scenario, `scenarios[${scenarioIndex}]`);
      const scenarioId = requiredString(scenarioObject.id, `scenarios[${scenarioIndex}].id`);
      const orderId = requiredString(scenarioObject.orderId, `${scenarioId}.orderId`);
      if (requiredString(scenarioObject.refillMode, `${scenarioId}.refillMode`) !== 'COLUMN_QUEUE') {
        throw new Error(`${scenarioId}.refillMode must be COLUMN_QUEUE`);
      }
      const initialBoard = requiredArray(
        scenarioObject.initialBoard,
        `${scenarioId}.initialBoard`,
      ) as string[][];
      const columnQueues = requiredObject(scenarioObject.columnQueues, `${scenarioId}.columnQueues`);
      const actionScript = requiredArray(
        scenarioObject.expectedActionScript,
        `${scenarioId}.expectedActionScript`,
      );
      const expectedFinalResult = requiredString(
        scenarioObject.expectedFinalResult,
        `${scenarioId}.expectedFinalResult`,
      );
      const order = this.orderById.get(orderId as OrderConfig['id']);
      if (!order) {
        throw new Error(`${scenarioId} references unknown order ${orderId}`);
      }
      if (initialBoard.length !== this.gameplay.board.rows
        || initialBoard.some((row) => !Array.isArray(row)
          || row.length !== this.gameplay.board.columns)) {
        throw new Error(`${scenarioId} initialBoard must be exactly 7x7`);
      }
      for (const row of initialBoard) {
        for (const symbol of row) {
          requiredString(symbol, `${scenarioId}.initialBoard symbol`);
          const baseSymbol = symbol.replace('*', '');
          const id = this.symbolToIngredient.get(baseSymbol);
          if (!id) {
            throw new Error(`${scenarioId} contains unknown symbol ${symbol}`);
          }
          if (!order.ingredientPool.includes(id)) {
            throw new Error(`${scenarioId} contains ${id} outside ${order.id} ingredient pool`);
          }
        }
      }
      for (let column = 0; column < this.gameplay.board.columns; column += 1) {
        const queue = columnQueues[String(column)];
        if (!Array.isArray(queue) || queue.length === 0) {
          throw new Error(`${scenarioId} column queue ${column} must be non-empty`);
        }
        queue.forEach((symbol) => {
          const stringSymbol = requiredString(symbol, `${scenarioId}.columnQueues.${column} symbol`);
          const id = this.symbolToIngredient.get(stringSymbol.replace('*', ''));
          if (!id || !order.ingredientPool.includes(id)) {
            throw new Error(`${scenarioId} queue ${column} contains illegal symbol ${stringSymbol}`);
          }
        });
      }
      actionScript.forEach((rawAction, actionIndex) => {
        const label = `${scenarioId}.expectedActionScript[${actionIndex}]`;
        const action = requiredObject(rawAction, label);
        const type = requiredString(action.type, `${label}.type`);
        if (!actionTypes.has(type)) {
          throw new Error(`${label}.type must be LINK, FIRE, or CONTINUE`);
        }
        if (type === 'LINK') {
          const path = requiredArray(action.path, `${label}.path`);
          if (path.length < this.gameplay.board.minimumLink) {
            throw new Error(`${label}.path must contain at least ${this.gameplay.board.minimumLink} cells`);
          }
          path.forEach((rawCoord, coordIndex) => {
            const coord = requiredArray(rawCoord, `${label}.path[${coordIndex}]`);
            if (coord.length !== 2) {
              throw new Error(`${label}.path[${coordIndex}] must contain row and column`);
            }
            const row = requiredNonNegativeInteger(coord[0], `${label}.path[${coordIndex}][0]`);
            const column = requiredNonNegativeInteger(coord[1], `${label}.path[${coordIndex}][1]`);
            if (row >= this.gameplay.board.rows || column >= this.gameplay.board.columns) {
              throw new Error(`${label}.path[${coordIndex}] is outside the board`);
            }
          });
        }
        if (type !== 'CONTINUE' && action.expected === undefined) {
          throw new Error(`${label}.expected is required for ${type}`);
        }
        if (action.expected !== undefined) {
          const expected = requiredObject(action.expected, `${label}.expected`);
          if (Object.keys(expected).length === 0 && type !== 'CONTINUE') {
            throw new Error(`${label}.expected must not be empty`);
          }
          Object.keys(expected).forEach((key) => {
            if (!expectedKeys.has(key)) {
              throw new Error(`${label}.expected.${key} is not supported`);
            }
          });
          if (Object.prototype.hasOwnProperty.call(expected, 'stepDelta')) {
            requiredInteger(expected.stepDelta, `${label}.expected.stepDelta`);
          }
          if (Object.prototype.hasOwnProperty.call(expected, 'potUnits')) {
            const potUnits = requiredObject(expected.potUnits, `${label}.expected.potUnits`);
            Object.entries(potUnits).forEach(([ingredientId, units]) => {
              if (!this.ingredientById.has(ingredientId as IngredientId)) {
                throw new Error(`${label}.expected.potUnits references unknown ingredient ${ingredientId}`);
              }
              requiredNonNegativeInteger(units, `${label}.expected.potUnits.${ingredientId}`);
            });
          }
          if (Object.prototype.hasOwnProperty.call(expected, 'inspirationAt')) {
            const inspirationAt = requiredString(
              expected.inspirationAt,
              `${label}.expected.inspirationAt`,
            );
            if (!/^r[1-7]c[1-7]$/.test(inspirationAt)) {
              throw new Error(`${label}.expected.inspirationAt must be an r1c1-style board coordinate`);
            }
          }
          if (Object.prototype.hasOwnProperty.call(expected, 'pathCells')) {
            requiredPositiveInteger(expected.pathCells, `${label}.expected.pathCells`);
          }
          if (Object.prototype.hasOwnProperty.call(expected, 'throwUnits')) {
            requiredPositiveInteger(expected.throwUnits, `${label}.expected.throwUnits`);
          }
          if (Object.prototype.hasOwnProperty.call(expected, 'recipeId')) {
            const recipeId = requiredString(expected.recipeId, `${label}.expected.recipeId`);
            if (!this.recipeById.has(recipeId)) {
              throw new Error(`${label}.expected.recipeId references unknown recipe ${recipeId}`);
            }
          }
          if (Object.prototype.hasOwnProperty.call(expected, 'remainingSteps')) {
            requiredNonNegativeInteger(expected.remainingSteps, `${label}.expected.remainingSteps`);
          }
        }
      });
      if (!actionScript.some((rawAction) =>
        requiredObject(rawAction, `${scenarioId}.expectedActionScript action`).type === 'FIRE')) {
        throw new Error(`${scenarioId}.expectedActionScript must contain a FIRE action`);
      }
      if (!this.recipeById.has(expectedFinalResult)) {
        throw new Error(`${scenarioId} references unknown final recipe ${expectedFinalResult}`);
      }
    }

    for (const tutorial of this.tutorials) {
      requiredString(tutorial.id, 'tutorial.id');
      requiredString(tutorial.trigger, `${tutorial.id}.trigger`);
      requiredString(tutorial.text, `${tutorial.id}.text`);
      if (typeof tutorial.once !== 'boolean') {
        throw new Error(`${tutorial.id}.once must be boolean`);
      }
    }

    const explicitResolver = new RecipeResolver(this.recipes);
    const enumeratedUnits: Partial<Record<IngredientId, number>> = {};
    const enumerate = (index: number): void => {
      if (index === expectedIngredientIds.length) {
        const matches = explicitResolver.matchingExplicit(enumeratedUnits, ['INSPIRATION']);
        if (matches.length > 1) {
          throw new Error(`Recipe range overlap: ${matches.map((recipe) => recipe.id).join(', ')}`);
        }
        return;
      }
      const ingredientId = expectedIngredientIds[index];
      for (let value = 0; value <= 12; value += 1) {
        enumeratedUnits[ingredientId] = value;
        enumerate(index + 1);
      }
    };
    enumerate(0);
  }
}
