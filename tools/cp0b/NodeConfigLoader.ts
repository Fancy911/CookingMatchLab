import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  type ConfigRegistry,
} from '../../assets/game/scripts/application/cp0c/ConfigRegistry';
import {
  C1_SCENARIO_IDS,
  registryFromDocuments,
} from '../../assets/game/scripts/infrastructure/JsonConfigAdapter';

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8')) as unknown;

export const defaultConfigDirectory = (): string =>
  join(process.cwd(), 'assets', 'resources', 'game', 'config', 'cp0-b');

export const loadConfigRegistry = (
  directory = defaultConfigDirectory(),
): ConfigRegistry => {
  const scenarioDirectory = join(directory, 'scenarios');
  const documents = {
    gameplay: readJson(join(directory, 'gameplay.json')),
    ingredients: readJson(join(directory, 'ingredients.json')),
    recipes: readJson(join(directory, 'recipes.json')),
    orders: readJson(join(directory, 'orders.json')),
    tutorials: readJson(join(directory, 'tutorials.json')),
    scenarios: Object.fromEntries(readdirSync(scenarioDirectory)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => [file.replace(/\.json$/, ''), readJson(join(scenarioDirectory, file))])),
  };
  const unknownScenarioIds = Object.keys(documents.scenarios)
    .filter((id) => !C1_SCENARIO_IDS.includes(id as typeof C1_SCENARIO_IDS[number]));
  if (unknownScenarioIds.length > 0) {
    throw new Error(`Unexpected scenario documents: ${unknownScenarioIds.join(', ')}`);
  }
  return registryFromDocuments(documents);
};
