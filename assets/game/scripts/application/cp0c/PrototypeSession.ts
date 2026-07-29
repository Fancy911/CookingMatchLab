import {
  DiscoveryModel,
  PathEditor,
  PathValidator,
  type RunSnapshotData,
} from '../../domain/cp0b/core';
import type { Coord, FireResult, OrderResult } from '../../domain/cp0b/types';
import { deepClone, stableHash } from '../../domain/cp0b/stable';
import { ConfigRegistry } from './ConfigRegistry';
import { EffectPlanBuilder, type EffectPlan } from './EffectPlanBuilder';
import { OrderSession } from './OrderSession';

export type PrototypePhase =
  | 'READY'
  | 'LINKING'
  | 'ANIMATING'
  | 'POT_REVIEW'
  | 'COOKING'
  | 'REVEAL'
  | 'PAUSED';

export interface LinkCommitResult {
  accepted: boolean;
  reason?: string;
  plan?: EffectPlan;
}

export interface ContinueResult {
  boardHash: string;
  queueHash: string;
  remainingSteps: number;
  orderResult: OrderResult;
}

export class PrototypeSession {
  public order: OrderSession;
  public phase: PrototypePhase = 'READY';
  public fireResult?: FireResult;
  private editor?: PathEditor;
  private phaseBeforePause: Exclude<PrototypePhase, 'PAUSED'> = 'READY';
  private operationCounter = 0;
  private activeOperationId?: string;

  public constructor(
    public readonly registry: ConfigRegistry,
    seed = 0x43503042,
    discovery = new DiscoveryModel(),
  ) {
    const scenario = registry.scenarioById.get('O1_TUTORIAL_001');
    if (!scenario) {
      throw new Error('C1 requires O1_TUTORIAL_001');
    }
    this.order = new OrderSession(registry, scenario, discovery, seed);
  }

  public beginLink(coord: Coord): Coord[] {
    if (this.phase !== 'READY' && this.phase !== 'POT_REVIEW') {
      return [];
    }
    const validator = new PathValidator(
      this.registry.gameplay.board.connectionDirections,
      this.registry.gameplay.board.minimumLink,
    );
    this.editor = new PathEditor(this.order.board, validator);
    this.editor.append(coord);
    this.phase = 'LINKING';
    return this.editor.snapshot();
  }

  public extendLink(coord: Coord): Coord[] {
    if (this.phase !== 'LINKING' || !this.editor) {
      return [];
    }
    this.editor.append(coord);
    return this.editor.snapshot();
  }

  public cancelLink(): void {
    if (this.phase === 'LINKING') {
      this.editor = undefined;
      this.phase = this.order.pot.throws.length > 0 ? 'POT_REVIEW' : 'READY';
    }
  }

  public commitLink(): LinkCommitResult {
    if (this.phase !== 'LINKING' || !this.editor) {
      return { accepted: false, reason: 'No link is active' };
    }
    const path = this.editor.snapshot();
    const before = this.order.snapshot();
    const result = this.order.commit(path);
    this.editor = undefined;
    if (!result.committed) {
      this.phase = this.order.pot.throws.length > 0 ? 'POT_REVIEW' : 'READY';
      return { accepted: false, reason: result.reason };
    }
    const after = this.order.snapshot();
    const operationId = `link-${++this.operationCounter}`;
    const plan = new EffectPlanBuilder().build(
      operationId,
      path,
      before,
      after,
      result,
      this.registry.gameplay.pot.minimumThrowsToCook,
      this.registry.gameplay.pot.baseSlots,
    );
    this.activeOperationId = operationId;
    this.phase = 'ANIMATING';
    return { accepted: true, plan };
  }

  public completeAnimation(operationId: string): boolean {
    if (this.phase !== 'ANIMATING' || this.activeOperationId !== operationId) {
      return false;
    }
    this.activeOperationId = undefined;
    this.phase = 'POT_REVIEW';
    return true;
  }

  public fire(): FireResult | undefined {
    if (this.phase !== 'POT_REVIEW' || !this.order.pot.canFire()) {
      return undefined;
    }
    this.fireResult = this.order.fire();
    this.phase = 'COOKING';
    this.activeOperationId = `cook-${++this.operationCounter}`;
    return deepClone(this.fireResult);
  }

  public completeCooking(operationId?: string): boolean {
    if (this.phase !== 'COOKING') {
      return false;
    }
    if (operationId && operationId !== this.activeOperationId) {
      return false;
    }
    this.activeOperationId = undefined;
    this.phase = 'REVEAL';
    return true;
  }

  public continueAfterReveal(): ContinueResult {
    if (this.phase !== 'REVEAL' || this.order.orderResult !== 'CONTINUE_AFTER_REVEAL') {
      throw new Error('Continue is only available after a non-target reveal');
    }
    const before = this.order.snapshot();
    this.order.continueAfterReveal();
    const after = this.order.snapshot();
    if (before.boardHash !== after.boardHash
      || stableHash(before.queueCursors) !== stableHash(after.queueCursors)
      || before.remainingSteps !== after.remainingSteps) {
      throw new Error('Continue-after-reveal mutated protected run state');
    }
    this.fireResult = undefined;
    this.phase = 'READY';
    return {
      boardHash: after.boardHash,
      queueHash: stableHash(after.queueCursors),
      remainingSteps: after.remainingSteps,
      orderResult: after.orderResult,
    };
  }

  public pause(): boolean {
    if (this.phase === 'PAUSED' || this.phase === 'ANIMATING' || this.phase === 'COOKING') {
      return false;
    }
    this.phaseBeforePause = this.phase;
    this.phase = 'PAUSED';
    return true;
  }

  public resume(): boolean {
    if (this.phase !== 'PAUSED') {
      return false;
    }
    this.phase = this.phaseBeforePause;
    return true;
  }

  public restart(seed = 0x43503042): void {
    const scenario = this.registry.scenarioById.get('O1_TUTORIAL_001')!;
    this.order = new OrderSession(
      this.registry,
      scenario,
      this.order.discovery,
      seed,
    );
    this.editor = undefined;
    this.fireResult = undefined;
    this.activeOperationId = undefined;
    this.phase = 'READY';
  }

  public snapshot(): RunSnapshotData {
    return this.order.snapshot();
  }

  public activePath(): Coord[] {
    return this.editor?.snapshot() ?? [];
  }

  public currentOperationId(): string | undefined {
    return this.activeOperationId;
  }
}
