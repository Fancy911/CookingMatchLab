import { expect } from 'vitest';
import {
  TimedResearchSession,
  type R0LinkCommitResult,
} from '../../assets/game/scripts/domain/cp0b/core';
import type {
  R0CookResult,
  R0ScenarioAction,
  R0ScenarioCase,
  R0ScenarioConfig,
} from '../../assets/game/scripts/domain/cp0b/types';
import type { R0ConfigRegistry } from '../../assets/game/scripts/application/cp0c/R0ConfigRegistry';

export interface R0ActionObservation {
  action: R0ScenarioAction;
  link?: R0LinkCommitResult;
  cook?: R0CookResult;
}

export interface R0CaseRun {
  session: TimedResearchSession;
  observations: R0ActionObservation[];
}

const actualExpectedFields = (session: TimedResearchSession) => {
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

export const runR0ScenarioCase = (
  registry: R0ConfigRegistry,
  scenario: R0ScenarioConfig,
  testCase: R0ScenarioCase,
): R0CaseRun => {
  const session = new TimedResearchSession(
    registry,
    scenario.id,
    testCase.id,
    testCase.initialBoard,
    testCase.columnQueues,
    testCase.researchClueQueue,
    scenario.seed,
  );
  const observations: R0ActionObservation[] = [];
  testCase.actions.forEach((action, index) => {
    let link: R0LinkCommitResult | undefined;
    let cook: R0CookResult | undefined;
    if (action.type === 'ADVANCE_ACTIVE_TIME') {
      session.advanceActiveTime(action.milliseconds);
    } else if (action.type === 'LINK') {
      link = session.commitLink(action.path.map(([row, column]) => ({ row, column })));
      expect(link.committed, `${scenario.id}/${testCase.id} action ${index}`).toBe(true);
      expect(link.throwRecord?.pathLength).toBe(action.expected.pathLength);
      expect(link.throwRecord?.ingredientId).toBe(action.expected.ingredientId);
      expect(link.throwRecord?.linkScore).toBe(action.expected.linkScore);
      expect(link.throwRecord?.audioEvent).toBe(action.expected.audioEvent);
      session.completeAnimation();
    } else if (action.type === 'FIRE') {
      cook = session.fire();
      expect(cook.recipeId).toBe(action.expectedRecipeId);
      session.completeReveal();
    } else if (action.type === 'CONFIRM_AUTO_FIRE') {
      cook = session.confirmAutoFire();
      expect(cook.recipeId).toBe(action.expectedRecipeId);
      session.completeReveal();
    } else if (action.type === 'COMPLETE_ANIMATION') {
      session.completeAnimation();
    } else if (action.type === 'COMPLETE_REVEAL') {
      session.completeReveal();
    }
    expect(
      actualExpectedFields(session),
      `${scenario.id}/${testCase.id} action ${index}`,
    ).toEqual({
      potUnits: action.expected.potUnits,
      remainingActiveTimeMs: action.expected.remainingActiveTimeMs,
      comboCount: action.expected.comboCount,
      totalScore: action.expected.totalScore,
      tags: action.expected.tags,
      phase: action.expected.phase,
    });
    observations.push({ action, link, cook });
  });
  expect(session.hash()).toBe(testCase.expectedFinalSnapshotHash);
  return { session, observations };
};
