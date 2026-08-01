import {
  _decorator,
  BlockInputEvents,
  Color,
  Component,
  EventKeyboard,
  Graphics,
  Input,
  input,
  KeyCode,
  Label,
  LabelOutline,
  Layers,
  Node,
  ResolutionPolicy,
  resources,
  Sprite,
  SpriteFrame,
  UITransform,
  view,
} from 'cc';
import { CocosJsonConfigLoader } from '../infrastructure/CocosJsonConfigLoader';
import {
  R1A_BOARD,
  R1A_QUERY_STATE,
  R1A_VIEW_MODELS,
  type R1AIngredientId,
  type R1AStateId,
  type R1AViewModel,
} from './R1AStaticViewModels';

const { ccclass } = _decorator;
const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;
const SCREEN_CENTER_X = SCREEN_WIDTH / 2;

type AssetKey =
  | 'background'
  | 'boardFrame'
  | 'tile'
  | 'pause'
  | 'hudShell'
  | 'clueTray'
  | 'throwTraySix'
  | 'pot'
  | 'potFront'
  | 'potTomato'
  | 'potEgg'
  | 'potScallion'
  | 'fire'
  | 'tomato'
  | 'egg'
  | 'potato'
  | 'carrot'
  | 'mushroom'
  | 'scallion'
  | 'dish'
  | 'pedestal'
  | 'halo'
  | 'nameplate'
  | 'rarity'
  | 'star';

const ASSETS: Record<AssetKey, string> = {
  background: 'game/art/background/kitchen_bg_base/spriteFrame',
  boardFrame: 'game/art/ui/battle/board_frame/spriteFrame',
  tile: 'game/art/ui/battle/tile_normal/spriteFrame',
  pause: 'game/art/ui/battle/pause_button/spriteFrame',
  hudShell: 'game/art/ui/battle/step_badge/spriteFrame',
  clueTray: 'game/art/ui/battle/order_tray/spriteFrame',
  throwTraySix: 'game/art/ui/battle/throw_tray_six/spriteFrame',
  pot: 'game/art/pot/research_pot/spriteFrame',
  potFront: 'game/art/pot/research_pot_front/spriteFrame',
  potTomato: 'game/art/pot/pot_tomato/spriteFrame',
  potEgg: 'game/art/pot/pot_egg/spriteFrame',
  potScallion: 'game/art/pot/pot_scallion/spriteFrame',
  fire: 'game/art/ui/battle/fire_button/spriteFrame',
  tomato: 'game/art/ingredients/ingredient_tomato/spriteFrame',
  egg: 'game/art/ingredients/ingredient_egg/spriteFrame',
  potato: 'game/art/ingredients/ingredient_potato/spriteFrame',
  carrot: 'game/art/ingredients/ingredient_carrot/spriteFrame',
  mushroom: 'game/art/ingredients/ingredient_mushroom/spriteFrame',
  scallion: 'game/art/ingredients/ingredient_scallion/spriteFrame',
  dish: 'game/art/dishes/dish_tomato_egg/spriteFrame',
  pedestal: 'game/art/ui/reveal/reveal_pedestal/spriteFrame',
  halo: 'game/art/ui/reveal/reveal_halo/spriteFrame',
  nameplate: 'game/art/ui/reveal/reveal_nameplate/spriteFrame',
  rarity: 'game/art/ui/reveal/rarity_normal/spriteFrame',
  star: 'game/art/ui/reveal/star_on/spriteFrame',
};

const INGREDIENT_ASSET: Record<R1AIngredientId, AssetKey> = {
  tomato: 'tomato',
  egg: 'egg',
  potato: 'potato',
  carrot: 'carrot',
  mushroom: 'mushroom',
  scallion: 'scallion',
};

const POT_ASSET: Partial<Record<R1AIngredientId, AssetKey>> = {
  tomato: 'potTomato',
  egg: 'potEgg',
  scallion: 'potScallion',
};

@ccclass('CP0ABattleShell')
export class CP0ABattleShell extends Component {
  private readonly frames = new Map<AssetKey, SpriteFrame>();
  private state: R1AStateId = 'READY';
  private timerLabel!: Label;
  private scoreLabel!: Label;
  private comboRoot!: Node;
  private goodSticker!: Node;
  private potIngredientLayer!: Node;
  private slotContentLayer!: Node;
  private fireSprite!: Sprite;
  private fireLabel!: Label;
  private quickRevealOverlay!: Node;

