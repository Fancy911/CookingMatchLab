import {
  BlockInputEvents,
  Color,
  EventMouse,
  EventTouch,
  Game,
  game,
  Graphics,
  Label,
  LabelOutline,
  Layers,
  Node,
  Input,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
  input,
} from 'cc';
import type { ConfigRegistry } from '../application/cp0c/ConfigRegistry';
import { DevelopmentResearchSchedule } from '../application/r1b/DevelopmentResearchSchedule';
import {
  ResearchGameplaySession,
  type BattleViewModel,
  type CookPresentation,
} from '../application/r1b/ResearchGameplaySession';
import { SystemClock } from '../application/r1b/ResearchPorts';
import type {
  AudioEvent,
  IngredientId,
  ProcessingLevel,
  RecipeId,
  ThrowRecord,
} from '../domain/cp0b/types';
import { BattleBoardController } from './BattleBoardController';

const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;
const SCREEN_CENTER_X = SCREEN_WIDTH / 2;

export const R1B_ASSETS = {
  potPotato: 'game/art/pot/pot_potato/spriteFrame',
  potCarrot: 'game/art/pot/pot_carrot/spriteFrame',
  potMushroom: 'game/art/pot/pot_mushroom/spriteFrame',
  dishPotatoCake: 'game/art/dishes/dish_scallion_potato_cake/spriteFrame',
  dishMushroomSoup: 'game/art/dishes/dish_garden_mushroom_soup/spriteFrame',
  lid: 'game/art/pot/pot_lid/spriteFrame',
} as const;

type FrameGetter = (key: string) => SpriteFrame;

const INGREDIENT_FRAME: Record<IngredientId, string> = {
  ING_TOMATO: 'tomato',
  ING_EGG: 'egg',
  ING_POTATO: 'potato',
  ING_CARROT: 'carrot',
  ING_MUSHROOM: 'mushroom',
  ING_SCALLION: 'scallion',
};

const POT_FRAME: Record<IngredientId, string> = {
  ING_TOMATO: 'potTomato',
  ING_EGG: 'potEgg',
  ING_POTATO: 'potPotato',
  ING_CARROT: 'potCarrot',
  ING_MUSHROOM: 'potMushroom',
  ING_SCALLION: 'potScallion',
};

const DISH_FRAME: Partial<Record<RecipeId, string>> = {
  RCP_TOMATO_EGG: 'dish',
  RCP_SCALLION_POTATO_CAKE: 'dishPotatoCake',
  RCP_GARDEN_MUSHROOM_SOUP: 'dishMushroomSoup',
};

const PROCESSING_MARK: Record<ProcessingLevel, string> = {
  NORMAL: '',
  PRECISE: '准',
  INSPIRATION: '灵',
  MASTER: 'M',
};

const safeQuery = (): URLSearchParams =>
  typeof globalThis.location === 'undefined'
    ? new URLSearchParams()
    : new URLSearchParams(globalThis.location.search);

export class R1BBattlePresenter {
  private readonly root: Node;
  private readonly safeArea: Node;
  private readonly session: ResearchGameplaySession;
  private readonly boardController: BattleBoardController;
  private readonly timerLabel: Label;
  private readonly timerShell: Sprite;
  private readonly scoreLabel: Label;
  private readonly comboRoot: Node;
  private readonly comboLabel: Label;
  private readonly clueText: Label;
  private readonly clueGroups: Node[] = [];
  private readonly clueIcons: Sprite[] = [];
  private readonly clueAmounts: Label[] = [];
  private readonly feedbackRoot: Node;
  private readonly feedbackOpacity: UIOpacity;
  private readonly feedbackLabel: Label;
  private readonly potRoot: Node;
  private readonly potIngredientLayer: Node;
  private readonly slotContentLayer: Node;
  private readonly fireRoot: Node;
  private readonly fireSprite: Sprite;
  private readonly fireLabel: Label;
  private readonly cookingLayer: Node;
  private readonly cookingLid: Sprite;
  private readonly revealOverlay: Node;
  private readonly revealDish: Sprite;
  private readonly revealName: Label;
  private readonly revealStatus: Label;
  private readonly revealScore: Label;
  private readonly revealCount: Label;
  private readonly revealStars: Node[] = [];
  private readonly revealContinue: Label;
  private readonly partialOverlay: Node;
  private readonly partialUnits: Label;
  private readonly summaryOverlay: Node;
  private readonly summaryScore: Label;
  private readonly summaryDetails: Label;
  private readonly pauseOverlay: Node;
  private lastBoardHash = '';
  private lastPotSignature = '';
  private lastClueId = '';
  private lastRenderedPhase = '';
  private lastCookingResultId = '';
  private activeCookingTimeline?: Node;
  private autoFireTimeline?: Node;
  private quickRevealTimeline?: Node;
  private destroyed = false;
  private readonly frameTimes: number[] = [];
  private peakActiveFlightNodes = 0;
  private longestFlightMs = 0;
  private lastUpdateAt = 0;
  private lastActiveTickAt = 0;
  private webCanvas?: HTMLCanvasElement;

