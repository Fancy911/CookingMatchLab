import { JsonAsset, resources } from 'cc';
import type { ConfigRegistry } from '../application/cp0c/ConfigRegistry';
import {
  assertC1ConfigHash,
  C1_SCENARIO_IDS,
  CONFIG_RESOURCE_ROOT,
  registryFromDocuments,
  type JsonConfigDocuments,
} from './JsonConfigAdapter';

const loadJson = (path: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    resources.load(path, JsonAsset, (error, asset) => {
      if (error || !asset) {
        reject(error ?? new Error(`Missing JSON resource ${path}`));
        return;
      }
      resolve(asset.json);
    });
  });

export class CocosJsonConfigLoader {
  public async load(): Promise<ConfigRegistry> {
    const [gameplay, ingredients, recipes, orders, tutorials, ...scenarios] =
      await Promise.all([
        loadJson(`${CONFIG_RESOURCE_ROOT}/gameplay`),
        loadJson(`${CONFIG_RESOURCE_ROOT}/ingredients`),
        loadJson(`${CONFIG_RESOURCE_ROOT}/recipes`),
        loadJson(`${CONFIG_RESOURCE_ROOT}/orders`),
        loadJson(`${CONFIG_RESOURCE_ROOT}/tutorials`),
        ...C1_SCENARIO_IDS.map((id) =>
          loadJson(`${CONFIG_RESOURCE_ROOT}/scenarios/${id}`)),
      ]);
    const documents: JsonConfigDocuments = {
      gameplay,
      ingredients,
      recipes,
      orders,
      tutorials,
      scenarios: Object.fromEntries(
        C1_SCENARIO_IDS.map((id, index) => [id, scenarios[index]]),
      ),
    };
    const registry = registryFromDocuments(documents);
    assertC1ConfigHash(registry);
    return registry;
  }
}
