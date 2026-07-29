import type { DiscoveryState, RecipeId } from '../domain/cp0b/types';
import { deepClone } from '../domain/cp0b/stable';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface C1SaveData {
  schemaVersion: 1;
  discoveredRecipeIds: RecipeId[];
  bestStarsByRecipe: Partial<Record<RecipeId, number>>;
}

const ALLOWED_RECIPES = new Set<RecipeId>([
  'RCP_TOMATO_EGG',
  'RCP_WARM_HOTPOT_MIX',
]);

const emptySave = (): C1SaveData => ({
  schemaVersion: 1,
  discoveredRecipeIds: [],
  bestStarsByRecipe: {},
});

const normalized = (value: unknown): C1SaveData => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Save data must be an object');
  }
  const object = value as Record<string, unknown>;
  if (object.schemaVersion !== 1 || !Array.isArray(object.discoveredRecipeIds)) {
    throw new Error('Save data schema is invalid');
  }
  const discoveredRecipeIds = object.discoveredRecipeIds
    .filter((id): id is RecipeId =>
      typeof id === 'string' && ALLOWED_RECIPES.has(id as RecipeId));
  const rawStars = object.bestStarsByRecipe;
  if (!rawStars || typeof rawStars !== 'object' || Array.isArray(rawStars)) {
    throw new Error('Save best-stars map is invalid');
  }
  const bestStarsByRecipe: Partial<Record<RecipeId, number>> = {};
  for (const [id, stars] of Object.entries(rawStars)) {
    if (ALLOWED_RECIPES.has(id as RecipeId)
      && typeof stars === 'number'
      && Number.isInteger(stars)
      && stars >= 1
      && stars <= 3) {
      bestStarsByRecipe[id as RecipeId] = stars;
    }
  }
  return {
    schemaVersion: 1,
    discoveredRecipeIds: [...new Set(discoveredRecipeIds)],
    bestStarsByRecipe,
  };
};

export class LocalSaveRepository {
  public static readonly KEY = 'cooking-match-lab.cp0c.c1.save.v1';
  public static readonly BACKUP_KEY = `${LocalSaveRepository.KEY}.corrupt-backup`;

  public constructor(private readonly storage: StoragePort) {}

  public load(): C1SaveData {
    const raw = this.storage.getItem(LocalSaveRepository.KEY);
    if (!raw) {
      return emptySave();
    }
    try {
      return normalized(JSON.parse(raw) as unknown);
    } catch {
      this.storage.setItem(LocalSaveRepository.BACKUP_KEY, raw);
      return emptySave();
    }
  }

  public saveDiscovery(discovery: DiscoveryState): C1SaveData {
    const previous = this.load();
    const next: C1SaveData = deepClone(previous);
    for (const recipeId of discovery.discoveredRecipeIds) {
      if (!ALLOWED_RECIPES.has(recipeId)) {
        continue;
      }
      if (!next.discoveredRecipeIds.includes(recipeId)) {
        next.discoveredRecipeIds.push(recipeId);
      }
      const stars = discovery.bestStarsByRecipe[recipeId];
      if (stars !== undefined) {
        next.bestStarsByRecipe[recipeId] = Math.max(
          next.bestStarsByRecipe[recipeId] ?? 0,
          stars,
        );
      }
    }
    next.discoveredRecipeIds.sort();
    this.storage.setItem(LocalSaveRepository.KEY, JSON.stringify(next));
    return deepClone(next);
  }

  public loadDiscoveryState(): DiscoveryState {
    const saved = this.load();
    return {
      tutorialFlags: { inspirationUnitHintShown: false },
      discoveredRecipeIds: [...saved.discoveredRecipeIds],
      bestStarsByRecipe: { ...saved.bestStarsByRecipe },
      firstResearchRecordIds: [...saved.discoveredRecipeIds],
    };
  }

  public clear(): void {
    this.storage.removeItem?.(LocalSaveRepository.KEY);
  }
}
