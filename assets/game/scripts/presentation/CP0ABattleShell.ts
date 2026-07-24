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

const { ccclass } = _decorator;

const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;
const SCREEN_CENTER_X = SCREEN_WIDTH / 2;

type AssetKey =
  | 'background'
  | 'boardFrame'
  | 'tile'
  | 'pause'
  | 'steps'
  | 'orderTray'
  | 'orderDish'
  | 'throwTray'
  | 'fire'
  | 'pot'
  | 'potFront'
  | 'potTomato'
  | 'potEgg'
  | 'tomato'
  | 'egg'
  | 'potato'
  | 'carrot'
  | 'mushroom'
  | 'dish'
  | 'pedestal'
  | 'nameplate'
  | 'rarity'
  | 'starOn'
  | 'starOff'
  | 'continueButton'
  | 'bookButton'
  | 'halo';

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
  potTomato: 'game/art/pot/pot_tomato/spriteFrame',
  potEgg: 'game/art/pot/pot_egg/spriteFrame',
  tomato: 'game/art/ingredients/ingredient_tomato/spriteFrame',
  egg: 'game/art/ingredients/ingredient_egg/spriteFrame',
  potato: 'game/art/ingredients/ingredient_potato/spriteFrame',
  carrot: 'game/art/ingredients/ingredient_carrot/spriteFrame',
  mushroom: 'game/art/ingredients/ingredient_mushroom/spriteFrame',
  dish: 'game/art/dishes/dish_tomato_egg/spriteFrame',
  pedestal: 'game/art/ui/reveal/reveal_pedestal/spriteFrame',
  nameplate: 'game/art/ui/reveal/reveal_nameplate/spriteFrame',
  rarity: 'game/art/ui/reveal/rarity_normal/spriteFrame',
  starOn: 'game/art/ui/reveal/star_on/spriteFrame',
  starOff: 'game/art/ui/reveal/star_off/spriteFrame',
  continueButton: 'game/art/ui/reveal/continue_button/spriteFrame',
  bookButton: 'game/art/ui/reveal/book_button/spriteFrame',
  halo: 'game/art/ui/reveal/reveal_halo/spriteFrame',
};

const O1_BOARD = [
  ['T', 'T', 'P', 'C', 'E', 'M', 'P'],
  ['C', 'T', 'T', 'E', 'P', 'M', 'C'],
  ['P', 'E', 'T', 'C', 'M', 'P', 'E'],
  ['E', 'P', 'C', 'E', 'M', 'C', 'P'],
  ['M', 'C', 'P', 'T', 'E', 'M', 'C'],
  ['C', 'M', 'E', 'P', 'C', 'E', 'M'],
  ['P', 'C', 'M', 'E', 'E', 'E', 'E'],
];

@ccclass('CP0ABattleShell')
export class CP0ABattleShell extends Component {
  private frames = new Map<AssetKey, SpriteFrame>();
  private battleRoot!: Node;
  private potRoot!: Node;
  private actionRoot!: Node;
  private potIngredientRoot!: Node;
  private potIndicatorRoot!: Node;
  private throwContentRoot!: Node;
  private revealRoot!: Node;
  private fireSprite!: Sprite;
  private readyLabel!: Label;
  private state = 1;

