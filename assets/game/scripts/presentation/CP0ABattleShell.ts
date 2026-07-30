import {
  _decorator,
  BlockInputEvents,
  Color,
  Component,
  Graphics,
  Label,
  LabelOutline,
  Layers,
  Node,
  ResolutionPolicy,
  resources,
  Sprite,
  SpriteFrame,
  sys,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
  view,
} from 'cc';
import { DiscoveryModel } from '../domain/cp0b/core';
import { PrototypeSession } from '../application/cp0c/PrototypeSession';
import type { FireResult, IngredientId, RecipeId } from '../domain/cp0b/types';
import { CocosJsonConfigLoader } from '../infrastructure/CocosJsonConfigLoader';
import { LocalSaveRepository } from '../infrastructure/LocalSaveRepository';
import { BattleBoardController } from './BattleBoardController';

const { ccclass } = _decorator;
const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;
const SCREEN_CENTER_X = SCREEN_WIDTH / 2;

type AssetKey =
  | 'background' | 'boardFrame' | 'tile' | 'pause' | 'steps' | 'orderTray'
  | 'orderDish' | 'throwTray' | 'fire' | 'pot' | 'potFront' | 'potLid'
  | 'potTomato' | 'potEgg' | 'tomato' | 'egg' | 'potato' | 'carrot'
  | 'mushroom' | 'dishTarget' | 'dishFallback' | 'pedestal' | 'nameplate'
  | 'rarity' | 'starOn' | 'starOff' | 'continueButton' | 'bookButton' | 'halo';

const ASSETS: Record<AssetKey, string> = {
  background: 'game/art/background/kitchen_bg_base/spriteFrame',
  boardFrame: 'game/art/ui/battle/board_frame/spriteFrame',
  tile: 'game/art/ui/battle/tile_normal/spriteFrame',
  pause: 'game/art/ui/battle/pause_button/spriteFrame',
  steps: 'game/art/ui/battle/step_badge/spriteFrame',
  orderTray: 'game/art/ui/battle/order_tray/spriteFrame',
  orderDish: 'game/art/dishes/dish_tomato_egg/spriteFrame',
  throwTray: 'game/art/ui/battle/throw_tray/spriteFrame',
  fire: 'game/art/ui/battle/fire_button/spriteFrame',
  pot: 'game/art/pot/research_pot/spriteFrame',
  potFront: 'game/art/pot/research_pot_front/spriteFrame',
  potLid: 'game/art/pot/pot_lid/spriteFrame',
  potTomato: 'game/art/pot/pot_tomato/spriteFrame',
  potEgg: 'game/art/pot/pot_egg/spriteFrame',
  tomato: 'game/art/ingredients/ingredient_tomato/spriteFrame',
  egg: 'game/art/ingredients/ingredient_egg/spriteFrame',
  potato: 'game/art/ingredients/ingredient_potato/spriteFrame',
  carrot: 'game/art/ingredients/ingredient_carrot/spriteFrame',
  mushroom: 'game/art/ingredients/ingredient_mushroom/spriteFrame',
  dishTarget: 'game/art/dishes/dish_tomato_egg/spriteFrame',
  dishFallback: 'game/art/dishes/dish_warm_hotpot_mix/spriteFrame',
  pedestal: 'game/art/ui/reveal/reveal_pedestal/spriteFrame',
  nameplate: 'game/art/ui/reveal/reveal_nameplate/spriteFrame',
  rarity: 'game/art/ui/reveal/rarity_normal/spriteFrame',
  starOn: 'game/art/ui/reveal/star_on/spriteFrame',
  starOff: 'game/art/ui/reveal/star_off/spriteFrame',
  continueButton: 'game/art/ui/reveal/continue_button/spriteFrame',
  bookButton: 'game/art/ui/reveal/book_button/spriteFrame',
  halo: 'game/art/ui/reveal/reveal_halo/spriteFrame',
};

const INGREDIENT_ASSET: Partial<Record<IngredientId, AssetKey>> = {
  ING_TOMATO: 'tomato',
  ING_EGG: 'egg',
  ING_POTATO: 'potato',
  ING_CARROT: 'carrot',
  ING_MUSHROOM: 'mushroom',
};

