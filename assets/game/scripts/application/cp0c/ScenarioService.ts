import type { ScenarioConfig, ScenarioId } from '../../domain/cp0b/types';
import { deepClone } from '../../domain/cp0b/stable';
import { ConfigRegistry } from './ConfigRegistry';

export class ScenarioService {
  public constructor(private readonly registry: ConfigRegistry) {}

  public get(id: ScenarioId): ScenarioConfig {
    const scenario = this.registry.scenarioById.get(id);
    if (!scenario) {
      throw new Error(`Unknown scenario ${id}`);
    }
    return deepClone(scenario);
  }

  public list(): ScenarioConfig[] {
    return this.registry.scenarios.map(deepClone);
  }
}