  public constructor(
    parent: Node,
    private readonly frame: FrameGetter,
    registry: ConfigRegistry,
  ) {
    const forcedMenuId = safeQuery().get('menu') ?? undefined;
    this.session = new ResearchGameplaySession(
      registry,
      new DevelopmentResearchSchedule(),
      new SystemClock(),
      forcedMenuId,
    );
    this.root = this.makeRoot('R1BPlayableShell', parent);
    this.safeArea = this.makeRoot('SafeAreaRoot', this.root);
    this.safeArea.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.sprite('KitchenBackground', 'background', this.safeArea, 0, 0, 390, 844);

    const pauseButton = this.sprite(
      'PauseButton',
      'pause',
      this.safeArea,
      7,
      37,
      60,
      60,
    ).node;
    pauseButton.on(Node.EventType.TOUCH_END, this.pauseFromPlayer, this);
    pauseButton.on(Node.EventType.MOUSE_UP, this.pauseFromPlayer, this);

    this.timerShell = this.sprite(
      'KitchenTimer',
      'hudShell',
      this.safeArea,
      68,
      35,
      122,
      64,
      true,
    );
    this.label(
      'TimerCaption',
      '研究时间',
      this.safeArea,
      81,
      43,
      96,
      16,
      10,
      new Color(111, 57, 38, 255),
    );
    this.timerLabel = this.label(
      'TimerValue',
      '01:30',
      this.safeArea,
      76,
      55,
      106,
      34,
      27,
      new Color(255, 251, 224, 255),
    );
    this.sprite('ScoreBoard', 'nameplate', this.safeArea, 190, 36, 190, 62, true);
    this.label(
      'ScoreCaption',
      '研究分数',
      this.safeArea,
      204,
      43,
      66,
      16,
      10,
      new Color(141, 80, 48, 255),
    );
    this.scoreLabel = this.label(
      'ScoreValue',
      '0',
      this.safeArea,
      246,
      48,
      120,
      36,
      27,
      new Color(104, 53, 36, 255),
    );
    this.comboRoot = this.makeRoot('ComboBadge', this.safeArea);
    this.sprite(
      'ComboBadgeShell',
      'hudShell',
      this.comboRoot,
      250,
      78,
      119,
      27,
      true,
    );
    this.comboLabel = this.label(
      'ComboValue',
      'COMBO ×1.0',
      this.comboRoot,
      256,
      80,
      107,
      22,
      12,
      new Color(255, 249, 218, 255),
    );

    this.sprite('ClueTrayBody', 'clueTray', this.safeArea, 0, 76, 390, 120);
    this.label(
      'ClueTitle',
      '研究线索',
      this.safeArea,
      27,
      108,
      92,
      25,
      16,
      new Color(112, 59, 39, 255),
    );
    this.clueText = this.label(
      'ClueText',
      '',
      this.safeArea,
      24,
      137,
      342,
      32,
      13,
      new Color(112, 59, 39, 255),
    );
    for (let index = 0; index < 4; index += 1) {
      const group = this.makeRoot(`ClueGroup${index + 1}`, this.safeArea);
      const x = 119 + index * 62;
      const icon = this.sprite(
        `ClueIcon${index + 1}`,
        'tomato',
        group,
        x,
        101,
        32,
        32,
      );
      const amount = this.label(
        `ClueAmount${index + 1}`,
        '×1',
        group,
        x + 29,
        105,
        31,
        23,
        14,
        new Color(108, 60, 40, 255),
      );
      this.clueGroups.push(group);
      this.clueIcons.push(icon);
      this.clueAmounts.push(amount);
    }

    this.sprite('BoardFrame', 'boardFrame', this.safeArea, -55, 110, 500, 480);
    const boardRoot = this.makeRoot('InteractiveBoard', this.safeArea);
    const fxRoot = this.makeRoot('BoardFxRoot', this.safeArea);
    fxRoot.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.boardController = new BattleBoardController(
      boardRoot,
      fxRoot,
      this.frame('tile'),
      {
        ING_TOMATO: this.frame('tomato'),
        ING_EGG: this.frame('egg'),
        ING_POTATO: this.frame('potato'),
        ING_CARROT: this.frame('carrot'),
        ING_MUSHROOM: this.frame('mushroom'),
        ING_SCALLION: this.frame('scallion'),
      },
      this.frame('star'),
      (name, frame, node, x, y, width, height) =>
        this.sprite(name, frame, node, x, y, width, height),
    );
    this.boardController.onBegin = (coord) => this.session.beginLink(coord);
    this.boardController.onExtend = (coord) => this.session.extendLink(coord);
    this.boardController.onCommit = () => this.commitCurrentLink();

    this.feedbackRoot = this.makeRoot('LongLinkFeedback', this.safeArea);
    this.feedbackOpacity = this.feedbackRoot.addComponent(UIOpacity);
    this.sprite(
      'LongLinkFeedbackShell',
      'hudShell',
      this.feedbackRoot,
      104,
      182,
      182,
      58,
      true,
    );
    this.feedbackLabel = this.label(
      'LongLinkFeedbackText',
      'GOOD',
      this.feedbackRoot,
      112,
      191,
      166,
      38,
      25,
      new Color(255, 251, 218, 255),
    );
    this.feedbackRoot.active = false;

    this.potRoot = this.makeRoot('ResearchPot', this.safeArea);
    this.sprite('ResearchPotBack', 'pot', this.potRoot, 45, 525, 300, 224);
    this.potIngredientLayer = this.makeRoot('PotIngredientLayer', this.potRoot);
    this.sprite('ResearchPotFront', 'potFront', this.potRoot, 45, 593, 300, 156);
    this.label(
      'PotCaption',
      '基础研究锅',
      this.potRoot,
      108,
      665,
      174,
      24,
      15,
      new Color(105, 57, 40, 255),
    );
    this.cookingLayer = this.makeRoot('CookingFeedback', this.potRoot);
    this.cookingLid = this.sprite(
      'CookingLid',
      'lid',
      this.cookingLayer,
      83,
      509,
      224,
      124,
    );
    this.cookingLayer.active = false;

    this.sprite('SixSlotBoard', 'throwTraySix', this.safeArea, 6, 695, 274, 122, true);
    this.slotContentLayer = this.makeRoot('ThrowSlotContentLayer', this.safeArea);

    this.fireRoot = this.makeRoot('FireButton', this.safeArea);
    this.fireSprite = this.sprite(
      'FireButtonBody',
      'fire',
      this.fireRoot,
      272,
      703,
      118,
      130,
    );
    this.fireLabel = this.label(
      'FireButtonLabel',
      '开火研究',
      this.fireRoot,
      283,
      791,
      96,
      26,
      15,
      new Color(114, 61, 34, 255),
    );
    this.fireSprite.node.on(Node.EventType.TOUCH_END, this.fireFromPlayer, this);
    this.fireSprite.node.on(Node.EventType.MOUSE_UP, this.fireFromPlayer, this);
    this.fireLabel.node.on(Node.EventType.TOUCH_END, this.fireFromPlayer, this);
    this.fireLabel.node.on(Node.EventType.MOUSE_UP, this.fireFromPlayer, this);

    this.revealOverlay = this.makeRevealOverlay();
    this.revealDish = this.revealOverlay.getChildByName('RevealDish')!.getComponent(Sprite)!;
    this.revealName = this.revealOverlay.getChildByName('RevealDishName')!.getComponent(Label)!;
    this.revealStatus = this.revealOverlay.getChildByName('RevealStatus')!.getComponent(Label)!;
    this.revealScore = this.revealOverlay.getChildByName('RevealScore')!.getComponent(Label)!;
    this.revealCount = this.revealOverlay.getChildByName('RevealCount')!.getComponent(Label)!;
    this.revealContinue = this.revealOverlay
      .getChildByName('RevealContinue')!
      .getComponent(Label)!;
    for (let index = 0; index < 3; index += 1) {
      this.revealStars.push(this.revealOverlay.getChildByName(`RevealStar${index + 1}`)!);
    }
    this.revealOverlay.on(Node.EventType.TOUCH_END, this.continueReveal, this);
    this.revealOverlay.on(Node.EventType.MOUSE_UP, this.continueReveal, this);

    this.partialOverlay = this.makePartialOverlay();
    this.partialUnits = this.partialOverlay
      .getChildByName('PartialUnits')!
      .getComponent(Label)!;
    this.partialOverlay.on(Node.EventType.TOUCH_END, this.continuePartial, this);
    this.partialOverlay.on(Node.EventType.MOUSE_UP, this.continuePartial, this);

    this.summaryOverlay = this.makeSummaryOverlay();
    this.summaryScore = this.summaryOverlay
      .getChildByName('SummaryScore')!
      .getComponent(Label)!;
    this.summaryDetails = this.summaryOverlay
      .getChildByName('SummaryDetails')!
      .getComponent(Label)!;
    const restart = this.summaryOverlay.getChildByName('RestartResearch')!;
    restart.on(Node.EventType.TOUCH_END, this.restart, this);
    restart.on(Node.EventType.MOUSE_UP, this.restart, this);
    const returnButton = this.summaryOverlay.getChildByName('ReturnResearchEntrance')!;
    returnButton.on(Node.EventType.TOUCH_END, this.returnToR1Entrance, this);
    returnButton.on(Node.EventType.MOUSE_UP, this.returnToR1Entrance, this);

    this.pauseOverlay = this.makePauseOverlay();
    this.pauseOverlay.getChildByName('ResumeResearch')!
      .on(Node.EventType.TOUCH_END, this.resume, this);
    this.pauseOverlay.getChildByName('ResumeResearch')!
      .on(Node.EventType.MOUSE_UP, this.resume, this);
    this.pauseOverlay.getChildByName('RestartFromPause')!
      .on(Node.EventType.TOUCH_END, this.restart, this);
    this.pauseOverlay.getChildByName('RestartFromPause')!
      .on(Node.EventType.MOUSE_UP, this.restart, this);
    this.pauseOverlay.getChildByName('ReturnFromPause')!
      .on(Node.EventType.TOUCH_END, this.returnToR1Entrance, this);
    this.pauseOverlay.getChildByName('ReturnFromPause')!
      .on(Node.EventType.MOUSE_UP, this.returnToR1Entrance, this);

    game.on(Game.EVENT_HIDE, this.pauseFromBackground, this);
    game.on(Game.EVENT_SHOW, this.onForeground, this);
    input.on(Input.EventType.TOUCH_END, this.routeGlobalPointerEnd, this);
    input.on(Input.EventType.MOUSE_UP, this.routeGlobalPointerEnd, this);
    this.bindWebPointerFallback();
    this.render(true);
    console.info(
      `[CP0-R1-B] playable menu ${this.session.menu.dailyMenuId}; canonical config ${registry.configHash}`,
    );
  }