@ccclass('CP0ABattleShell')
export class CP0ABattleShell extends Component {
  private readonly frames = new Map<AssetKey, SpriteFrame>();
  private session!: PrototypeSession;
  private board!: BattleBoardController;
  private fxRoot!: Node;
  private potIngredientRoot!: Node;
  private potIndicatorRoot!: Node;
  private throwContentRoot!: Node;
  private actionRoot!: Node;
  private revealRoot!: Node;
  private cookingRoot!: Node;
  private pauseRoot!: Node;
  private fireSprite!: Sprite;
  private fireLabel!: Label;
  private stepLabel!: Label;
  private hintLabel!: Label;
  private saveRepository!: LocalSaveRepository;
  private visibleThrowCount = 0;

  protected onLoad(): void {
    view.setDesignResolutionSize(SCREEN_WIDTH, SCREEN_HEIGHT, ResolutionPolicy.FIXED_WIDTH);
  }

  protected start(): void {
    this.bootstrap().catch((error: unknown) => {
      console.error('[CP0-C-C1] bootstrap failed', error);
      this.showFatal(error instanceof Error ? error.message : String(error));
    });
  }

  protected onDestroy(): void {
    this.board?.destroy();
  }

  private async bootstrap(): Promise<void> {
    const [registry] = await Promise.all([
      new CocosJsonConfigLoader().load(),
      this.loadAll(),
    ]);
    this.saveRepository = new LocalSaveRepository(sys.localStorage);
    this.session = new PrototypeSession(
      registry,
      0x43503042,
      new DiscoveryModel(this.saveRepository.loadDiscoveryState()),
    );
    this.buildShell();
    this.board.render(this.session.snapshot().board);
    this.refreshRunUi();
    console.info(`[CP0-C-C1] runtime config hash ${registry.configHash}`);
  }

  private async loadAll(): Promise<void> {
    await Promise.all((Object.keys(ASSETS) as AssetKey[]).map(async (key) => {
      const frame = await new Promise<SpriteFrame>((resolve, reject) => {
        resources.load(ASSETS[key], SpriteFrame, (error, asset) => {
          if (error || !asset) {
            reject(error ?? new Error(`Missing ${ASSETS[key]}`));
          } else {
            resolve(asset);
          }
        });
      });
      this.frames.set(key, frame);
    }));
  }

  private makeRoot(name: string, parent: Node = this.node): Node {
    const root = new Node(name);
    root.layer = Layers.Enum.UI_2D;
    root.parent = parent;
    return root;
  }

