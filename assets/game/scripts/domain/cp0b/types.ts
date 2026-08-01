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
  expected?: ScenarioActionExpected;
}

export interface ScenarioActionExpected {
  stepDelta?: number;
  potUnits?: IngredientUnits;
  inspirationAt?: string;
  pathCells?: number;
  throwUnits?: number;
  recipeId?: RecipeId;
  remainingSteps?: number;
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

export type ProcessingLevel = 'NORMAL' | 'PRECISE' | 'INSPIRATION' | 'MASTER';
export type AudioEvent = 'GOOD' | 'GREAT' | 'UNBELIEVABLE';
export type R0SessionPhase =
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

export interface R0GameplayConfig {
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

export interface R0RecipeConfig {
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

export interface R0OrderConfig {
  id: OrderId;
  title: string;
  ingredientPool: IngredientId[];
  initialActiveTimeMs: number;
  clues: ResearchClueConfig[];
}

export interface R0ScenarioExpected {
  potUnits: IngredientUnits;
  remainingActiveTimeMs: number;
  comboCount: number;
  totalScore: number;
  tags: Array<'INSPIRATION' | 'MASTER'>;
  phase: R0SessionPhase;
}

export type R0ScenarioAction =
  | {
    type: 'ADVANCE_ACTIVE_TIME';
    milliseconds: number;
    expected: R0ScenarioExpected;
  }
  | {
    type: 'LINK';
    path: [number, number][];
    expected: R0ScenarioExpected & {
      pathLength: number;
      ingredientId: IngredientId;
      linkScore: number;
      audioEvent?: AudioEvent;
    };
  }
  | {
    type: 'COMPLETE_ANIMATION' | 'FIRE' | 'CONFIRM_AUTO_FIRE' | 'COMPLETE_REVEAL';
    expected: R0ScenarioExpected;
    expectedRecipeId?: RecipeId;
  };

export interface R0ScenarioCase {
  id: string;
  initialBoard: string[][];
  columnQueues: Record<string, string[]>;
  researchClueQueue: string[];
  actions: R0ScenarioAction[];
  expectedFinalSnapshotHash: string;
}

export interface R0ScenarioConfig {
  schemaVersion: 2;
  id: 'RS01_TUTORIAL_REPEAT'
    | 'RS02_MULTI_RECIPE'
    | 'RS03_DARK'
    | 'RS04_INSPIRATION'
    | 'RS05_TIMER_END';
  orderId: OrderId;
  seed: number;
  cases: R0ScenarioCase[];
}

export interface R0ThrowRecord {
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

export interface R0CookResult {
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