  public update(_deltaSeconds: number): void {
    if (this.destroyed) return;
    const now = globalThis.performance?.now?.() ?? Date.now();
    if (this.lastUpdateAt > 0) {
      const frameMs = now - this.lastUpdateAt;
      if (frameMs > 0 && frameMs < 1000) {
        this.frameTimes.push(frameMs);
        if (this.frameTimes.length > 3600) this.frameTimes.shift();
      }
    }
    this.lastUpdateAt = now;
    const phaseBefore = this.session.viewModel().phase;
    const activeElapsedMs = this.lastActiveTickAt > 0
      ? Math.min(250, Math.max(0, now - this.lastActiveTickAt))
      : 0;
    this.lastActiveTickAt = now;
    this.session.tick(activeElapsedMs);
    const view = this.session.viewModel();
    this.render();
    if (
      phaseBefore !== view.phase
      && view.phase === 'AUTO_FIRE_READY'
      && !this.autoFireTimeline
    ) {
      this.scheduleAutoFire();
    }
    this.publishPerformance();
  }

  public destroy(): void {
    this.destroyed = true;
    game.off(Game.EVENT_HIDE, this.pauseFromBackground, this);
    game.off(Game.EVENT_SHOW, this.onForeground, this);
    input.off(Input.EventType.TOUCH_END, this.routeGlobalPointerEnd, this);
    input.off(Input.EventType.MOUSE_UP, this.routeGlobalPointerEnd, this);
    this.unbindWebPointerFallback();
    this.boardController.destroy();
    [this.activeCookingTimeline, this.autoFireTimeline, this.quickRevealTimeline]
      .forEach((node) => {
        if (!node) return;
        Tween.stopAllByTarget(node);
        node.destroy();
      });
  }

