import type {
  IngredientId,
  OrderId,
  RecipeId,
  ScenarioId,
} from '../../domain/cp0b/types';

export interface ResolvedResearchMenu {
  contentPackId: string;
  dailyMenuId: string;
  scenarioId: ScenarioId;
  caseId?: string;
  acceptanceFixtureId?: 'LONG_LINKS';
  orderId: OrderId;
  ingredientPool: IngredientId[];
  recipePool: RecipeId[];
  clueIds: string[];
}

export interface ResearchSchedulePort {
  resolveMenu(input: {
    nowEpochMs: number;
    forcedMenuId?: string;
  }): ResolvedResearchMenu;
}

export interface ClockPort {
  nowEpochMs(): number;
}

export class SystemClock implements ClockPort {
  public nowEpochMs(): number {
    return Date.now();
  }
}

export class FixedClock implements ClockPort {
  public constructor(private readonly value: number) {}

  public nowEpochMs(): number {
    return this.value;
  }
}

export type RewardedPlacementId =
  | 'TIME_EXTENSION'
  | 'SETTLEMENT_DOUBLE'
  | 'CLUE_HINT'
  | 'DAILY_CHEST';

export type RewardedAdStatus = 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface RewardedAdPort {
  show(input: {
    placementId: RewardedPlacementId;
    requestId: string;
  }): Promise<{
    status: RewardedAdStatus;
    transactionId?: string;
  }>;
}

export interface EntitlementPort {
  has(entitlementId: 'NO_ADS'): boolean;
}
