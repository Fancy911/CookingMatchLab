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
  | 'RS01_TUTORIAL_REPEAT'
  | 'RS02_MULTI_RECIPE'
  | 'RS03_DARK'
  | 'RS04_INSPIRATION'
  | 'RS05_TIMER_END';

export type ProcessingTag = 'INSPIRATION' | 'MASTER';
export type ProcessingLevel = 'NORMAL' | 'PRECISE' | 'INSPIRATION' | 'MASTER';
export type AudioEvent = 'GOOD' | 'GREAT' | 'UNBELIEVABLE';
export type SessionPhase =
  | 'READY'
  | 'LINKING'
  | 'TIMEOUT_GRACE'
  | 'ANIMATING'
  | 'AUTO_FIRE_READY'
  | 'COOKING'
  | 'REVEAL'
  | 'PARTIAL_RESULT'
  | 'SUMMARY'
  | 'PAUSED'
  | 'SHUFFLING';

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
  schemaVersion: 2;
  board: {
    rows: 7;
    columns: 7;
    ingredientTypeCount: 5 | 6;
    connectionDirections: 4 | 8;
    minimumLink: number;
  };
  session: {
    activeTimeMs: number;
    linkingGraceMs: number;
    activeTimeStates: Array<'READY' | 'LINKING'>;
  };
  pot: {
    minimumUnitsToCook: number;
    maximumUnits: number;
  };
  longLink: {
    precise: number;
    inspiration: number;
    master: number;
    processingScores: Record<ProcessingLevel, number>;
    audioEvents: Partial<Record<ProcessingLevel, AudioEvent>>;
  };
  inspiration: {
    spawnStrategy: 'PATH_END_COLUMN_FIRST_NEW_CELL';
    collectedScoreBonus: number;
    processingBonus: number;
    processingMaximum: number;
  };
  combo: {
    windowMs: number;
    tiers: Array<{
      minimumCount: number;
      maximumCount: number | null;
      multiplier: number;
    }>;
  };
  linkScore: {
    pointsPerCell: number;
    lengthRewards: Array<{
      minimumLength: number;
      maximumLength: number | null;
      bonus: number;
    }>;
  };
  shuffle: {
    algorithm: 'fisher-yates-xorshift32-v1';
    maximumAttempts: number;
  };
  star: {
    recipeAccuracy: {
      explicit: number;
      fallback: number;
    };
    weights: {
      accuracy: number;
      processing: number;
    };
    thresholds: {
      two: number;
      three: number;
    };
    fallbackMaximumScore: number;
    fallbackMaximumStars: number;
  };
  dishScore: {
    rarityBase: Record<'NORMAL' | 'FEATURED' | 'RARE', number>;
    darkTagBonus: number;
    perStar: number;
    firstDiscovery: number;
    researchClueMatch: number;
  };
  history: {
    processedCookResultLimit: number;
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

export interface RecipeConfig {
  id: RecipeId;
  name: string;
  rarity: 'NORMAL' | 'FEATURED' | 'RARE';
  tags: string[];
  required: Partial<Record<IngredientId, number>>;
  requiredConditions: Array<'INSPIRATION' | 'MASTER'>;
  potId: 'POT_BASE_RESEARCH';
  priority: number;
  fallback: boolean;
}

export interface ResearchClueConfig {
  id: string;
  recipeId: RecipeId;
  text: string;
}

export interface OrderConfig {
  id: OrderId;
  title: string;
  ingredientPool: IngredientId[];
  initialActiveTimeMs: number;
  clues: ResearchClueConfig[];
}

export interface TutorialConfig {
  id: string;
  trigger: string;
  text: string;
  once: boolean;
}

export type IngredientUnits = Partial<Record<IngredientId, number>>;

export interface ScenarioExpected {
  potUnits: IngredientUnits;
  remainingActiveTimeMs: number;
  comboCount: number;
  totalScore: number;
  tags: Array<'INSPIRATION' | 'MASTER'>;
  phase: SessionPhase;
}

export type ScenarioAction =
  | {
    type: 'ADVANCE_ACTIVE_TIME';
    milliseconds: number;
    expected: ScenarioExpected;
  }
  | {
    type: 'LINK';
    path: [number, number][];
    expected: ScenarioExpected & {
      pathLength: number;
      ingredientId: IngredientId;
      linkScore: number;
      audioEvent?: AudioEvent;
    };
  }
  | {
    type: 'COMPLETE_ANIMATION' | 'FIRE' | 'CONFIRM_AUTO_FIRE' | 'COMPLETE_REVEAL';
    expected: ScenarioExpected;
    expectedRecipeId?: RecipeId;
  };

export interface ScenarioCase {
  id: string;
  initialBoard: string[][];
  columnQueues: Record<string, string[]>;
  researchClueQueue: string[];
  actions: ScenarioAction[];
  expectedFinalSnapshotHash: string;
}

export interface ScenarioConfig {
  schemaVersion: 2;
  id: ScenarioId;
  orderId: OrderId;
  seed: number;
  cases: ScenarioCase[];
}

export interface ThrowRecord {
  ingredientId: IngredientId;
  pathLength: number;
  units: 1;
  processingLevel: ProcessingLevel;
  processingScore: number;
  containsInspiration: boolean;
  linkScore: number;
  comboCount: number;
  comboMultiplier: number;
  audioEvent?: AudioEvent;
}

export interface CookingHistoryState {
  discoveredRecipeIds: RecipeId[];
  sessionCookCounts: Partial<Record<RecipeId, number>>;
  historicalCookCounts: Partial<Record<RecipeId, number>>;
  bestStarsByRecipe: Partial<Record<RecipeId, number>>;
  bestDishScoreByRecipe: Partial<Record<RecipeId, number>>;
  processedCookResultIds: string[];
}

export interface CookResult {
  cookResultId: string;
  recipeId: RecipeId;
  stars: number;
  qualityScore: number;
  dishScore: number;
  isNewDiscovery: boolean;
  matchedResearchClue: boolean;
  tags: string[];
}

export interface SaveDataV1 {
  schemaVersion: 1;
  tutorialFlags?: {
    inspirationUnitHintShown?: boolean;
  };
  discoveredRecipeIds?: RecipeId[];
  bestStarsByRecipe?: Partial<Record<RecipeId, number>>;
  firstResearchRecordIds?: RecipeId[];
  settings?: {
    musicEnabled?: boolean;
    sfxEnabled?: boolean;
  };
}

export interface SaveDataV2 {
  schemaVersion: 2;
  discoveredRecipeIds: RecipeId[];
  historicalCookCounts: Partial<Record<RecipeId, number>>;
  bestStarsByRecipe: Partial<Record<RecipeId, number>>;
  bestDishScoreByRecipe: Partial<Record<RecipeId, number>>;
  firstResearchRecordIds: RecipeId[];
  tutorialFlags: {
    inspirationHintShown: boolean;
  };
  settings: {
    musicEnabled: boolean;
    sfxEnabled: boolean;
    voiceEnabled: boolean;
  };
  processedCookResultIds: string[];
}