  private sprite(
    name: string,
    frameOrKey: SpriteFrame | AssetKey,
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Sprite {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.parent = parent;
    node.addComponent(UITransform).setContentSize(width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    sprite.spriteFrame = typeof frameOrKey === 'string'
      ? this.frames.get(frameOrKey)!
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
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.parent = parent;
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontFamily = 'PingFang SC';
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.15);
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    const outline = node.addComponent(LabelOutline);
    outline.color = new Color(255, 241, 216, 235);
    outline.width = fontSize >= 24 ? 2 : 1;
    this.place(node, x, y, width, height);
    return label;
  }

  private place(node: Node, x: number, y: number, width: number, height: number): void {
    node.setPosition(
      x + width / 2 - SCREEN_CENTER_X,
      SCREEN_HEIGHT / 2 - y - height / 2,
      0,
    );
  }

  private buildShell(): void {
    const background = this.makeRoot('BackgroundRoot');
    this.sprite('KitchenBackground', 'background', background, 0, 0, 390, 844);
    const content = this.makeRoot('SafeContent');
    const hud = this.makeRoot('HudLayer', content);
    const order = this.makeRoot('OrderPanel', content);
    const boardArea = this.makeRoot('BoardArea', content);
    const potRoot = this.makeRoot('ResearchPot', content);
    this.actionRoot = this.makeRoot('ActionArea', content);
    this.fxRoot = this.makeRoot('FxLayer');

    const pause = this.sprite('PauseButton', 'pause', hud, 2, 34, 74, 63);
    pause.node.on(Node.EventType.TOUCH_END, () => this.openPause());
    this.sprite('StepBadge', 'steps', hud, 304, 31, 80, 80);
    this.stepLabel = this.label('StepValue', '7', hud, 319, 47, 50, 44, 30,
      new Color(255, 255, 242, 255));
    this.label('LabTitle', '料理研究 · 订单01', hud, 85, 49, 220, 34, 18);

    this.sprite('OrderTray', 'orderTray', order, 0, 70, 390, 120);
    this.sprite('OrderDish', 'orderDish', order, 24, 100, 64, 64);
    this.label('OrderTitle', '番茄炒蛋', order, 90, 118, 104, 28, 19);
    this.buildRequirement(order, 'TomatoRequirement', 198, 'tomato', '4–6');
    this.buildRequirement(order, 'EggRequirement', 280, 'egg', '3–5');

    this.sprite('BoardFrame', 'boardFrame', boardArea, -55, 110, 500, 480);
    const ingredientFrames = Object.fromEntries(
      (Object.keys(INGREDIENT_ASSET) as IngredientId[])
        .map((id) => [id, this.frames.get(INGREDIENT_ASSET[id]!)!]),
    ) as Partial<Record<IngredientId, SpriteFrame>>;
    this.board = new BattleBoardController(
      boardArea,
      this.fxRoot,
      this.frames.get('tile')!,
      ingredientFrames,
      (name, frame, parent, x, y, width, height) =>
        this.sprite(name, frame, parent, x, y, width, height),
    );
    this.board.onBegin = (coord) => this.session.beginLink(coord);
    this.board.onExtend = (coord) => this.session.extendLink(coord);
    this.board.onCommit = () => this.commitActiveLink();

    this.sprite('ResearchPotBack', 'pot', potRoot, 45, 525, 300, 224);
    this.potIngredientRoot = this.makeRoot('PotIngredients', potRoot);
    this.sprite('PotTomato', 'potTomato', this.potIngredientRoot, 105, 532, 96, 96);
    this.sprite('PotEgg', 'potEgg', this.potIngredientRoot, 187, 532, 96, 96);
    this.sprite('ResearchPotFrontRim', 'potFront', potRoot, 45, 593, 300, 156);
    this.potIndicatorRoot = this.makeRoot('PotReadyIndicators', potRoot);
    this.sprite('PotLamp1', 'starOn', this.potIndicatorRoot, 139, 638, 28, 28);
    this.sprite('PotLamp2', 'starOn', this.potIndicatorRoot, 221, 638, 28, 28);
    this.label('PotHint', '基础研究锅', potRoot, 108, 683, 174, 24, 15);

    this.sprite('ThrowTray', 'throwTray', this.actionRoot, 0, 660, 286, 210);
    this.throwContentRoot = this.makeRoot('ThrowContents', this.actionRoot);
    this.fireSprite = this.sprite('FireButton', 'fire', this.actionRoot, 272, 713, 118, 128);
    this.fireSprite.node.on(Node.EventType.TOUCH_END, () => this.fire());
    this.fireLabel = this.label('FireReady', '投入两份', this.actionRoot, 281, 800, 96, 24, 14,
      new Color(118, 67, 30, 255));
    this.hintLabel = this.label('LinkHint', '拖动连接 3 个以上相同食材', content,
      43, 704, 242, 22, 13);

    this.cookingRoot = this.buildCookingOverlay();
    this.revealRoot = this.makeFullscreenOverlay('RevealOverlay', new Color(44, 30, 24, 235));
    this.pauseRoot = this.buildPauseOverlay();
    this.cookingRoot.active = false;
    this.revealRoot.active = false;
    this.pauseRoot.active = false;
  }

  private buildRequirement(
    parent: Node,
    name: string,
    left: number,
    key: AssetKey,
    range: string,
  ): void {
    const group = this.makeRoot(name, parent);
    group.addComponent(UITransform).setContentSize(78, 42);
    this.place(group, left, 111, 78, 42);
    const icon = this.sprite(`${name}Icon`, key, group, 0, 0, 36, 36);
    icon.node.setPosition(-21, 0, 0);
    const need = this.label(`${name}Range`, range, group, 0, 0, 40, 28, 16);
    need.node.setPosition(18, 0, 0);
  }

  private commitActiveLink(): void {
    const result = this.session.commitLink();
    if (!result.accepted || !result.plan) {
      this.hintLabel.string = '至少连接 3 个相同食材';
      this.board.render(this.session.snapshot().board);
      this.refreshRunUi();
      return;
    }
    this.hintLabel.string = '食材正在投入研究锅…';
    this.stepLabel.string = String(result.plan.remainingSteps);
    const settlementStartedAt = performance.now();
    this.board.animate(
      result.plan,
      () => this.revealCommittedThrow(result.plan!),
      () => {
        this.session.completeAnimation(result.plan!.operationId);
        this.hintLabel.string = result.plan!.canFire
        ? '投料完成，可以开火'
        : '再投入一份食材即可开火';
        this.refreshRunUi();
        console.info(
          `[CP0-C-C1][settlement] pathLength=${result.plan!.path.length}`
          + ` durationMs=${(performance.now() - settlementStartedAt).toFixed(1)}`
          + ` phase=${this.session.phase}`,
        );
      },
    );
  }

  private refreshRunUi(): void {
    const snapshot = this.session.snapshot();
    this.stepLabel.string = String(snapshot.remainingSteps);
    this.visibleThrowCount = snapshot.pot.throws.length;
    this.refreshPotAndThrowUi(this.visibleThrowCount);
    this.board.setInputEnabled(
      (this.session.phase === 'READY' || this.session.phase === 'POT_REVIEW')
      && snapshot.pot.throws.length < this.session.registry.gameplay.pot.baseSlots,
    );
  }

  private refreshPotAndThrowUi(visibleThrowCount: number): void {
    const throws = this.session.snapshot().pot.throws.slice(0, visibleThrowCount);
    this.potIngredientRoot.children.forEach((child) => {
      child.active = child.name === 'PotTomato'
        ? throws.some((record) => record.ingredientId === 'ING_TOMATO')
        : throws.some((record) => record.ingredientId === 'ING_EGG');
    });
    this.potIndicatorRoot.children.forEach((child, index) => {
      child.active = index < throws.length;
    });
    this.rebuildThrowTray(throws);
    const canFire = throws.length >= this.session.registry.gameplay.pot.minimumThrowsToCook;
    this.fireSprite.color = canFire ? Color.WHITE : new Color(145, 154, 143, 205);
    this.fireLabel.string = canFire ? '可开火' : `${throws.length}/2 份`;
  }

  private revealCommittedThrow(plan: NonNullable<ReturnType<PrototypeSession['commitLink']>['plan']>): void {
    const potIngredientName = plan.ingredientId === 'ING_TOMATO' ? 'PotTomato' : 'PotEgg';
    const potIngredient = this.potIngredientRoot.getChildByName(potIngredientName);
    if (potIngredient) {
      potIngredient.active = true;
      potIngredient.setScale(0.72, 0.72, 1);
      tween(potIngredient)
        .to(0.18, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'backOut' })
        .to(0.12, { scale: new Vec3(1, 1, 1) })
        .start();
    }
    this.potIndicatorRoot.children.forEach((child, index) => {
      child.active = index <= plan.throwSlotIndex;
    });

    const timeline = new Node(`ThrowUiTimeline_${plan.operationId}`);
    timeline.parent = this.fxRoot;
    tween(timeline)
      .delay(0.08)
      .call(() => {
        this.visibleThrowCount = plan.throwSlotIndex + 1;
        this.rebuildThrowTray(
          this.session.snapshot().pot.throws.slice(0, this.visibleThrowCount),
        );
      })
      .delay(0.08)
      .call(() => {
        this.refreshPotAndThrowUi(this.visibleThrowCount);
        timeline.destroy();
      })
      .start();
  }