  protected onLoad(): void {
    view.setDesignResolutionSize(390, 844, ResolutionPolicy.FIXED_WIDTH);
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  protected onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  protected start(): void {
    this.loadAll().then(() => {
      this.buildShell();
      this.applyState(this.readInitialState());
    });
  }

  private readInitialState(): number {
    if (typeof window === 'undefined') return 1;
    const value = new URLSearchParams(window.location.search).get('state');
    const parsed = Number(value);
    return parsed >= 1 && parsed <= 3 ? parsed : 1;
  }

  private onKeyDown(event: EventKeyboard): void {
    if (event.keyCode === KeyCode.DIGIT_1 || event.keyCode === KeyCode.NUM_1) this.applyState(1);
    if (event.keyCode === KeyCode.DIGIT_2 || event.keyCode === KeyCode.NUM_2) this.applyState(2);
    if (event.keyCode === KeyCode.DIGIT_3 || event.keyCode === KeyCode.NUM_3) this.applyState(3);
  }

  private async loadAll(): Promise<void> {
    await Promise.all(
      (Object.keys(ASSETS) as AssetKey[]).map(async (key) => {
        const frame = await new Promise<SpriteFrame>((resolve, reject) => {
          resources.load(ASSETS[key], SpriteFrame, (error, asset) => {
            if (error || !asset) reject(error ?? new Error(`Missing ${ASSETS[key]}`));
            else resolve(asset);
          });
        });
        this.frames.set(key, frame);
      }),
    );
  }

  private makeRoot(name: string, parent: Node = this.node): Node {
    const root = new Node(name);
    root.layer = Layers.Enum.UI_2D;
    root.parent = parent;
    return root;
  }

  private sprite(
    name: string,
    key: AssetKey,
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Sprite {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.parent = parent;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    sprite.spriteFrame = this.frames.get(key)!;
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
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
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
    const backgroundRoot = this.makeRoot('BackgroundRoot');
    this.sprite(
      'KitchenBackground',
      'background',
      backgroundRoot,
      0,
      0,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
    );

    this.battleRoot = this.makeRoot('SafeContent');
    const hud = this.makeRoot('HudLayer', this.battleRoot);
    const order = this.makeRoot('OrderPanel', this.battleRoot);
    const board = this.makeRoot('BoardArea', this.battleRoot);
    this.potRoot = this.makeRoot('ResearchPot', this.battleRoot);
    this.actionRoot = this.makeRoot('ActionArea', this.battleRoot);
    this.makeRoot('FxLayer');
    this.makeRoot('OverlayLayer');
    this.makeRoot('DebugLayer');

    // Top controls keep independent safe margins; the title is always screen-centered.
    this.sprite('PauseButton', 'pause', hud, 2, 34, 74, 63);
    this.sprite('StepBadge', 'steps', hud, 304, 31, 80, 80);
    this.label('StepValue', '7', hud, 319, 47, 50, 44, 30, new Color(255, 255, 242, 255));
    this.label('LabTitle', '料理研究 · 订单01', hud, SCREEN_CENTER_X - 110, 49, 220, 34, 18);

    // Fixed order grid: dish | name | tomato requirement | egg requirement.
    this.sprite('OrderTray', 'orderTray', order, 0, 70, SCREEN_WIDTH, 120);
    const orderCenterY = 132;
    this.sprite('OrderDish', 'orderDish', order, 24, orderCenterY - 32, 64, 64);
    this.label('OrderTitle', '番茄炒蛋', order, 90, orderCenterY - 14, 104, 28, 19);

    // Two independent fixed-width requirement containers prevent cross-group overlap.
    const requirementGroupLeft = [198, 280];
    const requirementGroupWidth = 78;
    const requirementGroupHeight = 42;
    const requirementIconSize = 36;
    const requirementGap = 2;
    const requirementLabelWidth = 40;
    const requirementSpecs: Array<{
      groupName: string;
      iconName: string;
      labelName: string;
      key: AssetKey;
      range: string;
    }> = [
      {
        groupName: 'TomatoRequirementGroup',
        iconName: 'OrderTomato',
        labelName: 'TomatoNeed',
        key: 'tomato',
        range: '4–6',
      },
      {
        groupName: 'EggRequirementGroup',
        iconName: 'OrderEgg',
        labelName: 'EggNeed',
        key: 'egg',
        range: '3–5',
      },
    ];
    requirementSpecs.forEach((spec, index) => {
      const group = this.makeRoot(spec.groupName, order);
      const groupTransform = group.addComponent(UITransform);
      groupTransform.setContentSize(requirementGroupWidth, requirementGroupHeight);
      this.place(
        group,
        requirementGroupLeft[index],
        orderCenterY - requirementGroupHeight / 2,
        requirementGroupWidth,
        requirementGroupHeight,
      );

      const icon = this.sprite(
        spec.iconName,
        spec.key,
        group,
        0,
        0,
        requirementIconSize,
        requirementIconSize,
      );
      icon.node.setPosition(
        -requirementGroupWidth / 2 + requirementIconSize / 2,
        0,
        0,
      );

      const range = this.label(
        spec.labelName,
        spec.range,
        group,
        0,
        0,
        requirementLabelWidth,
        28,
        16,
      );
      range.node.setPosition(
        -requirementGroupWidth / 2
          + requirementIconSize
          + requirementGap
          + requirementLabelWidth / 2,
        0,
        0,
      );
    });

    // The board frame and the programmatic 7×7 matrix share SCREEN_CENTER_X.
    this.sprite('BoardFrame', 'boardFrame', board, -55, 110, 500, 480);
    const boardStep = 49;
    const slotSize = 70;
    const iconSize = 52;
    const boardGridWidth = slotSize + boardStep * 6;
    const boardGridLeft = (SCREEN_WIDTH - boardGridWidth) / 2;
    const boardGridTop = 181;
    const ingredientKey: Record<string, AssetKey> = {
      T: 'tomato',
      E: 'egg',
      P: 'potato',
      C: 'carrot',
      M: 'mushroom',
    };
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const slotX = boardGridLeft + col * boardStep;
        const slotY = boardGridTop + row * boardStep;
        this.sprite(`Slot_${row}_${col}`, 'tile', board, slotX, slotY, slotSize, slotSize);
        this.sprite(
          `Ingredient_${row}_${col}_${O1_BOARD[row][col]}`,
          ingredientKey[O1_BOARD[row][col]],
          board,
          slotX + (slotSize - iconSize) / 2,
          slotY + (slotSize - iconSize) / 2,
          iconSize,
          iconSize,
        );
      }
    }

    // Explicit draw order: complete pot back -> ingredients -> cropped front rim -> indicators.
    this.sprite('ResearchPotBack', 'pot', this.potRoot, 45, 525, 300, 224);
    this.potIngredientRoot = this.makeRoot('PotIngredients', this.potRoot);
    this.sprite('PotTomato', 'potTomato', this.potIngredientRoot, 105, 532, 96, 96);
    this.sprite('PotEgg', 'potEgg', this.potIngredientRoot, 187, 532, 96, 96);
    this.sprite('ResearchPotFrontRim', 'potFront', this.potRoot, 45, 593, 300, 156);
    this.potIndicatorRoot = this.makeRoot('PotReadyIndicators', this.potRoot);
    this.sprite('PotLamp1', 'starOn', this.potIndicatorRoot, 139, 638, 28, 28);
    this.sprite('PotLamp2', 'starOn', this.potIndicatorRoot, 221, 638, 28, 28);
    this.label('PotHint', '基础研究锅', this.potRoot, 108, 683, 174, 24, 15);

    const throwTrayY = 660;
    this.sprite('ThrowTray', 'throwTray', this.actionRoot, 0, throwTrayY, 286, 210);
    this.throwContentRoot = this.makeRoot('ThrowContents', this.actionRoot);
    const throwSlotCenterX = [68, 143, 219];
    const throwIconY = 729;
    const throwIconSize = 52;
    const throwCountY = 774;
    const throwCountWidth = 44;
    this.sprite(
      'ThrowTomato',
      'tomato',
      this.throwContentRoot,
      throwSlotCenterX[0] - throwIconSize / 2,
      throwIconY,
      throwIconSize,
      throwIconSize,
    );
    this.label(
      'ThrowTomatoCount',
      '5份',
      this.throwContentRoot,
      throwSlotCenterX[0] - throwCountWidth / 2,
      throwCountY,
      throwCountWidth,
      20,
      14,
    );
    this.sprite(
      'ThrowEgg',
      'egg',
      this.throwContentRoot,
      throwSlotCenterX[1] - throwIconSize / 2,
      throwIconY,
      throwIconSize,
      throwIconSize,
    );
    this.label(
      'ThrowEggCount',
      '4份',
      this.throwContentRoot,
      throwSlotCenterX[1] - throwCountWidth / 2,
      throwCountY,
      throwCountWidth,
      20,
      14,
    );
    this.label(
      'ThrowEmpty',
      '—',
      this.throwContentRoot,
      throwSlotCenterX[2] - throwIconSize / 2,
      754,
      throwIconSize,
      28,
      16,
    );

    this.fireSprite = this.sprite('FireButton', 'fire', this.actionRoot, 272, 713, 118, 128);
    this.readyLabel = this.label(
      'FireReady',
      '可开火',
      this.actionRoot,
      281,
      800,
      96,
      24,
      14,
      new Color(118, 67, 30, 255),
    );

    this.buildReveal();
  }