  protected onLoad(): void {
    view.setDesignResolutionSize(
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      ResolutionPolicy.FIXED_WIDTH,
    );
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  protected start(): void {
    this.bootstrap().catch((error: unknown) => {
      console.error('[CP0-R1-A] visual shell bootstrap failed', error);
      this.showFatal(error instanceof Error ? error.message : String(error));
    });
  }

  protected onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  private async bootstrap(): Promise<void> {
    const [registry] = await Promise.all([
      new CocosJsonConfigLoader().load(),
      this.loadAll(),
    ]);
    if (registry.configHash !== 'a35691f9') {
      throw new Error(`Unexpected canonical config hash: ${registry.configHash}`);
    }
    this.buildVisualShell();
    this.state = this.readInitialState();
    this.renderState(this.state);
    console.info(
      `[CP0-R1-A] static visual state ${this.state}; canonical config ${registry.configHash}`,
    );
  }

  private async loadAll(): Promise<void> {
    await Promise.all((Object.keys(ASSETS) as AssetKey[]).map(async (key) => {
      const frame = await new Promise<SpriteFrame>((resolve, reject) => {
        resources.load(ASSETS[key], SpriteFrame, (error, asset) => {
          if (error || !asset) {
            reject(error ?? new Error(`Missing asset ${ASSETS[key]}`));
            return;
          }
          resolve(asset);
        });
      });
      this.frames.set(key, frame);
    }));
  }

  private readInitialState(): R1AStateId {
    if (typeof globalThis.location === 'undefined') {
      return 'READY';
    }
    const requested = new URLSearchParams(globalThis.location.search)
      .get('state')
      ?.toLowerCase();
    return requested ? R1A_QUERY_STATE[requested] ?? 'READY' : 'READY';
  }

  private onKeyDown(event: EventKeyboard): void {
    if (event.keyCode === KeyCode.DIGIT_1) {
      this.renderState('READY');
    } else if (event.keyCode === KeyCode.DIGIT_2) {
      this.renderState('POT_REVIEW');
    } else if (event.keyCode === KeyCode.DIGIT_3) {
      this.renderState('QUICK_REVEAL_REPEAT');
    }
  }

  private buildVisualShell(): void {
    const root = this.makeRoot('R1AVisualShell');
    const safeArea = this.makeRoot('SafeAreaRoot', root);
    safeArea.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);

    this.sprite('KitchenBackground', 'background', safeArea, 0, 0, 390, 844);
    this.buildTopHud(safeArea);
    this.buildClueTray(safeArea);
    this.buildBoard(safeArea);
    this.buildResearchPot(safeArea);
    this.buildSixSlotBoard(safeArea);
    this.buildFireButton(safeArea);
    this.buildQuickReveal(safeArea);
  }

  private buildTopHud(parent: Node): void {
    this.sprite('PauseButton', 'pause', parent, 7, 37, 60, 60);
    this.sprite(
      'KitchenTimer',
      'hudShell',
      parent,
      68,
      35,
      122,
      64,
      true,
    );
    this.label(
      'TimerCaption',
      '研究时间',
      parent,
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
      parent,
      76,
      55,
      106,
      34,
      27,
      new Color(255, 251, 224, 255),
    );
    this.sprite(
      'ScoreBoard',
      'nameplate',
      parent,
      190,
      36,
      190,
      62,
      true,
    );
    this.label(
      'ScoreCaption',
      '研究分数',
      parent,
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
      parent,
      251,
      49,
      112,
      34,
      27,
      new Color(104, 53, 36, 255),
    );

    this.comboRoot = this.makeRoot('ComboBadge', parent);
    this.sprite(
      'ComboBadgeShell',
      'hudShell',
      this.comboRoot,
      255,
      78,
      114,
      27,
      true,
    );
    this.label(
      'ComboBadge',
      'COMBO ×1.5',
      this.comboRoot,
      262,
      80,
      100,
      22,
      12,
      new Color(255, 249, 218, 255),
    );
  }

  private buildClueTray(parent: Node): void {
    const clue = this.makeRoot('ResearchClueTray', parent);
    this.sprite('ClueTrayBody', 'clueTray', clue, 0, 76, 390, 120);
    this.label(
      'ClueTitle',
      '研究线索',
      clue,
      34,
      118,
      92,
      31,
      16,
      new Color(112, 59, 39, 255),
    );
    this.buildClueGroup(clue, 'TomatoClue', 132, 'tomato', '2');
    this.buildClueGroup(clue, 'EggClue', 210, 'egg', '2');
    this.buildClueGroup(clue, 'ScallionClue', 288, 'scallion', '1');
  }

