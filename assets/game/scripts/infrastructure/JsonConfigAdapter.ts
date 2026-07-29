import {
  ConfigRegistry,
  type RawConfigData,
} from '../application/cp0c/ConfigRegistry';

export const CONFIG_RESOURCE_ROOT = 'game/config/cp0-b';
export const C1_EXPECTED_CONFIG_HASH = '8737fa94';
export const C1_SCENARIO_IDS = [
  'O1_TUTORIAL_001',
  'O2_BLACK',
  'O2_STANDARD',
  'O3_INSPIRATION',
  'O3_STANDARD',
] as const;

export interface JsonConfigDocuments {
  gameplay: unknown;
  ingredients: unknown;
  recipes: unknown;
  orders: unknown;
  tutorials: unknown;
  scenarios: Record<string, unknown>;
}

export const registryFromDocuments = (
  documents: JsonConfigDocuments,
): ConfigRegistry => {
  const missing = C1_SCENARIO_IDS.filter((id) => documents.scenarios[id] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing scenario documents: ${missing.join(', ')}`);
  }
  const raw: RawConfigData = {
    gameplay: documents.gameplay,
    ingredients: documents.ingredients,
    recipes: documents.recipes,
    orders: documents.orders,
    tutorials: documents.tutorials,
    scenarios: C1_SCENARIO_IDS.map((id) => documents.scenarios[id]),
  };
  return ConfigRegistry.fromRaw(raw);
};

export const assertC1ConfigHash = (registry: ConfigRegistry): void => {
  if (registry.configHash !== C1_EXPECTED_CONFIG_HASH) {
    throw new Error(
      `C1 config hash mismatch: expected ${C1_EXPECTED_CONFIG_HASH}, got ${registry.configHash}`,
    );
  }
};