  private rebuildThrowTray(
    throws = this.session.snapshot().pot.throws.slice(0, this.visibleThrowCount),
  ): void {
    this.throwContentRoot.destroyAllChildren();
    const centers = [68, 143, 219];
    for (let index = 0; index < 3; index += 1) {
      const record = throws[index];
      if (!record) {
        this.label(`ThrowEmpty${index}`, '—', this.throwContentRoot,
          centers[index] - 26, 754, 52, 28, 16);
        continue;
      }
      this.sprite(
        `ThrowIngredient${index}`,
        INGREDIENT_ASSET[record.ingredientId]!,
        this.throwContentRoot,
        centers[index] - 26,
        729,
        52,
        52,
      );
      this.label(
        `ThrowCount${index}`,
        `${record.pathLength}格 / ${record.units}份`,
        this.throwContentRoot,
        centers[index] - 36,
        784,
        72,
        22,
        12,
      );
    }
  }

  private fire(): void {
    const result = this.session.fire();
    if (!result) {
      this.hintLabel.string = '需要至少两份投料';
      return;
    }
    this.board.setInputEnabled(false);
    this.actionRoot.active = false;
    this.cookingRoot.active = true;
    this.playCookingAnimation();
    const operationId = this.session.currentOperationId();
    tween(this.cookingRoot)
      .delay(1.68)
      .call(() => {
        if (this.session.completeCooking(operationId)) {
          this.cookingRoot.active = false;
          this.showReveal(result);
        }
      })
      .start();
  }