  private buildClueGroup(
    parent: Node,
    name: string,
    x: number,
    ingredient: R1AIngredientId,
    amount: string,
  ): void {
    const group = this.makeRoot(name, parent);
    this.sprite(`${name}Icon`, INGREDIENT_ASSET[ingredient], group, x, 115, 38, 38);
    this.label(
      `${name}Amount`,
      `×${amount}`,
      group,
      x + 36,
      119,
      36,
      30,
      18,
      new Color(108, 60, 40, 255),
    );
  }

  private buildBoard(parent: Node): void {
    const board = this.makeRoot('BoardRoot', parent);
    this.sprite('BoardFrame', 'boardFrame', board, -55, 110, 500, 480);
    const slots = this.makeRoot('BoardSlots', board);
    const ingredients = this.makeRoot('BoardIngredients', board);
    const slotSize = 70;
    const iconSize = 52;
    const step = 49;
    const left = 13;
    const top = 181;
    R1A_BOARD.forEach((row, rowIndex) => {
      row.forEach((ingredient, columnIndex) => {
        const x = left + columnIndex * step;
        const y = top + rowIndex * step;
        this.sprite(
          `BoardCell_${rowIndex}_${columnIndex}`,
          'tile',
          slots,
          x,
          y,
          slotSize,
          slotSize,
        );
        this.sprite(
          `BoardIngredient_${rowIndex}_${columnIndex}`,
          INGREDIENT_ASSET[ingredient],
          ingredients,
          x + (slotSize - iconSize) / 2,
          y + (slotSize - iconSize) / 2,
          iconSize,
          iconSize,
        );
      });
    });

    this.goodSticker = this.makeRoot('GoodSticker', board);
    this.sprite(
      'GoodStickerShell',
      'hudShell',
      this.goodSticker,
      130,
      185,
      130,
      48,
      true,
    );
    this.label(
      'GoodStickerText',
      'GOOD!',
      this.goodSticker,
      139,
      192,
      112,
      33,
      25,
      new Color(255, 251, 218, 255),
    );
    this.goodSticker.angle = -7;
  }

  private buildResearchPot(parent: Node): void {
    const pot = this.makeRoot('ResearchPot', parent);
    this.sprite('ResearchPotBack', 'pot', pot, 45, 525, 300, 224);
    this.potIngredientLayer = this.makeRoot('PotIngredientLayer', pot);
    this.sprite('ResearchPotFront', 'potFront', pot, 45, 593, 300, 156);
    this.label(
      'PotCaption',
      '基础研究锅',
      pot,
      108,
      665,
      174,
      24,
      15,
      new Color(105, 57, 40, 255),
    );
  }

  private buildSixSlotBoard(parent: Node): void {
    this.sprite(
      'SixSlotBoard',
      'throwTraySix',
      parent,
      6,
      695,
      274,
      122,
      true,
    );
    this.slotContentLayer = this.makeRoot('ThrowSlotContentLayer', parent);

    for (let index = 0; index < 6; index += 1) {
      this.makeRoot(`ThrowSlot${index + 1}`, parent);
    }
  }

  private buildFireButton(parent: Node): void {
    const root = this.makeRoot('FireButton', parent);
    this.fireSprite = this.sprite('FireButtonBody', 'fire', root, 272, 703, 118, 130);
    this.fireLabel = this.label(
      'FireButtonLabel',
      '开火研究',
      root,
      283,
      791,
      96,
      26,
      15,
      new Color(114, 61, 34, 255),
    );
  }