  private commitCurrentLink(): void {
    const submission = this.session.commitLink();
    if (!submission.accepted || !submission.plan) {
      this.boardController.cancelActivePath();
      this.boardController.setInputEnabled(true);
      this.render();
      return;
    }
    const plan = submission.plan;
    this.peakActiveFlightNodes = Math.max(
      this.peakActiveFlightNodes,
      plan.flightOrder.length,
    );
    const staggerMs = Math.max(24, Math.min(55, 420 / plan.path.length));
    const totalFlightMs = (plan.path.length - 1) * staggerMs + 460;
    this.longestFlightMs = Math.max(this.longestFlightMs, totalFlightMs);
    if (plan.audioEvent) {
      this.showFeedback(plan.audioEvent);
    }
    this.render();
    this.boardController.animate(
      plan,
      () => {
        this.lastPotSignature = JSON.stringify(plan.throwRecords);
        this.renderPot(plan.throwRecords);
        this.renderSlots(plan.throwRecords);
      },
      () => {
        if (!this.session.completeAnimation(plan.operationId)) return;
        this.render(true);
        if (this.session.viewModel().phase === 'AUTO_FIRE_READY') {
          this.scheduleAutoFire();
        }
      },
    );
  }

  private scheduleAutoFire(): void {
    if (this.autoFireTimeline) return;
    const timeline = this.makeRoot('AutoFireDelay', this.safeArea);
    this.autoFireTimeline = timeline;
    const badge = this.sprite(
      'FullPotBadge',
      'hudShell',
      timeline,
      101,
      563,
      188,
      50,
      true,
    ).node;
    this.label(
      'FullPotText',
      '满锅！自动开火',
      timeline,
      111,
      572,
      168,
      32,
      19,
      new Color(255, 249, 218, 255),
    );
    badge.setScale(0.78, 0.78, 1);
    tween(badge).to(0.22, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    tween(timeline)
      .delay(0.6)
      .call(() => {
        this.autoFireTimeline = undefined;
        timeline.destroy();
        const cooking = this.session.confirmAutoFire();
        if (cooking) this.startCooking(cooking);
      })
      .start();
  }

  private fireFromPlayer(): void {
    const cooking = this.session.fire();
    if (cooking) this.startCooking(cooking);
  }

  private startCooking(cooking: CookPresentation): void {
    if (this.activeCookingTimeline) return;
    this.render(true);
    this.cookingLayer.active = true;
    this.cookingLid.node.setPosition(this.cookingLid.node.position.x, 42, 0);
    this.cookingLid.node.setScale(0.92, 0.92, 1);
    const flame = this.makeRoot('CookingFlame', this.cookingLayer);
    const flameGraphic = flame.addComponent(Graphics);
    flameGraphic.fillColor = new Color(255, 151, 46, 235);
    flameGraphic.ellipse(0, 0, 54, 32);
    flameGraphic.fill();
    flame.setPosition(0, -245, 0);
    const steam = this.makeRoot('CookingSteam', this.cookingLayer);
    const steamOpacity = steam.addComponent(UIOpacity);
    const steamGraphic = steam.addComponent(Graphics);
    steamGraphic.strokeColor = new Color(255, 250, 224, 190);
    steamGraphic.lineWidth = 8;
    steamGraphic.moveTo(-32, 10);
    steamGraphic.bezierCurveTo(-48, 34, -15, 48, -26, 72);
    steamGraphic.moveTo(10, 8);
    steamGraphic.bezierCurveTo(-4, 34, 30, 48, 18, 76);
    steamGraphic.stroke();
    steam.setPosition(0, -102, 0);
    this.potRoot.setScale(1, 1, 1);
    tween(this.cookingLid.node)
      .to(0.24, { position: new Vec3(this.cookingLid.node.position.x, 3, 0) }, {
        easing: 'backOut',
      })
      .start();
    tween(this.potRoot)
      .repeat(
        4,
        tween()
          .to(0.11, { angle: -1.5 })
          .to(0.11, { angle: 1.5 }),
      )
      .to(0.08, { angle: 0 })
      .start();
    tween(flame)
      .repeatForever(
        tween()
          .to(0.12, { scale: new Vec3(1.08, 0.9, 1) })
          .to(0.12, { scale: new Vec3(0.94, 1.08, 1) }),
      )
      .start();
    tween(steam)
      .repeatForever(
        tween()
          .to(0.32, { position: new Vec3(0, -82, 0) })
          .set({ position: new Vec3(0, -105, 0) }),
      )
      .start();
    tween(steamOpacity)
      .repeatForever(
        tween()
          .to(0.32, { opacity: 110 })
          .set({ opacity: 255 }),
      )
      .start();
    const timeline = this.makeRoot('CookingTimeline', this.safeArea);
    this.activeCookingTimeline = timeline;
    tween(timeline)
      .delay(1.18)
      .call(() => {
        Tween.stopAllByTarget(flame);
        Tween.stopAllByTarget(steam);
        flame.destroy();
        steam.destroy();
        this.cookingLayer.active = false;
        this.activeCookingTimeline = undefined;
        timeline.destroy();
        if (!this.session.completeCooking(cooking.operationId)) return;
        this.render(true);
        this.presentReveal(cooking);
      })
      .start();
  }

  private presentReveal(cooking: CookPresentation): void {
    this.revealOverlay.active = true;
    this.lastCookingResultId = cooking.result.cookResultId;
    this.revealDish.spriteFrame = this.frame(
      DISH_FRAME[cooking.recipeId] ?? 'dish',
    );
    this.revealName.string = cooking.recipeName;
    this.revealStatus.string = cooking.quick
      ? '再次完成 · 快速记录'
      : cooking.result.isNewDiscovery
        ? '首次发现'
        : '料理研究完成';
    this.revealScore.string = `+${cooking.result.dishScore.toLocaleString('en-US')}`;
    this.revealCount.string = `本局 ×${cooking.sessionCookCount}`;
    this.revealContinue.string = cooking.quick ? '研究记录中…' : '轻触继续研究';
    this.revealStars.forEach((node, index) => {
      node.active = index < cooking.result.stars;
    });
    if (cooking.quick) {
      const timeline = this.makeRoot('QuickRevealTimeline', this.revealOverlay);
      this.quickRevealTimeline = timeline;
      tween(timeline)
        .delay(1.05)
        .call(() => {
          this.quickRevealTimeline = undefined;
          timeline.destroy();
          this.finishReveal(cooking.result.cookResultId);
        })
        .start();
    }
  }

  private continueReveal(): void {
    const cooking = this.session.viewModel().cooking;
    if (!cooking || cooking.quick || this.activeCookingTimeline) return;
    this.finishReveal(cooking.result.cookResultId);
  }

  private finishReveal(cookResultId: string): void {
    if (!this.session.completeReveal(cookResultId)) return;
    this.revealOverlay.active = false;
    this.lastCookingResultId = '';
    this.render(true);
  }

  private showFeedback(event: AudioEvent): void {
    Tween.stopAllByTarget(this.feedbackRoot);
    this.feedbackRoot.active = true;
    this.feedbackLabel.string = event;
    this.feedbackLabel.fontSize = event === 'UNBELIEVABLE' ? 19 : 25;
    this.feedbackRoot.setScale(0.55, 0.55, 1);
    this.feedbackOpacity.opacity = 255;
    this.feedbackRoot.angle = event === 'GREAT' ? 5 : -6;
    tween(this.feedbackRoot)
      .to(0.2, { scale: new Vec3(1.08, 1.08, 1) }, { easing: 'backOut' })
      .to(0.08, { scale: Vec3.ONE })
      .delay(0.48)
      .to(0.18, { scale: new Vec3(0.92, 0.92, 1) })
      .call(() => {
        this.feedbackRoot.active = false;
        this.feedbackOpacity.opacity = 255;
      })
      .start();
    tween(this.feedbackOpacity)
      .delay(0.76)
      .to(0.18, { opacity: 0 })
      .start();
  }

  private render(force = false): void {
    const view = this.session.viewModel();
    this.timerLabel.string = view.timerText;
    this.timerLabel.color = view.timerWarning
      ? new Color(255, 216, 182, 255)
      : new Color(255, 251, 224, 255);
    this.timerShell.color = view.timerWarning
      ? new Color(255, 178, 145, 255)
      : Color.WHITE;
    if (view.phase !== 'ANIMATING') {
      this.scoreLabel.string = view.totalScore.toLocaleString('en-US');
      this.comboRoot.active = view.comboCount > 0;
      this.comboLabel.string = `COMBO ×${view.comboMultiplier.toFixed(1)}`;
    }
    if (force || view.clue.id !== this.lastClueId) {
      this.lastClueId = view.clue.id;
      this.clueText.string = view.clue.text;
      this.clueText.overflow = Label.Overflow.SHRINK;
      this.renderClue(view);
    }
    if (
      view.phase !== 'ANIMATING'
      && (force || view.boardHash !== this.lastBoardHash)
    ) {
      this.lastBoardHash = view.boardHash;
      this.boardController.render(view.board);
    }
    const potSignature = JSON.stringify(view.throwRecords);
    if (
      view.phase !== 'ANIMATING'
      && (force || potSignature !== this.lastPotSignature)
    ) {
      this.lastPotSignature = potSignature;
      this.renderPot(view.throwRecords);
      this.renderSlots(view.throwRecords);
    }
    this.renderFire(view);
    this.boardController.setInputEnabled(
      !this.session.isPaused()
      && (view.phase === 'READY' || view.phase === 'LINKING'),
    );
    if (view.phase === 'PARTIAL_RESULT') {
      this.partialUnits.string = `已投入 ${view.partialUnits} 份食材`;
      this.partialOverlay.active = true;
    } else if (view.phase !== 'PAUSED') {
      this.partialOverlay.active = false;
    }
    if (view.phase === 'SUMMARY') {
      this.renderSummary(view);
      this.summaryOverlay.active = true;
    }
    this.pauseOverlay.active = view.phase === 'PAUSED';
    this.lastRenderedPhase = view.phase;
  }

  private renderClue(view: BattleViewModel): void {
    view.clue.ingredientHints.slice(0, 4).forEach((hint, index) => {
      this.clueGroups[index].active = true;
      this.clueIcons[index].spriteFrame = this.frame(INGREDIENT_FRAME[hint.ingredientId]);
      this.clueAmounts[index].string = `×${hint.units}`;
    });
    for (
      let index = view.clue.ingredientHints.length;
      index < this.clueGroups.length;
      index += 1
    ) {
      this.clueGroups[index].active = false;
    }
  }

  private renderPot(records: ThrowRecord[]): void {
    this.potIngredientLayer.removeAllChildren();
    const placements = [
      { x: 69, y: 538, w: 91, h: 84, angle: -8 },
      { x: 115, y: 527, w: 94, h: 92, angle: 4 },
      { x: 162, y: 532, w: 89, h: 86, angle: -2 },
      { x: 205, y: 532, w: 88, h: 86, angle: 8 },
      { x: 100, y: 555, w: 84, h: 78, angle: -4 },
      { x: 183, y: 555, w: 84, h: 78, angle: 5 },
    ];
    records.forEach((record, index) => {
      const placement = placements[index];
      const sprite = this.sprite(
        `PotThrow${index + 1}_${record.ingredientId}`,
        POT_FRAME[record.ingredientId],
        this.potIngredientLayer,
        placement.x,
        placement.y,
        placement.w,
        placement.h,
      );
      sprite.node.angle = placement.angle;
    });
  }

  private renderSlots(records: ThrowRecord[]): void {
    this.slotContentLayer.removeAllChildren();
    records.forEach((record, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const centerX = 55 + column * 88;
      const centerY = 728 + row * 51;
      this.sprite(
        `ThrowSlot${index + 1}Ingredient`,
        INGREDIENT_FRAME[record.ingredientId],
        this.slotContentLayer,
        centerX - 22,
        centerY - 22,
        40,
        40,
      );
      this.label(
        `ThrowSlot${index + 1}Units`,
        '1份',
        this.slotContentLayer,
        centerX + 3,
        centerY + 5,
        38,
        20,
        12,
        new Color(255, 246, 209, 255),
      );
      const mark = PROCESSING_MARK[record.processingLevel];
      if (mark) {
        this.sprite(
          `ThrowSlot${index + 1}ProcessingStar`,
          'star',
          this.slotContentLayer,
          centerX + 16,
          centerY - 23,
          18,
          18,
        );
        this.label(
          `ThrowSlot${index + 1}ProcessingMark`,
          mark,
          this.slotContentLayer,
          centerX + 18,
          centerY - 22,
          15,
          15,
          9,
          new Color(126, 70, 35, 255),
        );
      }
    });
  }

  private renderFire(view: BattleViewModel): void {
    const enabled = view.canFire
      && view.phase === 'READY'
      && !this.session.isPaused();
    this.fireSprite.color = enabled
      ? Color.WHITE
      : new Color(151, 155, 139, 225);
    this.fireLabel.color = enabled
      ? new Color(112, 58, 30, 255)
      : new Color(135, 115, 94, 255);
  }

  private renderSummary(view: BattleViewModel): void {
    const summary = view.summary;
    this.summaryScore.string = `本局总分  ${summary.totalScore.toLocaleString('en-US')}`;
    const recipeLines = Object.entries(summary.recipeCounts)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([recipeId, count]) => {
        const recipe = this.session.registry.recipeById.get(recipeId as RecipeId);
        return `${recipe?.name ?? recipeId} ×${count}`;
      });
    this.summaryDetails.string = [
      `正式料理 ${summary.formalDishCount} 道`,
      ...recipeLines,
      `新发现 ${summary.newDiscoveries.length} 道`,
      `最长连线 ${summary.longestLink} 格`,
      `最高 Combo ×${summary.highestComboMultiplier.toFixed(1)}`,
    ].join('\n');
  }

