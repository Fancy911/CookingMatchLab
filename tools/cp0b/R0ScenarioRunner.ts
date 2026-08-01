import {
  TimedResearchSession,
} from '../../assets/game/scripts/domain/cp0b/core';
import { stableHash } from '../../assets/game/scripts/domain/cp0b/stable';
import type {
  R0CookResult,
  R0ScenarioAction,
  R0ScenarioCase,
  R0ScenarioConfig,
} from '../../assets/game/scripts/domain/cp0b/types';
import type { R0ConfigRegistry } from '../../assets/game/scripts/application/cp0c/R0ConfigRegistry';

export interface R0ScenarioActionRun {
  index: number;
  type: R0ScenarioAction['type'];
  status: 'PASS' | 'FAIL';
  firstDifference?: string;
  snapshotHash: string;
  recipeId?: string;
}

export interface R0ScenarioCaseRun {
  scenarioId: string;
  caseId: string;
  status: 'PASS' | 'FAIL';
  firstDifference?: string;
  actions: R0ScenarioActionRun[];
  finalSnapshotHash: string;
  expectedFinalSnapshotHash: string;
  cookResults: R0CookResult[];
}

const firstDifference = (
  actual: unknown,
  expected: unknown,
  path = '$',
): string | undefined => {
  if (Object.is(actual, expected)) {
    return undefined;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return `${path}.length: expected ${expected.length}, got ${actual.length}`;
    }
    for (let index = 0; index < actual.length; index += 1) {
      const difference = firstDifference(actual[index], expected[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return undefined;
  }
  if (
    actual && expected
    && typeof actual === 'object'
    && typeof expected === 'object'
    && !Array.isArray(actual)
    && !Array.isArray(expected)
  ) {
    const actualObject = actual as Record<string, unknown>;
    const expectedObject = expected as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(actualObject), ...Object.keys(expectedObject)])].sort();
    for (const key of keys) {
      if (!(key in actualObject)) return `${path}.${key}: missing actual value`;
      if (!(key in expectedObject)) return `${path}.${key}: unexpected actual value`;
      const difference = firstDifference(
        actualObject[key],
        expectedObject[key],
        `${path}.${key}`,
      );
      if (difference) return difference;
    }
    return undefined;
  }
  return `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
};

const expectedFields = (session: TimedResearchSession) => {
  const snapshot = session.snapshot();
  return {
    potUnits: snapshot.pot.units,
    remainingActiveTimeMs: snapshot.remainingActiveTimeMs,
    comboCount: snapshot.comboCount,
    totalScore: snapshot.totalScore,
    tags: snapshot.pot.tags,
    phase: snapshot.phase,
  };
};

export class R0ScenarioRunner {
  public constructor(private readonly registry: R0ConfigRegistry) {}

  public runCase(
    scenario: R0ScenarioConfig,
    testCase: R0ScenarioCase,
  ): R0ScenarioCaseRun {
    const session = new TimedResearchSession(
      this.registry,
      scenario.id,
      testCase.id,
      testCase.initialBoard,
      testCase.columnQueues,
      testCase.researchClueQueue,
      scenario.seed,
    );
    const actions: R0ScenarioActionRun[] = [];
    testCase.actions.forEach((action, index) => {
      let recipeId: string | undefined;
      let actionDifference: string | undefined;
      try {
        if (action.type === 'ADVANCE_ACTIVE_TIME') {
          session.advanceActiveTime(action.milliseconds);
        } else if (action.type === 'LINK') {
          const result = session.commitLink(
            action.path.map(([row, column]) => ({ row, column })),
          );
          if (!result.committed || !result.throwRecord) {
            actionDifference = `$.commit: expected committed link, got ${result.reason ?? 'no result'}`;
          } else {
            actionDifference = firstDifference({
              pathLength: result.throwRecord.pathLength,
              ingredientId: result.throwRecord.ingredientId,
              linkScore: result.throwRecord.linkScore,
              ...(result.throwRecord.audioEvent
                ? { audioEvent: result.throwRecord.audioEvent }
                : {}),
            }, {
              pathLength: action.expected.pathLength,
              ingredientId: action.expected.ingredientId,
              linkScore: action.expected.linkScore,
              ...(action.expected.audioEvent
                ? { audioEvent: action.expected.audioEvent }
                : {}),
            }, '$.link');
            session.completeAnimation();
          }
        } else if (action.type === 'FIRE') {
          const result = session.fire();
          recipeId = result.recipeId;
          if (result.recipeId !== action.expectedRecipeId) {
            actionDifference =
              `$.recipeId: expected ${action.expectedRecipeId}, got ${result.recipeId}`;
          }
          session.completeReveal();
        } else if (action.type === 'CONFIRM_AUTO_FIRE') {
          const result = session.confirmAutoFire();
          recipeId = result.recipeId;
          if (result.recipeId !== action.expectedRecipeId) {
            actionDifference =
              `$.recipeId: expected ${action.expectedRecipeId}, got ${result.recipeId}`;
          }
          session.completeReveal();
        } else if (action.type === 'COMPLETE_ANIMATION') {
          session.completeAnimation();
        } else if (action.type === 'COMPLETE_REVEAL') {
          session.completeReveal();
        }
        actionDifference ??= firstDifference(
          expectedFields(session),
          {
            potUnits: action.expected.potUnits,
            remainingActiveTimeMs: action.expected.remainingActiveTimeMs,
            comboCount: action.expected.comboCount,
            totalScore: action.expected.totalScore,
            tags: action.expected.tags,
            phase: action.expected.phase,
          },
        );
      } catch (error) {
        actionDifference = `$.exception: ${(error as Error).message}`;
      }
      actions.push({
        index,
        type: action.type,
        status: actionDifference ? 'FAIL' : 'PASS',
        ...(actionDifference ? { firstDifference: actionDifference } : {}),
        snapshotHash: stableHash(session.snapshot()),
        ...(recipeId ? { recipeId } : {}),
      });
    });
    const finalSnapshotHash = session.hash();
    const hashDifference = finalSnapshotHash === testCase.expectedFinalSnapshotHash
      ? undefined
      : `$.expectedFinalSnapshotHash: expected ${testCase.expectedFinalSnapshotHash}, got ${finalSnapshotHash}`;
    const firstFailedAction = actions.find((action) => action.status === 'FAIL');
    const difference = firstFailedAction?.firstDifference ?? hashDifference;
    return {
      scenarioId: scenario.id,
      caseId: testCase.id,
      status: difference ? 'FAIL' : 'PASS',
      ...(difference ? { firstDifference: difference } : {}),
      actions,
      finalSnapshotHash,
      expectedFinalSnapshotHash: testCase.expectedFinalSnapshotHash,
      cookResults: session.snapshot().cookResults,
    };
  }

  public runAll(): R0ScenarioCaseRun[] {
    return this.registry.scenarios.flatMap((scenario) =>
      scenario.cases.map((testCase) => this.runCase(scenario, testCase)));
  }
}