  private buildQuickReveal(parent: Node): void {
    const overlay = this.makeRoot('QuickRevealOverlay', parent);
    overlay.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = new Color(43, 28, 23, 246);
    dim.rect(-SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT);
    dim.fill();

    this.sprite('RevealHalo', 'halo', overlay, 42, 130, 306, 306);
    this.sprite('RevealRarity', 'rarity', overlay, 137, 48, 116, 116);
    this.label(
      'RevealRarityLabel',
      '普通料理',
      overlay,
      126,
      145,
      138,
      28,
      18,
      new Color(255, 247, 226, 255),
    );
    this.label(
      'RevealRepeatStatus',
      '再次完成',
      overlay,
      124,
      171,
      142,
      25,
      15,
      new Color(238, 222, 199, 255),
    );
    this.sprite('RevealPedestal', 'pedestal', overlay, 18, 333, 354, 354);
    this.sprite('RevealDish', 'dish', overlay, 27, 184, 336, 336);
    this.sprite('RevealNameplate', 'nameplate', overlay, 25, 503, 340, 168);
    this.label(
      'RevealDishName',
      '番茄炒蛋',
      overlay,
      71,
      554,
      248,
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
    this.sprite(
      'RevealScoreRibbon',
      'nameplate',
      overlay,
      56,
      682,
      278,
      58,
      true,
    );
    this.label(
      'RevealScoreGain',
      '+1,100',
      overlay,
      77,
      691,
      132,
      34,
      25,
      new Color(106, 56, 37, 255),
    );
    this.label(
      'RevealRepeatStamp',
      '累计 ×2',
      overlay,
      205,
      695,
      104,
      28,
      16,
      new Color(132, 77, 45, 255),
    );
    this.sprite(
      'NextResearchClue',
      'nameplate',
      overlay,
      69,
      746,
      252,
      48,
      true,
    );
    this.label(
      'NextResearchClueText',
      '下一条线索：尝试新的投料组合',
      overlay,
      82,
      756,
      226,
      27,
      14,
      new Color(111, 61, 41, 255),
    );
    this.quickRevealOverlay = overlay;
  }

  private renderState(state: R1AStateId): void {
    this.state = state;
    const model = R1A_VIEW_MODELS[state];
    this.timerLabel.string = model.timer;
    this.scoreLabel.string = model.score;
    this.comboRoot.active = Boolean(model.combo);
    this.goodSticker.active = model.goodSticker;
    this.renderPot(model);
    this.renderSlots(model);
    this.renderFire(model.fireEnabled);
    this.quickRevealOverlay.active = model.quickReveal;
    console.info(`[CP0-R1-A] switched to ${state}`);
  }

  private renderPot(model: R1AViewModel): void {
    this.potIngredientLayer.removeAllChildren();
    const placements = [
      { x: 92, y: 527, w: 108, h: 104, angle: -7 },
      { x: 143, y: 526, w: 106, h: 104, angle: 4 },
      { x: 203, y: 536, w: 92, h: 88, angle: 9 },
    ];
    model.potIngredients.forEach((ingredient, index) => {
      const asset = POT_ASSET[ingredient];
      if (!asset) return;
      const placement = placements[index];
      const sprite = this.sprite(
        `PotIngredient_${ingredient}`,
        asset,
        this.potIngredientLayer,
        placement.x,
        placement.y,
        placement.w,
        placement.h,
      );
      sprite.node.angle = placement.angle;
    });
  }

  private renderSlots(model: R1AViewModel): void {
    this.slotContentLayer.removeAllChildren();
    model.slots.forEach((slot, index) => {
      if (!slot.ingredientId || !slot.units) return;
      const column = index % 3;
      const row = Math.floor(index / 3);
      const centerX = 55 + column * 88;
      const centerY = 728 + row * 51;
      this.sprite(
        `ThrowSlot${index + 1}Ingredient`,
        INGREDIENT_ASSET[slot.ingredientId],
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
      this.sprite(
        `ThrowSlot${index + 1}ProcessingMark`,
        'star',
        this.slotContentLayer,
        centerX + 19,
        centerY - 21,
        15,
        15,
      );
    });
  }

  private renderFire(enabled: boolean): void {
    this.fireSprite.color = enabled
      ? Color.WHITE
      : new Color(151, 155, 139, 225);
    this.fireLabel.string = '开火研究';
    this.fireLabel.color = enabled
      ? new Color(112, 58, 30, 255)
      : new Color(135, 115, 94, 255);
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
    trim = false,
  ): Sprite {
    const node = this.makeRoot(name, parent);
    node.addComponent(UITransform).setContentSize(width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = trim;
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
    local = false,
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
    if (local) {
      node.setPosition(x, y, 0);
    } else {
      this.place(node, x, y, width, height);
    }
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

  private showFatal(message: string): void {
    const root = this.makeRoot('R1AConfigFailure');
    root.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    const background = root.addComponent(Graphics);
    background.fillColor = new Color(63, 34, 31, 255);
    background.rect(-195, -422, 390, 844);
    background.fill();
    this.label(
      'FatalTitle',
      'R1-A 配置加载失败',
      root,
      30,
      330,
      330,
      54,
      26,
      new Color(255, 239, 213, 255),
    );
    this.label(
      'FatalMessage',
      message,
      root,
      30,
      390,
      330,
      120,
      15,
      new Color(255, 221, 203, 255),
    );
  }
}