  private pauseFromPlayer(): void {
    if (this.session.pause()) {
      this.boardController.cancelActivePath();
      this.render(true);
    }
  }

  private pauseFromBackground(): void {
    if (this.session.pause()) {
      this.boardController.cancelActivePath();
      this.render(true);
    }
  }

  private onForeground(): void {
    this.lastActiveTickAt = globalThis.performance?.now?.() ?? Date.now();
    this.render(true);
  }

  private resume(): void {
    if (!this.session.resume()) return;
    this.lastActiveTickAt = globalThis.performance?.now?.() ?? Date.now();
    this.render(true);
    const view = this.session.viewModel();
    if (view.phase === 'AUTO_FIRE_READY') {
      this.scheduleAutoFire();
    }
    if (view.phase === 'REVEAL' && view.cooking) {
      this.presentReveal(view.cooking);
    }
  }

  private restart(): void {
    this.cancelTimelines();
    this.session.restart();
    this.revealOverlay.active = false;
    this.partialOverlay.active = false;
    this.summaryOverlay.active = false;
    this.pauseOverlay.active = false;
    this.lastBoardHash = '';
    this.lastPotSignature = '';
    this.lastClueId = '';
    this.lastCookingResultId = '';
    this.render(true);
  }

  private returnToR1Entrance(): void {
    if (typeof globalThis.location !== 'undefined') {
      globalThis.location.href = `${globalThis.location.pathname}?menu=DEV_MENU_MULTI`;
    } else {
      this.restart();
    }
  }