  private buildCookingOverlay(): Node {
    const root = this.makeFullscreenOverlay('CookingOverlay', new Color(42, 28, 20, 188));

    const glow = new Node('CookingGlow');
    glow.layer = Layers.Enum.UI_2D;
    glow.parent = root;
    glow.addComponent(UITransform).setContentSize(330, 330);
    this.place(glow, 30, 160, 330, 330);
    const glowGraphics = glow.addComponent(Graphics);
    glowGraphics.fillColor = new Color(255, 177, 77, 48);
    glowGraphics.circle(0, 0, 150);
    glowGraphics.fill();

    const flames = new Node('CookingFlames');
    flames.layer = Layers.Enum.UI_2D;
    flames.parent = root;
    flames.addComponent(UITransform).setContentSize(210, 94);
    flames.addComponent(UIOpacity).opacity = 230;
    this.place(flames, 90, 407, 210, 94);
    const flameGraphics = flames.addComponent(Graphics);
    flameGraphics.fillColor = new Color(255, 112, 38, 245);
    [-72, -36, 0, 36, 72].forEach((x, index) => {
      flameGraphics.moveTo(x - 24, 28);
      flameGraphics.quadraticCurveTo(x, -40 - (index % 2) * 12, x + 24, 28);
      flameGraphics.quadraticCurveTo(x, 12, x - 24, 28);
      flameGraphics.fill();
    });
    flameGraphics.fillColor = new Color(255, 218, 88, 255);
    [-54, -18, 18, 54].forEach((x) => {
      flameGraphics.circle(x, 16, 15);
      flameGraphics.fill();
    });

    const potRig = this.makeRoot('CookingPotRig', root);
    this.sprite('CookingPot', 'pot', potRig, 45, 262, 300, 224);
    const lid = this.sprite('CookingLid', 'potLid', potRig, 78, 216, 234, 154);
    lid.node.name = 'CookingLid';

    const steamRoot = this.makeRoot('CookingSteam', root);
    [128, 195, 262].forEach((x, index) => {
      const steam = new Node(`Steam_${index}`);
      steam.layer = Layers.Enum.UI_2D;
      steam.parent = steamRoot;
      steam.addComponent(UITransform).setContentSize(34, 76);
      steam.addComponent(UIOpacity).opacity = 0;
      this.place(steam, x - 17, 185 + (index % 2) * 12, 34, 76);
      const steamGraphics = steam.addComponent(Graphics);
      steamGraphics.lineWidth = 7;
      steamGraphics.lineCap = Graphics.LineCap.ROUND;
      steamGraphics.strokeColor = new Color(255, 244, 219, 215);
      steamGraphics.moveTo(-8, 28);
      steamGraphics.bezierCurveTo(15, 9, -16, -10, 8, -29);
      steamGraphics.stroke();
    });

    this.label('CookingTitle', '料理研究中…', root, 75, 485, 240, 48, 27,
      new Color(255, 245, 217, 255));
    this.label('CookingSub', '火候与配比正在融合', root, 84, 535, 222, 30, 16,
      new Color(255, 225, 178, 255));

    const flash = new Node('CookingCompleteFlash');
    flash.layer = Layers.Enum.UI_2D;
    flash.parent = root;
    flash.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    flash.addComponent(UIOpacity).opacity = 0;
    const flashGraphics = flash.addComponent(Graphics);
    flashGraphics.fillColor = new Color(255, 205, 112, 235);
    flashGraphics.rect(-SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT);
    flashGraphics.fill();
    return root;
  }

