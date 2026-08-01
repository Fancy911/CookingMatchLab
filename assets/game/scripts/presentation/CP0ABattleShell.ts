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
  | 'clueTray'
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
  | 'rarity'
  | 'star';

const ASSETS: Record<AssetKey, string> = {
  background: 'game/art/background/kitchen_bg_base/spriteFrame',
  boardFrame: 'game/art/ui/battle/board_frame/spriteFrame',
  tile: 'game/art/ui/battle/tile_normal/spriteFrame',
  pause: 'game/art/ui/battle/pause_button/spriteFrame',
  clueTray: 'game/art/ui/battle/order_tray/spriteFrame',
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
    this.sprite('PauseButton', 'pause', parent, 14, 46, 44, 44);

    this.roundedPanel(
      'KitchenTimer',
      parent,
      72,
      46,
      112,
      50,
      18,
      new Color(255, 239, 190, 255),
      new Color(128, 70, 43, 255),
      4,
    );
    this.label(
      'TimerCaption',
      '研究时间',
      parent,
      79,
      50,
      98,
      14,
      10,
      new Color(148, 89, 48, 255),
    );
    this.timerLabel = this.label(
      'TimerValue',
      '01:30',
      parent,
      77,
      61,
      102,
      31,
      25,
      new Color(105, 54, 37, 255),
    );

    this.roundedPanel(
      'ScoreBoard',
      parent,
      196,
      46,
      178,
      50,
      18,
      new Color(255, 224, 147, 255),
      new Color(128, 70, 43, 255),
      4,
    );
    this.label(
      'ScoreCaption',
      '研究分数',
      parent,
      204,
      50,
      63,
      14,
      10,
      new Color(148, 89, 48, 255),
    );
    this.scoreLabel = this.label(
      'ScoreValue',
      '0',
      parent,
      253,
      52,
      112,
      26,
      22,
      new Color(105, 54, 37, 255),
    );

    this.comboRoot = this.roundedPanel(
      'ComboBadge',
      parent,
      262,
      77,
      106,
      18,
      8,
      new Color(255, 158, 87, 255),
      new Color(120, 58, 38, 255),
      3,
    );
    this.label(
      'ComboValue',
      'COMBO ×1.5',
      this.comboRoot,
      0,
      0,
      106,
      18,
      11,
      new Color(255, 250, 218, 255),
      true,
    );
  }

  private buildClueTray(parent: Node): void {
    const clue = this.makeRoot('ResearchClueTray', parent);
    this.sprite('ClueTrayBody', 'clueTray', clue, 16, 104, 358, 66);
    this.label(
      'ClueTitle',
      '本轮研究线索',
      clue,
      30,
      119,
      98,
      30,
      15,
      new Color(112, 59, 39, 255),
    );
    this.buildClueGroup(clue, 'TomatoClue', 137, 'tomato', '2');
    this.buildClueGroup(clue, 'EggClue', 213, 'egg', '2');
    this.buildClueGroup(clue, 'ScallionClue', 289, 'scallion', '1');
  }

  private buildClueGroup(
    parent: Node,
    name: string,
    x: number,
    ingredient: R1AIngredientId,
    amount: string,
  ): void {
    const group = this.makeRoot(name, parent);
    this.sprite(`${name}Icon`, INGREDIENT_ASSET[ingredient], group, x, 119, 31, 31);
    this.label(
      `${name}Amount`,
      `×${amount}`,
      group,
      x + 31,
      120,
      32,
      30,
      17,
      new Color(108, 60, 40, 255),
    );
  }

  private buildBoard(parent: Node): void {
    const board = this.makeRoot('BoardRoot', parent);
    this.sprite('BoardFrame', 'boardFrame', board, 13, 178, 364, 364);
    const slots = this.makeRoot('BoardSlots', board);
    const ingredients = this.makeRoot('BoardIngredients', board);
    const cellSize = 44;
    const gap = 5;
    const gridSize = cellSize * 7 + gap * 6;
    const left = Math.round((SCREEN_WIDTH - gridSize) / 2);
    const top = 191;
    R1A_BOARD.forEach((row, rowIndex) => {
      row.forEach((ingredient, columnIndex) => {
        const x = left + columnIndex * (cellSize + gap);
        const y = top + rowIndex * (cellSize + gap);
        this.sprite(
          `BoardCell_${rowIndex}_${columnIndex}`,
          'tile',
          slots,
          x,
          y,
          cellSize,
          cellSize,
        );
        this.sprite(
          `BoardIngredient_${rowIndex}_${columnIndex}`,
          INGREDIENT_ASSET[ingredient],
          ingredients,
          x + 3,
          y + 3,
          38,
          38,
        );
      });
    });

    this.goodSticker = this.roundedPanel(
      'GoodSticker',
      board,
      139,
      196,
      112,
      42,
      18,
      new Color(255, 153, 76, 255),
      new Color(255, 244, 199, 255),
      4,
    );
    this.goodSticker.angle = -7;
    this.label(
      'GoodStickerText',
      'GOOD!',
      this.goodSticker,
      0,
      0,
      112,
      42,
      24,
      new Color(255, 252, 223, 255),
      true,
    );
  }

  private buildResearchPot(parent: Node): void {
    const pot = this.makeRoot('ResearchPot', parent);
    this.sprite('ResearchPotBack', 'pot', pot, 70, 527, 250, 180);
    this.potIngredientLayer = this.makeRoot('PotIngredientLayer', pot);
    this.sprite('ResearchPotFront', 'potFront', pot, 70, 579, 250, 128);
    this.label(
      'PotCaption',
      '研究锅',
      pot,
      154,
      657,
      82,
      24,
      14,
      new Color(105, 57, 40, 255),
    );
  }

  private buildSixSlotBoard(parent: Node): void {
    const board = this.roundedPanel(
      'SixSlotBoard',
      parent,
      14,
      700,
      260,
      110,
      18,
      new Color(255, 226, 158, 255),
      new Color(126, 70, 44, 255),
      4,
    );
    this.slotContentLayer = this.makeRoot('ThrowSlotContentLayer', parent);

    for (let index = 0; index < 6; index += 1) {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = 9 + column * 83;
      const y = 7 + row * 49;
      this.roundedPanel(
        `ThrowSlot${index + 1}`,
        board,
        x,
        y,
        76,
        45,
        15,
        new Color(201, 151, 92, 255),
        new Color(113, 65, 43, 255),
        3,
        true,
      );
    }
  }

  private buildFireButton(parent: Node): void {
    const root = this.makeRoot('FireButton', parent);
    this.fireSprite = this.sprite('FireButtonBody', 'fire', root, 286, 712, 88, 88);
    this.fireLabel = this.label(
      'FireButtonLabel',
      '待投料',
      root,
      294,
      744,
      72,
      28,
      15,
      new Color(255, 250, 222, 255),
    );
  }

  private buildQuickReveal(parent: Node): void {
    const overlay = this.makeRoot('QuickRevealOverlay', parent);
    overlay.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = new Color(62, 35, 29, 220);
    dim.rect(-SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT);
    dim.fill();

    this.sprite('RevealHalo', 'halo', overlay, 47, 155, 296, 296);
    this.sprite('RevealPedestal', 'pedestal', overlay, 70, 373, 250, 250);
    this.sprite('RevealDish', 'dish', overlay, 89, 209, 212, 212);
    this.sprite('RevealRarity', 'rarity', overlay, 135, 158, 120, 52);
    this.label(
      'RevealRarityLabel',
      '普通料理',
      overlay,
      143,
      168,
      104,
      28,
      16,
      new Color(111, 63, 40, 255),
    );
    this.label(
      'RevealDishName',
      '番茄炒蛋',
      overlay,
      93,
      411,
      204,
      45,
      26,
      new Color(255, 244, 204, 255),
    );
    for (let index = 0; index < 3; index += 1) {
      this.sprite(
        `RevealStar${index + 1}`,
        'star',
        overlay,
        124 + index * 48,
        458,
        46,
        46,
      );
    }
    this.roundedPanel(
      'RevealScoreRibbon',
      overlay,
      95,
      511,
      200,
      66,
      22,
      new Color(255, 169, 75, 255),
      new Color(111, 56, 38, 255),
      4,
    );
    this.label(
      'RevealScoreGain',
      '+1,100',
      overlay,
      104,
      516,
      182,
      36,
      26,
      new Color(255, 252, 225, 255),
    );
    this.label(
      'RevealRepeatStamp',
      '累计 ×2',
      overlay,
      121,
      550,
      148,
      24,
      15,
      new Color(112, 60, 40, 255),
    );
    this.roundedPanel(
      'NextResearchClue',
      overlay,
      48,
      605,
      294,
      60,
      19,
      new Color(255, 237, 188, 255),
      new Color(119, 66, 43, 255),
      4,
    );
    this.label(
      'NextResearchClueText',
      '下一条线索：尝试新的投料组合',
      overlay,
      62,
      615,
      266,
      39,
      17,
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
      { x: 111, y: 552, w: 78, h: 70, angle: -8 },
      { x: 158, y: 548, w: 78, h: 72, angle: 4 },
      { x: 205, y: 554, w: 74, h: 65, angle: 9 },
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
      const x = 24 + column * 83;
      const y = 708 + row * 49;
      this.sprite(
        `ThrowSlot${index + 1}Ingredient`,
        INGREDIENT_ASSET[slot.ingredientId],
        this.slotContentLayer,
        x,
        y,
        31,
        31,
      );
      this.label(
        `ThrowSlot${index + 1}Units`,
        '1份',
        this.slotContentLayer,
        x + 29,
        y + 8,
        35,
        22,
        13,
        new Color(255, 246, 209, 255),
      );
      const mark = this.makeRoot(
        `ThrowSlot${index + 1}ProcessingMark`,
        this.slotContentLayer,
      );
      mark.addComponent(UITransform).setContentSize(12, 12);
      this.place(mark, x + 54, y + 2, 12, 12);
      const graphics = mark.addComponent(Graphics);
      graphics.fillColor = new Color(255, 207, 88, 255);
      graphics.strokeColor = new Color(111, 63, 41, 255);
      graphics.lineWidth = 2;
      graphics.circle(0, 0, 5);
      graphics.fill();
      graphics.stroke();
    });
  }

  private renderFire(enabled: boolean): void {
    this.fireSprite.color = enabled
      ? Color.WHITE
      : new Color(151, 132, 117, 255);
    this.fireLabel.string = enabled ? '开火研究' : '待投料';
    this.fireLabel.color = enabled
      ? new Color(255, 250, 222, 255)
      : new Color(230, 217, 197, 255);
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
    const node = this.makeRoot(name, parent);
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

  private roundedPanel(
    name: string,
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: Color,
    stroke: Color,
    lineWidth: number,
    local = false,
  ): Node {
    const node = this.makeRoot(name, parent);
    node.addComponent(UITransform).setContentSize(width, height);
    if (local) {
      node.setPosition(
        x + width / 2 - 130,
        55 - y - height / 2,
        0,
      );
    } else {
      this.place(node, x, y, width, height);
    }
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.strokeColor = stroke;
    graphics.lineWidth = lineWidth;
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.fill();
    graphics.stroke();
    return node;
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