  private continuePartial(): void {
    if (!this.session.completePartialResult()) return;
    this.partialOverlay.active = false;
    this.render(true);
  }

  private routeGlobalPointerEnd(event: EventTouch | EventMouse): void {
    const location = event.getUILocation();
    this.routePointerEndAt(location.x, SCREEN_HEIGHT - location.y);
  }

  private routePointerEndAt(x: number, y: number): void {
    const view = this.session.viewModel();
    if (view.phase === 'PAUSED') {
      if (x >= 74 && x <= 316 && y >= 346 && y <= 404) {
        this.resume();
      } else if (x >= 74 && x <= 316 && y >= 420 && y <= 478) {
        this.restart();
      } else if (x >= 74 && x <= 316 && y >= 494 && y <= 552) {
        this.returnToR1Entrance();
      }
      return;
    }
    if (view.phase === 'SUMMARY') {
      if (x >= 48 && x <= 342 && y >= 624 && y <= 688) {
        this.restart();
      } else if (x >= 76 && x <= 314 && y >= 704 && y <= 756) {
        this.returnToR1Entrance();
      }
      return;
    }
    if (view.phase === 'PARTIAL_RESULT') {
      this.continuePartial();
      return;
    }
    if (view.phase === 'REVEAL') {
      this.continueReveal();
      return;
    }
    if (x >= 7 && x <= 67 && y >= 37 && y <= 97) {
      this.pauseFromPlayer();
      return;
    }
    if (x >= 272 && x <= 390 && y >= 703 && y <= 833) {
      this.fireFromPlayer();
    }
  }