  private playCookingAnimation(): void {
    const potRig = this.cookingRoot.getChildByName('CookingPotRig');
    const lid = potRig?.getChildByName('CookingLid');
    const flames = this.cookingRoot.getChildByName('CookingFlames');
    const steamRoot = this.cookingRoot.getChildByName('CookingSteam');
    const flash = this.cookingRoot.getChildByName('CookingCompleteFlash');

    if (potRig) {
      potRig.angle = 0;
      tween(potRig)
        .repeat(5, tween().to(0.12, { angle: 1.5 }).to(0.12, { angle: -1.5 }))
        .to(0.12, { angle: 0 })
        .start();
    }
    if (lid) {
      const base = lid.position.clone();
      lid.setScale(0.94, 0.94, 1);
      tween(lid)
        .repeat(
          4,
          tween()
            .to(0.16, {
              angle: 5,
              position: new Vec3(base.x - 3, base.y + 7, 0),
            })
            .to(0.16, {
              angle: -5,
              position: new Vec3(base.x + 3, base.y + 3, 0),
            }),
        )
        .to(0.18, { angle: 0, position: base, scale: new Vec3(1, 1, 1) })
        .start();
    }
    if (flames) {
      flames.setScale(1, 0.86, 1);
      tween(flames)
        .repeat(
          6,
          tween()
            .to(0.1, { scale: new Vec3(1.04, 1.12, 1) })
            .to(0.1, { scale: new Vec3(0.98, 0.9, 1) }),
        )
        .to(0.12, { scale: new Vec3(1, 1, 1) })
        .start();
    }
    steamRoot?.children.forEach((steam, index) => {
      const base = steam.position.clone();
      const opacity = steam.getComponent(UIOpacity)!;
      opacity.opacity = 0;
      steam.setScale(0.82, 0.82, 1);
      tween(steam)
        .delay(0.12 + index * 0.14)
        .call(() => {
          opacity.opacity = 205;
        })
        .to(0.82, {
          position: new Vec3(base.x + (index - 1) * 9, base.y + 86, 0),
          scale: new Vec3(1.25, 1.25, 1),
        }, { easing: 'quadOut' })
        .call(() => {
          opacity.opacity = 0;
          steam.setPosition(base);
        })
        .start();
    });
    if (flash) {
      const opacity = flash.getComponent(UIOpacity)!;
      opacity.opacity = 0;
      tween(opacity)
        .delay(1.2)
        .to(0.14, { opacity: 205 })
        .to(0.28, { opacity: 0 })
        .start();
    }
  }

  private showReveal(result: FireResult): void {
    this.saveRepository.saveDiscovery(this.session.snapshot().discovery);
    this.revealRoot.removeAllChildren();
    this.fillFullscreenDim(this.revealRoot, new Color(44, 30, 24, 245));
    const isTarget = result.recipeId === 'RCP_TOMATO_EGG';
    this.sprite('RevealHalo', 'halo', this.revealRoot, 45, 126, 300, 300);
    this.sprite('NormalRarityBadge', 'rarity', this.revealRoot, 137, 54, 116, 116);
    this.label('RarityLabel', '普通料理', this.revealRoot, 126, 154, 138, 28, 18,
      new Color(255, 247, 226, 255));
    this.label(
      'DiscoveryStatus',
      result.isNewDiscovery ? '首次发现' : '再次完成',
      this.revealRoot,
      124,
      177,
      142,
      25,
      15,
      result.isNewDiscovery
        ? new Color(255, 222, 126, 255)
        : new Color(230, 221, 205, 255),
    );
    this.sprite('RevealPedestal', 'pedestal', this.revealRoot, 18, 332, 354, 354);
    this.sprite('RevealDish', isTarget ? 'dishTarget' : 'dishFallback',
      this.revealRoot, 27, 184, 336, 336);
    this.sprite('RevealNameplate', 'nameplate', this.revealRoot, 25, 503, 340, 168);
    this.label('DishName', this.recipeName(result.recipeId), this.revealRoot,
      71, 554, 248, 42, 28);
    for (let index = 0; index < 3; index += 1) {
      this.sprite(`Star${index + 1}`, index < result.stars ? 'starOn' : 'starOff',
        this.revealRoot, 81 + index * 76, 603, 76, 76);
    }
    const units = this.session.snapshot().pot.units;
    this.label('ResultReason',
      `番茄 ${units.ING_TOMATO ?? 0} · 鸡蛋 ${units.ING_EGG ?? 0}`,
      this.revealRoot, 74, 682, 242, 30, 17, new Color(255, 241, 216, 255));
    this.sprite('BookButton', 'bookButton', this.revealRoot, 16, 716, 142, 128);
    const continueButton = this.sprite(
      'ContinueButton',
      'continueButton',
      this.revealRoot,
      128,
      716,
      246,
      128,
    );
    this.label('ContinueText',
      result.orderResult === 'CONTINUE_AFTER_REVEAL' ? '继续研究' : '订单完成',
      this.revealRoot, 186, 763, 130, 32, 19,
      new Color(108, 58, 29, 255));
    if (result.orderResult === 'CONTINUE_AFTER_REVEAL') {
      continueButton.node.on(Node.EventType.TOUCH_END, () => this.continueAfterFallback());
    }
    this.revealRoot.active = true;
  }

