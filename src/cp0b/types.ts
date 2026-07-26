export type IngredientId =
  | 'ING_TOMATO'
  | 'ING_EGG'
  | 'ING_POTATO'
  | 'ING_CARROT'
  | 'ING_MUSHROOM'
  | 'ING_SCALLION';

export type RecipeId =
  | 'RCP_TOMATO_EGG'
  | 'RCP_SCALLION_POTATO_CAKE'
  | 'RCP_GARDEN_MUSHROOM_SOUP'
  | 'RCP_WARM_HOTPOT_MIX'
  | 'RCP_CHARRED_TOMATO_POTATO_BALL'
  | 'RCP_STAR_MUSHROOM_EGG_CUP';

export type OrderId = 'ORD_01' | 'ORD_02' | 'ORD_03';
export type ScenarioId =
  | 'O1_TUTORIAL_001'
  | 'O2_STANDARD'
  | 'O2_BLACK'
  | 'O3_STANDARD'
  | 'O3_INSPIRATION';

export type ProcessingTag =
  | 'FINE'
  | 'LONG_INSPIRATION'
  | 'MASTER'
  | 'INSPIRATION';

export interface Coord {
  row: number;
  column: number;
}

export interface Cell {
  ingredientId: IngredientId;
  inspiration: boolean;
}

export type BoardGrid = Cell[][];

export interface GameplayConfig {
  schemaVersion: number;
  board: {
    rows: number;
    columns: number;
    ingredientTypeCount: number;
    connectionDirections: 4 | 8;
    minimumLink: number;
  };
  pot: {
    baseSlots: number;
    temporarySlots: number;
    minimumThrowsToCook: number;
  };
  longLink: {
    fine: number;
    inspiration: number;
    master: number;
  };
  inspiration: {
    unitValue: number;
    spawnStrategy: 'PATH_END_COLUMN_FIRST_NEW_CELL';
  };
  shuffle: {
    algorithm: 'fisher-yates-xorshift32-v1';
    maximumAttempts: number;
  };
  star: {
    quantityDeviationFactor: number;
    recipeWeights: {
      quantity: number;
      ratio: number;
    };
    processingScores: {
      normal: number;
      fine: number;
      inspiration: number;
      master: number;
      inspirationBonus: number;
      maximum: number;
    };
    efficiencyScores: {
      high: number;
      pass: number;
      low: number;
    };
    weights: {
      recipe: number;
      processing: number;
      efficiency: number;
    };
    thresholds: {
      two: number;
      three: number;
    };
  };
}

export interface IngredientConfig {
  id: IngredientId;
  symbol: 'T' | 'E' | 'P' | 'C' | 'M' | 'S';
  name: string;
  tags: string[];
  normalUnitValue: number;
  boardSprite: string;
  potLayer: string;
  inspirationOverlay: string[];
}

export interface Range {
  min: number;
  max: number;
  ideal: number;
}

export interface RatioRule {
  numerator: IngredientId[];
  denominator: IngredientId[];
  accepted: [number, number];
  ideal: [number, number];
}

export interface RecipeConfig {
  id: RecipeId;
  name: string;
  rarity: 'NORMAL' | 'FEATURED' | 'RARE';
  tags: string[];
  required: Partial<Record<IngredientId, Range>>;
  forbidden: IngredientId[];
  ratios: RatioRule[];
  requiredConditions: ProcessingTag[];
  potId: 'POT_BASE_RESEARCH';
  priority: number;
  fallback: boolean;
  revealProfile: 'NORMAL' | 'FEATURED' | 'RARE' | 'DARK';
  dishAsset: string;
}

export interface OrderConfig {
  id: OrderId;
  title: string;
  targetRecipeId: RecipeId;
  initialSteps: number;
  ingredientPool: IngredientId[];
  orderMode: 'TUTORIAL' | 'KNOWN' | 'RESEARCH';
  clues: string[];
  highEfficiencySteps: number;
  passEfficiencySteps: number;
  defaultScenarioId: ScenarioId;
  tutorialFlags: string[];
}

export interface ScenarioAction {
  type: 'LINK' | 'FIRE' | 'CONTINUE';
  path?: [number, number][];
  expected?: Record<string, unknown>;
}

export interface ScenarioConfig {
  schemaVersion: number;
  id: ScenarioId;
  orderId: OrderId;
  refillMode: 'COLUMN_QUEUE';
  initialBoard: string[][];
  columnQueues: Record<string, string[]>;
  expectedActionScript: ScenarioAction[];
  expectedFinalResult: RecipeId;
}

export interface TutorialConfig {
  id: string;
  trigger: string;
  text: string;
  once: boolean;
}

export interface ThrowRecord {
  ingredientId: IngredientId;
  pathLength: number;
  units: number;
  processingScore: number;
  containsInspiration: boolean;
}

export type IngredientUnits = Partial<Record<IngredientId, number>>;

export interface DiscoveryState {
  tutorialFlags: {
    inspirationUnitHintShown: boolean;
  };
  discoveredRecipeIds: RecipeId[];
  bestStarsByRecipe: Partial<Record<RecipeId, number>>;
  firstResearchRecordIds: RecipeId[];
}

export type OrderResult =
  | 'IN_PROGRESS'
  | 'SUCCESS'
  | 'CONTINUE_AFTER_REVEAL'
  | 'NOT_COMPLETED';

export interface FireResult {
  recipeId: RecipeId;
  stars: number;
  score: number;
  orderResult: OrderResult;
  isNewDiscovery: boolean;
}