  private bindWebPointerFallback(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    this.webCanvas = canvas;
    canvas.addEventListener('pointerdown', this.onWebPointerDown);
    canvas.addEventListener('pointermove', this.onWebPointerMove);
    canvas.addEventListener('pointerup', this.onWebPointerUp);
    canvas.addEventListener('pointercancel', this.onWebPointerCancel);
  }

  private unbindWebPointerFallback(): void {
    if (!this.webCanvas) return;
    this.webCanvas.removeEventListener('pointerdown', this.onWebPointerDown);
    this.webCanvas.removeEventListener('pointermove', this.onWebPointerMove);
    this.webCanvas.removeEventListener('pointerup', this.onWebPointerUp);
    this.webCanvas.removeEventListener('pointercancel', this.onWebPointerCancel);
    this.webCanvas = undefined;
  }

  private readonly onWebPointerDown = (event: PointerEvent): void => {
    const point = this.webPointerPoint(event);
    this.webCanvas?.setPointerCapture?.(event.pointerId);
    this.boardController.pointerStart(point.x, point.y);
  };

  private readonly onWebPointerMove = (event: PointerEvent): void => {
    const point = this.webPointerPoint(event);
    this.boardController.pointerMove(point.x, point.y);
  };

  private readonly onWebPointerUp = (event: PointerEvent): void => {
    const point = this.webPointerPoint(event);
    this.boardController.pointerEnd();
    this.routePointerEndAt(point.x, point.y);
  };

  private readonly onWebPointerCancel = (): void => {
    this.boardController.pointerEnd();
  };

