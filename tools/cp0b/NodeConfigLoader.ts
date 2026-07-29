import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ConfigRegistry,
  type RawConfigData,
} from '../../assets/game/scripts/application/cp0c/ConfigRegistry';

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8')) as unknown;

export const defaultConfigDirectory = (): string =>
  join(process.cwd(), 'assets', 'resources', 'game', 'config', 'cp0-b');

export const loadConfigRegistry = (
  directory = defaultConfigDirectory(),
): ConfigRegistry => {
  const scenarioDirectory = join(directory, 'scenarios');
  const raw: RawConfigData = {
    gameplay: readJson(join(directory, 'gameplay.json')),
    ingredients: readJson(join(directory, 'ingredients.json')),
    recipes: readJson(join(directory, 'recipes.json')),
    orders: readJson(join(directory, 'orders.json')),
    tutorials: readJson(join(directory, 'tutorials.json')),
    scenarios: readdirSync(scenarioDirectory)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => readJson(join(scenarioDirectory, file))),
  };
  return ConfigRegistry.fromRaw(raw);
};
