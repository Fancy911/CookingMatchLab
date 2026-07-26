import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RecipeResolver } from './core.js';
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
} from './types.js';
import { stableHash } from './stable.js';

interface VersionedList<T> {
  schemaVersion: number;
  [key: string]: number | T[];
}

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

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

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

  public static fromDirectory(directory: string): ConfigRegistry {
    const scenarioDirectory = join(directory, 'scenarios');
    return ConfigRegistry.fromRaw({
      gameplay: readJson(join(directory, 'gameplay.json')),
      ingredients: readJson(join(directory, 'ingredients.json')),
      recipes: readJson(join(directory, 'recipes.json')),
      orders: readJson(join(directory, 'orders.json')),
      tutorials: readJson(join(directory, 'tutorials.json')),
      scenarios: readdirSync(scenarioDirectory)
        .filter((file) => file.endsWith('.json'))
        .sort()
        .map((file) => readJson(join(scenarioDirectory, file))),
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
    requiredObject(gameplay.shuffle, 'gameplay.shuffle');
    requiredObject(gameplay.star, 'gameplay.star');
    if (requiredNumber(board.rows, 'gameplay.board.rows') !== 7
      || requiredNumber(board.columns, 'gameplay.board.columns') !== 7) {
      throw new Error('CP0-B board must be exactly 7x7');
    }
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
    if (!(requiredNumber(longLink.fine, 'gameplay.longLink.fine')
      < requiredNumber(longLink.inspiration, 'gameplay.longLink.inspiration')
      && requiredNumber(longLink.inspiration, 'gameplay.longLink.inspiration')
      < requiredNumber(longLink.master, 'gameplay.longLink.master'))) {
      throw new Error('Long-link thresholds must be strictly increasing');
    }
    if (requiredNumber(inspiration.unitValue, 'gameplay.inspiration.unitValue') !== 2) {
      throw new Error('CP0-B inspiration unit value must be 2');
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
    for (const order of this.orders) {
      if (!this.recipeById.has(order.targetRecipeId)) {
        throw new Error(`${order.id} references unknown recipe ${order.targetRecipeId}`);
      }
      if (order.ingredientPool.length !== this.gameplay.board.ingredientTypeCount) {
        throw new Error(`${order.id} must contain exactly five ingredient types`);
      }
      order.ingredientPool.forEach((id) => {
        if (!this.ingredientById.has(id)) {
          throw new Error(`${order.id} references unknown ingredient ${id}`);
        }
      });
      const target = this.recipeById.get(order.targetRecipeId)!;
      if (Object.keys(target.required).length > this.gameplay.pot.baseSlots) {
        throw new Error(`${target.id} is not reachable with three base throws`);
      }
    }

    if (this.scenarios.length !== 5 || this.scenarioById.size !== 5) {
      throw new Error('Exactly five unique scenarios are required');
    }
    for (const scenario of this.scenarios) {
      const order = this.orderById.get(scenario.orderId);
      if (!order) {
        throw new Error(`${scenario.id} references unknown order ${scenario.orderId}`);
      }
      if (scenario.initialBoard.length !== this.gameplay.board.rows
        || scenario.initialBoard.some((row) => row.length !== this.gameplay.board.columns)) {
        throw new Error(`${scenario.id} initialBoard must be exactly 7x7`);
      }
      for (const row of scenario.initialBoard) {
        for (const symbol of row) {
          const baseSymbol = symbol.replace('*', '');
          const id = this.symbolToIngredient.get(baseSymbol);
          if (!id) {
            throw new Error(`${scenario.id} contains unknown symbol ${symbol}`);
          }
          if (!order.ingredientPool.includes(id)) {
            throw new Error(`${scenario.id} contains ${id} outside ${order.id} ingredient pool`);
          }
        }
      }
      for (let column = 0; column < this.gameplay.board.columns; column += 1) {
        const queue = scenario.columnQueues[String(column)];
        if (!Array.isArray(queue) || queue.length === 0) {
          throw new Error(`${scenario.id} column queue ${column} must be non-empty`);
        }
        queue.forEach((symbol) => {
          const id = this.symbolToIngredient.get(symbol.replace('*', ''));
          if (!id || !order.ingredientPool.includes(id)) {
            throw new Error(`${scenario.id} queue ${column} contains illegal symbol ${symbol}`);
          }
        });
      }
      if (!this.recipeById.has(scenario.expectedFinalResult)) {
        throw new Error(`${scenario.id} references unknown final recipe ${scenario.expectedFinalResult}`);
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

export const defaultConfigDirectory = (): string =>
  join(process.cwd(), 'config', 'cp0-b');