  private webPointerPoint(event: PointerEvent): { x: number; y: number } {
    const bounds = this.webCanvas?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: (event.clientX - bounds.left) * SCREEN_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * SCREEN_HEIGHT / bounds.height,
    };
  }

  private cancelTimelines(): void {
    [this.activeCookingTimeline, this.autoFireTimeline, this.quickRevealTimeline]
      .forEach((timeline) => {
        if (!timeline) return;
        Tween.stopAllByTarget(timeline);
        timeline.destroy();
      });
    this.activeCookingTimeline = undefined;
    this.autoFireTimeline = undefined;
    this.quickRevealTimeline = undefined;
    Tween.stopAllByTarget(this.potRoot);
    Tween.stopAllByTarget(this.feedbackRoot);
  }

  private makeRevealOverlay(): Node {
    const overlay = this.fullScreenOverlay('RevealOverlay', new Color(43, 28, 23, 246));
    this.sprite('RevealHalo', 'halo', overlay, 42, 130, 306, 306);
    this.sprite('RevealRarity', 'rarity', overlay, 137, 48, 116, 116);
    this.label(
      'RevealStatus',
      '首次发现',
      overlay,
      113,
      147,
      164,
      43,
      18,
      new Color(255, 247, 226, 255),
    );
    this.sprite('RevealPedestal', 'pedestal', overlay, 18, 333, 354, 354);
    this.sprite('RevealDish', 'dish', overlay, 27, 184, 336, 336);
    this.sprite('RevealNameplate', 'nameplate', overlay, 25, 503, 340, 168);
    this.label(
      'RevealDishName',
      '',
      overlay,
      58,
      554,
      274,
      42,
      28,
      new Color(104, 57, 37, 255),
    );
    for (let index = 0; index < 3; index += 1) {
      this.sprite(
        `RevealStar${index + 1}`,
        'star',
        overlay,
        81 + index * 76,
        603,
        76,
        76,
      );
    }
    this.sprite('RevealReward', 'nameplate', overlay, 56, 682, 278, 58, true);
    this.label(
      'RevealScore',
      '+0',
      overlay,
      75,
      691,
      134,
      34,
      25,
      new Color(106, 56, 37, 255),
    );
    this.label(
      'RevealCount',
      '本局 ×1',
      overlay,
      202,
      695,
      108,
      28,
      16,
      new Color(132, 77, 45, 255),
    );
    this.sprite('RevealContinueNote', 'nameplate', overlay, 69, 746, 252, 48, true);
    this.label(
      'RevealContinue',
      '轻触继续研究',
      overlay,
      82,
      756,
      226,
      27,
      14,
      new Color(111, 61, 41, 255),
    );
    overlay.active = false;
    return overlay;
  }

  private makePartialOverlay(): Node {
    const overlay = this.fullScreenOverlay(
      'PartialResultOverlay',
      new Color(43, 28, 23, 235),
    );
    this.sprite('PartialHalo', 'halo', overlay, 68, 166, 254, 254);
    this.sprite('PartialTray', 'orderTray', overlay, 18, 294, 354, 306, true);
    this.label(
      'PartialTitle',
      '研究半成品',
      overlay,
      75,
      352,
      240,
      48,
      28,
      new Color(104, 57, 37, 255),
    );
    this.label(
      'PartialUnits',
      '已投入 0 份食材',
      overlay,
      79,
      412,
      232,
      38,
      19,
      new Color(126, 73, 45, 255),
    );
    this.label(
      'PartialHint',
      '灵感已经记下，下次继续研究吧',
      overlay,
      60,
      466,
      270,
      42,
      15,
      new Color(126, 73, 45, 255),
    );
    this.sprite('PartialContinueShell', 'nameplate', overlay, 75, 544, 240, 54, true);
    this.label(
      'PartialContinue',
      '查看本局成果',
      overlay,
      96,
      556,
      198,
      28,
      16,
      new Color(111, 61, 41, 255),
    );
    overlay.active = false;
    return overlay;
  }

  private makeSummaryOverlay(): Node {
    const overlay = this.fullScreenOverlay(
      'SummaryOverlay',
      new Color(43, 28, 23, 242),
    );
    this.sprite('SummaryTray', 'orderTray', overlay, 12, 92, 366, 494, true);
    this.label(
      'SummaryTitle',
      '料理研究成果',
      overlay,
      68,
      143,
      254,
      48,
      29,
      new Color(104, 57, 37, 255),
    );
    this.label(
      'SummaryScore',
      '本局总分  0',
      overlay,
      62,
      208,
      266,
      50,
      25,
      new Color(126, 73, 45, 255),
    );
    this.label(
      'SummaryDetails',
      '',
      overlay,
      70,
      272,
      250,
      204,
      18,
      new Color(126, 73, 45, 255),
    );
    const restart = this.sprite(
      'RestartResearch',
      'continueButton',
      overlay,
      48,
      624,
      294,
      64,
      true,
    ).node;
    this.label(
      'RestartResearchText',
      '重新研究',
      overlay,
      88,
      641,
      214,
      30,
      19,
      new Color(106, 56, 37, 255),
    );
    const returnButton = this.sprite(
      'ReturnResearchEntrance',
      'nameplate',
      overlay,
      76,
      704,
      238,
      52,
      true,
    ).node;
    this.label(
      'ReturnResearchEntranceText',
      '返回研究入口',
      overlay,
      102,
      716,
      186,
      27,
      15,
      new Color(106, 56, 37, 255),
    );
    overlay.active = false;
    return overlay;
  }

  private makePauseOverlay(): Node {
    const overlay = this.fullScreenOverlay('PauseOverlay', new Color(43, 28, 23, 225));
    this.sprite('PauseTray', 'orderTray', overlay, 26, 214, 338, 390, true);
    this.label(
      'PauseTitle',
      '研究暂停',
      overlay,
      92,
      270,
      206,
      48,
      28,
      new Color(104, 57, 37, 255),
    );
    const buttons = [
      ['ResumeResearch', '继续研究', 346],
      ['RestartFromPause', '重开本菜单', 420],
      ['ReturnFromPause', '返回研究入口', 494],
    ] as const;
    buttons.forEach(([name, text, y], index) => {
      const button = this.sprite(
        name,
        index === 0 ? 'continueButton' : 'nameplate',
        overlay,
        74,
        y,
        242,
        58,
        true,
      ).node;
      this.label(
        `${name}Text`,
        text,
        overlay,
        102,
        y + 14,
        186,
        30,
        17,
        new Color(106, 56, 37, 255),
      );
      button.addComponent(BlockInputEvents);
    });
    overlay.active = false;
    return overlay;
  }

  private fullScreenOverlay(name: string, color: Color): Node {
    const overlay = this.makeRoot(name, this.safeArea);
    overlay.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = color;
    dim.rect(-SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT);
    dim.fill();
    return overlay;
  }

  private publishPerformance(): void {
    if (this.frameTimes.length < 2) return;
    const sorted = [...this.frameTimes].sort((left, right) => left - right);
    const percentile = (ratio: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
    const averageFrameMs =
      this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length;
    const performanceSample = {
      sampledAt: new Date().toISOString(),
      sampleFrames: this.frameTimes.length,
      averageFps: 1000 / averageFrameMs,
      p50FrameMs: percentile(0.5),
      p95FrameMs: percentile(0.95),
      maxFrameMs: sorted[sorted.length - 1],
      longestFlightMs: this.longestFlightMs,
      peakActiveFlightNodes: this.peakActiveFlightNodes,
      menuId: this.session.menu.dailyMenuId,
      boardHash: this.session.viewModel().boardHash,
    };
    (globalThis as typeof globalThis & {
      __CP0R1B_PERF__?: Record<string, unknown>;
    }).__CP0R1B_PERF__ = performanceSample;
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.cp0r1bPerf =
        JSON.stringify(performanceSample);
    }
  }

  private makeRoot(name: string, parent: Node): Node {
    const root = new Node(name);
    root.layer = Layers.Enum.UI_2D;
    root.parent = parent;
    return root;
  }

  private sprite(
    name: string,
    frameOrKey: SpriteFrame | string,
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    trim = false,
  ): Sprite {
    const node = this.makeRoot(name, parent);
    node.addComponent(UITransform).setContentSize(width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = trim;
    sprite.spriteFrame = typeof frameOrKey === 'string'
      ? this.frame(frameOrKey)
      : frameOrKey;
    this.place(node, x, y, width, height);
    return sprite;
  }

  private label(
    name: string,
    text: string,
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    color = new Color(100, 71, 56, 255),
  ): Label {
    const node = this.makeRoot(name, parent);
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontFamily = 'PingFang SC';
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.18);
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    const outline = node.addComponent(LabelOutline);
    outline.color = new Color(255, 244, 212, 210);
    outline.width = fontSize >= 22 ? 2 : 1;
    this.place(node, x, y, width, height);
    return label;
  }

  private place(
    node: Node,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    node.setPosition(
      x + width / 2 - SCREEN_CENTER_X,
      SCREEN_HEIGHT / 2 - y - height / 2,
      0,
    );
  }
}