  private continueAfterFallback(): void {
    this.session.continueAfterReveal();
    this.revealRoot.active = false;
    this.actionRoot.active = true;
    this.hintLabel.string = '锅已清空，继续完成番茄炒蛋';
    this.board.render(this.session.snapshot().board);
    this.refreshRunUi();
  }

  private recipeName(recipeId: RecipeId): string {
    return this.session.registry.recipeById.get(recipeId)?.name ?? recipeId;
  }

  private openPause(): void {
    if (!this.session.pause()) {
      return;
    }
    this.board.cancelActivePath();
    this.board.setInputEnabled(false);
    this.pauseRoot.active = true;
  }

  private buildPauseOverlay(): Node {
    const root = this.makeFullscreenOverlay('PauseOverlay', new Color(42, 29, 23, 225));
    this.label('PauseTitle', '研究暂停', root, 95, 250, 200, 55, 30,
      new Color(255, 245, 218, 255));
    const resume = this.panelButton(root, '继续', 78, 360);
    const restart = this.panelButton(root, '重新开始', 78, 445);
    resume.on(Node.EventType.TOUCH_END, () => {
      if (this.session.resume()) {
        root.active = false;
        this.refreshRunUi();
      }
    });
    restart.on(Node.EventType.TOUCH_END, () => {
      this.session.restart();
      root.active = false;
      this.revealRoot.active = false;
      this.cookingRoot.active = false;
      this.actionRoot.active = true;
      this.board.render(this.session.snapshot().board);
      this.hintLabel.string = '拖动连接 3 个以上相同食材';
      this.refreshRunUi();
    });
    return root;
  }

  private panelButton(parent: Node, text: string, x: number, y: number): Node {
    const node = new Node(`${text}Button`);
    node.layer = Layers.Enum.UI_2D;
    node.parent = parent;
    node.addComponent(UITransform).setContentSize(234, 64);
    this.place(node, x, y, 234, 64);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(255, 225, 172, 255);
    graphics.roundRect(-117, -32, 234, 64, 26);
    graphics.fill();
    const label = this.label(`${text}Label`, text, node, 0, 0, 180, 42, 21);
    label.node.setPosition(0, 0, 0);
    return node;
  }

  private makeFullscreenOverlay(name: string, color: Color): Node {
    const root = this.makeRoot(name);
    root.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    root.addComponent(BlockInputEvents);
    this.fillFullscreenDim(root, color);
    return root;
  }

  private fillFullscreenDim(root: Node, color: Color): void {
    const dim = new Node(`${root.name}Dim`);
    dim.layer = Layers.Enum.UI_2D;
    dim.parent = root;
    dim.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    const graphics = dim.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.rect(-SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT);
    graphics.fill();
  }

  private showFatal(message: string): void {
    const root = this.makeFullscreenOverlay('FatalOverlay', new Color(50, 28, 28, 255));
    this.label('FatalTitle', '配置加载失败', root, 70, 300, 250, 50, 26,
      new Color(255, 235, 220, 255));
    this.label('FatalMessage', message, root, 35, 360, 320, 130, 15,
      new Color(255, 220, 210, 255));
  }
}
