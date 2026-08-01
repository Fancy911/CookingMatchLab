import { JsonAsset, resources } from 'cc';
import type { ConfigRegistry } from '../application/cp0c/ConfigRegistry';
import {
  loadCanonicalConfig,
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
    return loadCanonicalConfig(loadJson);
  }
}
