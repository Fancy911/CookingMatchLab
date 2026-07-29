import {
  DeterministicRng,
  DiscoveryModel,
  type RunSnapshotData,
} from '../../assets/game/scripts/domain/cp0b/core';
import {
  stableHash,
  stableStringify,
} from '../../assets/game/scripts/domain/cp0b/stable';
import type {
  DiscoveryState,
  FireResult,
  ScenarioAction,
  ScenarioConfig,
  ScenarioId,
  ThrowRecord,
} from '../../assets/game/scripts/domain/cp0b/types';
import { ConfigRegistry } from '../../assets/game/scripts/application/cp0c/ConfigRegistry';
import { OrderSession } from '../../assets/game/scripts/application/cp0c/OrderSession';
import { ScenarioService } from '../../assets/game/scripts/application/cp0c/ScenarioService';
import {
  actionPath,
  humanCoord,
  RunLogger,
  type ActionLog,
  type ActionLogDetail,
} from './RunLogger';

export interface ScenarioRun {
  engineVersion: string;
  gitBaselineCommit: string;
  configSchemaVersion: number;
  configHash: string;
  scenarioId: ScenarioId;
  status: 'PASS' | 'FAIL';
  firstDifference: string | null;
  rng: {
    algorithm: string;
    seed: string;
    fixedRefillUsesPrng: false;
  };
  actions: ActionLog[];
  fireResults: FireResult[];
  finalSnapshot: RunSnapshotData;
  finalSnapshotHash: string;
  finalRecipeId?: string;
}

const expectedKeys = [
  'stepDelta',
  'potUnits',
  'inspirationAt',
  'pathCells',
  'throwUnits',
  'recipeId',
  'remainingSteps',
] as const;

interface ActionActual {
  stepDelta: number;
  potUnits: Record<string, number>;
  inspirationAt?: string;
  pathCells?: number;
  throwUnits?: number;
  recipeId?: string;
  remainingSteps: number;
}

const normalizePotUnits = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, units]) => typeof units === 'number' && units !== 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  ) as Record<string, number>;
};

const printable = (value: unknown): string =>
  value === undefined ? 'undefined' : stableStringify(value);

const compareExpected = (
  action: ScenarioAction,
  actual: ActionActual,
  actionIndex: number,
): string | null => {
  const expected = action.expected ?? {};
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(expected, key)) {
      continue;
    }
    const expectedValue = key === 'potUnits'
      ? normalizePotUnits(expected[key])
      : expected[key];
    const actualValue = key === 'potUnits'
      ? normalizePotUnits(actual[key])
      : actual[key];
    if (stableStringify(expectedValue) !== stableStringify(actualValue)) {
      return `action ${actionIndex + 1} ${key}: expected ${printable(expectedValue)}, received ${printable(actualValue)}`;
    }
  }
  return null;
};

export class PrototypeTestRunner {
  public constructor(
    private readonly registry: ConfigRegistry,
    private readonly engineVersion = '3.8.8',
    private readonly gitBaselineCommit = 'cba34c9920be44cb546653635c8a4dab60c5aa14',
  ) {}

  public run(
    scenarioId: ScenarioId,
    discoveryState?: DiscoveryState,
    seed = 0x43503042,
  ): ScenarioRun {
    const scenario = new ScenarioService(this.registry).get(scenarioId);
    return this.runScenario(scenario, discoveryState, seed);
  }

  public runScenario(
    scenario: ScenarioConfig,
    discoveryState?: DiscoveryState,
    seed = 0x43503042,
  ): ScenarioRun {
    const discovery = new DiscoveryModel(discoveryState ?? {
      tutorialFlags: { inspirationUnitHintShown: false },
      discoveredRecipeIds: [],
      bestStarsByRecipe: {},
      firstResearchRecordIds: [],
    });
    const session = new OrderSession(this.registry, scenario, discovery, seed);
    const logger = new RunLogger();
    const fireResults: FireResult[] = [];

    scenario.expectedActionScript.forEach((action, index) => {
      const before = session.snapshot();
      const detail: ActionLogDetail = {
        status: 'PASS',
        firstDifference: null,
      };
      let actionThrow: ThrowRecord | undefined;
      if (action.type === 'LINK') {
        const commit = session.commit(actionPath(action));
        actionThrow = commit.throwRecord;
        detail.committed = commit.committed;
        detail.inspirationAt = commit.inspirationCoord
          ? humanCoord(commit.inspirationCoord)
          : undefined;
        detail.inspirationHintShown = commit.inspirationHintShown;
      } else if (action.type === 'FIRE') {
        const fire = session.fire();
        fireResults.push(fire);
        detail.recipeId = fire.recipeId;
        detail.stars = fire.stars;
        detail.orderResult = fire.orderResult;
      } else {
        session.continueAfterReveal();
      }
      const after = session.snapshot();
      const actual: ActionActual = {
        stepDelta: after.remainingSteps - before.remainingSteps,
        potUnits: after.pot.units as Record<string, number>,
        inspirationAt: detail.inspirationAt,
        pathCells: actionThrow?.pathLength,
        throwUnits: actionThrow?.units,
        recipeId: detail.recipeId,
        remainingSteps: after.remainingSteps,
      };
      const firstDifference = compareExpected(action, actual, index);
      detail.status = firstDifference === null ? 'PASS' : 'FAIL';
      detail.firstDifference = firstDifference;
      logger.record(index, action, before, after, detail);
    });

    const finalSnapshot = session.snapshot();
    const finalRecipeId = fireResults.at(-1)?.recipeId;
    const actionDifference = logger.actions.find((action) => action.status === 'FAIL')
      ?.firstDifference ?? null;
    const finalDifference = finalRecipeId === scenario.expectedFinalResult
      ? null
      : `expectedFinalResult: expected ${scenario.expectedFinalResult}, received ${printable(finalRecipeId)}`;
    const firstDifference = actionDifference ?? finalDifference;
    return {
      engineVersion: this.engineVersion,
      gitBaselineCommit: this.gitBaselineCommit,
      configSchemaVersion: this.registry.gameplay.schemaVersion,
      configHash: this.registry.configHash,
      scenarioId: scenario.id,
      status: firstDifference === null ? 'PASS' : 'FAIL',
      firstDifference,
      rng: {
        algorithm: DeterministicRng.algorithm,
        seed: `0x${seed.toString(16).padStart(8, '0')}`,
        fixedRefillUsesPrng: false,
      },
      actions: logger.actions,
      fireResults,
      finalSnapshot,
      finalSnapshotHash: stableHash(finalSnapshot),
      finalRecipeId,
    };
  }
}
