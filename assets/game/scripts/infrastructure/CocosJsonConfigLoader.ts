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
    throw new Error('CP0-R0规则迁移中，视觉接入待R1');
  }
}