  private buildReveal(): void {
    this.revealRoot = this.makeRoot('RevealOverlay');
    const revealTransform = this.revealRoot.addComponent(UITransform);
    revealTransform.setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.revealRoot.addComponent(BlockInputEvents);
    const dim = new Node('RevealDim');
    dim.layer = Layers.Enum.UI_2D;
    dim.parent = this.revealRoot;
    const dimTransform = dim.addComponent(UITransform);
    dimTransform.setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    const dimGraphics = dim.addComponent(Graphics);
    dimGraphics.fillColor = new Color(44, 30, 24, 235);
    dimGraphics.rect(-SCREEN_CENTER_X, -SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT);
    dimGraphics.fill();
    this.place(dim, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.sprite('RevealHalo', 'halo', this.revealRoot, 45, 126, 300, 300);
    this.sprite('NormalRarityBadge', 'rarity', this.revealRoot, 137, 54, 116, 116);
    this.label('RarityLabel', '普通料理', this.revealRoot, 126, 154, 138, 28, 18, new Color(255, 247, 226, 255));
    this.sprite('RevealPedestal', 'pedestal', this.revealRoot, 18, 332, 354, 354);
    this.sprite('TomatoEggDish', 'dish', this.revealRoot, 27, 184, 336, 336);
    this.sprite('RevealNameplate', 'nameplate', this.revealRoot, 25, 503, 340, 168);
    this.label('DishName', '番茄炒蛋', this.revealRoot, 71, 554, 248, 42, 28);

    this.sprite('Star1', 'starOn', this.revealRoot, 81, 603, 76, 76);
    this.sprite('Star2', 'starOn', this.revealRoot, 157, 603, 76, 76);
    this.sprite('Star3', 'starOn', this.revealRoot, 233, 603, 76, 76);
    this.label('ResultReason', '番茄 5 · 鸡蛋 4', this.revealRoot, 74, 682, 242, 30, 17, new Color(255, 241, 216, 255));
    this.sprite('BookButton', 'bookButton', this.revealRoot, 16, 716, 142, 128);
    this.sprite('ContinueButton', 'continueButton', this.revealRoot, 128, 716, 246, 128);
  }

  private applyState(next: number): void {
    this.state = next;
    if (!this.revealRoot) return;
    const potReady = this.state >= 2;
    const revealActive = this.state === 3;
    this.potIngredientRoot.active = potReady;
    this.potIndicatorRoot.active = potReady;
    this.throwContentRoot.active = potReady;
    this.potRoot.active = !revealActive;
    this.actionRoot.active = !revealActive;
    this.revealRoot.active = revealActive;
    this.fireSprite.color = potReady ? Color.WHITE : new Color(145, 154, 143, 205);
    this.readyLabel.node.active = potReady && !revealActive;
  }
}
