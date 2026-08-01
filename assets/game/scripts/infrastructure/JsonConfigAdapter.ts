import {
  ConfigRegistry,
  type RawConfigData,
} from '../application/cp0c/ConfigRegistry';

export const CONFIG_RESOURCE_ROOT = 'game/config/cp0-b';
export const EXPECTED_CONFIG_HASH = 'a35691f9';
export const SCENARIO_IDS = [
  'RS01_TUTORIAL_REPEAT',
  'RS02_MULTI_RECIPE',
  'RS03_DARK',
  'RS04_INSPIRATION',
  'RS05_TIMER_END',
] as const;

export interface JsonConfigDocuments {
  gameplay: unknown;
  ingredients: unknown;
  recipes: unknown;
  orders: unknown;
  tutorials: unknown;
  scenarios: Record<string, unknown>;
}

export type JsonDocumentLoader = (resourcePath: string) => Promise<unknown>;

export const registryFromDocuments = (
  documents: JsonConfigDocuments,
): ConfigRegistry => {
  const missing = SCENARIO_IDS.filter((id) => documents.scenarios[id] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing scenario documents: ${missing.join(', ')}`);
  }
  const raw: RawConfigData = {
    gameplay: documents.gameplay,
    ingredients: documents.ingredients,
    recipes: documents.recipes,
    orders: documents.orders,
    tutorials: documents.tutorials,
    scenarios: SCENARIO_IDS.map((id) => documents.scenarios[id]),
  };
  return ConfigRegistry.fromRaw(raw);
};

export const assertConfigHash = (registry: ConfigRegistry): void => {
  if (registry.configHash !== EXPECTED_CONFIG_HASH) {
    throw new Error(
      `Config hash mismatch: expected ${EXPECTED_CONFIG_HASH}, got ${registry.configHash}`,
    );
  }
};

export const loadCanonicalConfig = async (
  loadDocument: JsonDocumentLoader,
): Promise<ConfigRegistry> => {
  const [gameplay, ingredients, recipes, orders, tutorials, scenarioEntries] =
    await Promise.all([
      loadDocument(`${CONFIG_RESOURCE_ROOT}/gameplay`),
      loadDocument(`${CONFIG_RESOURCE_ROOT}/ingredients`),
      loadDocument(`${CONFIG_RESOURCE_ROOT}/recipes`),
      loadDocument(`${CONFIG_RESOURCE_ROOT}/orders`),
      loadDocument(`${CONFIG_RESOURCE_ROOT}/tutorials`),
      Promise.all(SCENARIO_IDS.map(async (scenarioId) => [
        scenarioId,
        await loadDocument(`${CONFIG_RESOURCE_ROOT}/scenarios/${scenarioId}`),
      ] as const)),
    ]);
  const registry = registryFromDocuments({
    gameplay,
    ingredients,
    recipes,
    orders,
    tutorials,
    scenarios: Object.fromEntries(scenarioEntries),
  });
  assertConfigHash(registry);
  return registry;
};
