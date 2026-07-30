import {
  Color,
  EventTouch,
  Graphics,
  Label,
  LabelOutline,
  Layers,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  UITransform,
  Vec3,
} from 'cc';
import type { EffectPlan } from '../application/cp0c/EffectPlanBuilder';
import type { BoardGrid, Coord, IngredientId } from '../domain/cp0b/types';
import { stableHash } from '../domain/cp0b/stable';

const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;
const SLOT_SIZE = 70;
const ICON_SIZE = 52;
const STEP = 49;
const GRID_WIDTH = SLOT_SIZE + STEP * 6;
const GRID_LEFT = (SCREEN_WIDTH - GRID_WIDTH) / 2;
const GRID_TOP = 181;

export type SpriteFactory = (
  name: string,
  frame: SpriteFrame,
  parent: Node,
  x: number,
  y: number,
  width: number,
  height: number,
) => Sprite;

const sameCoord = (left: Coord, right: Coord): boolean =>
  left.row === right.row && left.column === right.column;

export class BattleBoardController {
  private readonly ingredientSprites: Sprite[][] = [];
  private readonly basePositions: Vec3[][] = [];
  private readonly pathGraphics: Graphics;
  private readonly pathCountLabel: Label;
  private readonly touchIndicator: Graphics;
  private currentBoard: BoardGrid = [];
  private activePath: Coord[] = [];
  private inputEnabled = true;
  private tracking = false;

  public onBegin?: (coord: Coord) => Coord[];
  public onExtend?: (coord: Coord) => Coord[];
  public onCommit?: () => void;

  public constructor(
    private readonly boardRoot: Node,
    private readonly fxRoot: Node,
    tileFrame: SpriteFrame,
    private readonly ingredientFrames: Partial<Record<IngredientId, SpriteFrame>>,
    makeSprite: SpriteFactory,
  ) {
    const transform = boardRoot.addComponent(UITransform);
    transform.setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);

    const slotRoot = new Node('BoardSlots');
    slotRoot.layer = Layers.Enum.UI_2D;
    slotRoot.parent = boardRoot;
    slotRoot.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);

    const lineNode = new Node('LinkPathLine');
    lineNode.layer = Layers.Enum.UI_2D;
    lineNode.parent = boardRoot;
    lineNode.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.pathGraphics = lineNode.addComponent(Graphics);
    this.pathGraphics.lineWidth = 9;
    this.pathGraphics.lineCap = Graphics.LineCap.ROUND;
    this.pathGraphics.lineJoin = Graphics.LineJoin.ROUND;
    this.pathGraphics.strokeColor = new Color(255, 241, 216, 245);

    const ingredientRoot = new Node('BoardIngredients');
    ingredientRoot.layer = Layers.Enum.UI_2D;
    ingredientRoot.parent = boardRoot;
    ingredientRoot.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);

    const countNode = new Node('LinkPathCount');
    countNode.layer = Layers.Enum.UI_2D;
    countNode.parent = boardRoot;
    countNode.addComponent(UITransform).setContentSize(30, 30);
    const countBadge = countNode.addComponent(Graphics);
    countBadge.fillColor = new Color(255, 238, 176, 255);
    countBadge.strokeColor = new Color(132, 76, 38, 255);
    countBadge.lineWidth = 3;
    countBadge.circle(0, 0, 14);
    countBadge.fill();
    countBadge.stroke();
    const countLabelNode = new Node('LinkPathCountValue');
    countLabelNode.layer = Layers.Enum.UI_2D;
    countLabelNode.parent = countNode;
    countLabelNode.addComponent(UITransform).setContentSize(30, 30);
    this.pathCountLabel = countLabelNode.addComponent(Label);
    this.pathCountLabel.fontFamily = 'PingFang SC';
    this.pathCountLabel.fontSize = 18;
    this.pathCountLabel.lineHeight = 22;
    this.pathCountLabel.color = new Color(115, 67, 34, 255);
    this.pathCountLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.pathCountLabel.verticalAlign = Label.VerticalAlign.CENTER;
    const countOutline = countLabelNode.addComponent(LabelOutline);
    countOutline.color = new Color(255, 244, 204, 255);
    countOutline.width = 5;
    countNode.active = false;

    for (let row = 0; row < 7; row += 1) {
      this.ingredientSprites[row] = [];
      this.basePositions[row] = [];
      for (let column = 0; column < 7; column += 1) {
        const x = GRID_LEFT + column * STEP;
        const y = GRID_TOP + row * STEP;
        makeSprite(`Slot_${row}_${column}`, tileFrame, slotRoot, x, y, SLOT_SIZE, SLOT_SIZE);
        const sprite = makeSprite(
          `Ingredient_${row}_${column}`,
          ingredientFrames.ING_TOMATO,
          ingredientRoot,
          x + (SLOT_SIZE - ICON_SIZE) / 2,
          y + (SLOT_SIZE - ICON_SIZE) / 2,
          ICON_SIZE,
          ICON_SIZE,
        );
        this.ingredientSprites[row][column] = sprite;
        this.basePositions[row][column] = sprite.node.position.clone();
      }
    }

    const indicatorNode = new Node('TouchIndicator');
    indicatorNode.layer = Layers.Enum.UI_2D;
    indicatorNode.parent = fxRoot;
    indicatorNode.addComponent(UITransform).setContentSize(42, 42);
    this.touchIndicator = indicatorNode.addComponent(Graphics);
    this.touchIndicator.fillColor = new Color(255, 244, 214, 110);
    this.touchIndicator.strokeColor = new Color(255, 255, 255, 220);
    this.touchIndicator.lineWidth = 3;
    this.touchIndicator.circle(0, 0, 18);
    this.touchIndicator.fill();
    this.touchIndicator.stroke();
    indicatorNode.active = false;

    boardRoot.on(Node.EventType.TOUCH_START, this.handleStart, this);
    boardRoot.on(Node.EventType.TOUCH_MOVE, this.handleMove, this);
    boardRoot.on(Node.EventType.TOUCH_END, this.handleEnd, this);
    boardRoot.on(Node.EventType.TOUCH_CANCEL, this.handleEnd, this);
  }

  public destroy(): void {
    this.boardRoot.off(Node.EventType.TOUCH_START, this.handleStart, this);
    this.boardRoot.off(Node.EventType.TOUCH_MOVE, this.handleMove, this);
    this.boardRoot.off(Node.EventType.TOUCH_END, this.handleEnd, this);
    this.boardRoot.off(Node.EventType.TOUCH_CANCEL, this.handleEnd, this);
  }

  public render(board: BoardGrid): void {
    this.currentBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const sprite = this.ingredientSprites[row][column];
        const frame = this.ingredientFrames[board[row][column].ingredientId];
        if (!frame) {
          throw new Error(`No C1 board sprite for ${board[row][column].ingredientId}`);
        }
        sprite.spriteFrame = frame;
        sprite.node.active = true;
        sprite.node.setPosition(this.basePositions[row][column]);
        sprite.node.setScale(1, 1, 1);
        sprite.color = Color.WHITE;
      }
    }
    this.clearPath();
  }

  public setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.tracking = false;
      this.touchIndicator.node.active = false;
      this.clearPath();
    }
  }

  public cancelActivePath(): void {
    this.tracking = false;
    this.touchIndicator.node.active = false;
    this.clearPath();
  }

  public animate(
    plan: EffectPlan,
    onFlightsComplete: () => void,
    onComplete: () => void,
  ): void {
    this.setInputEnabled(false);
    const staggerSeconds = Math.max(24, Math.min(55, 420 / plan.path.length)) / 1000;
    const flightSeconds = 0.46;
    let completedFlights = 0;
    plan.flightOrder.forEach((coord, index) => {
      const source = this.ingredientSprites[coord.row][coord.column];
      const clone = new Node(`Flight_${index}`);
      clone.layer = Layers.Enum.UI_2D;
      clone.parent = this.fxRoot;
      clone.addComponent(UITransform).setContentSize(ICON_SIZE, ICON_SIZE);
      const sprite = clone.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = source.spriteFrame;
      clone.setPosition(source.node.position);
      const start = clone.position.clone();
      const target = new Vec3(
        (plan.throwSlotIndex - 1) * 9 + (index - (plan.flightOrder.length - 1) / 2) * 4,
        -184 + (index % 2) * 6,
        0,
      );
      const arc = new Vec3(
        (start.x + target.x) / 2 + (index % 2 === 0 ? -26 : 26),
        Math.max(start.y, target.y) + 82,
        0,
      );
      source.node.active = false;
      tween(clone)
        .delay(index * staggerSeconds)
        .to(flightSeconds * 0.46, {
          position: arc,
          scale: new Vec3(0.88, 0.88, 1),
        }, { easing: 'quadOut' })
        .to(flightSeconds * 0.54, {
          position: target,
          scale: new Vec3(0.48, 0.48, 1),
        }, { easing: 'quadIn' })
        .call(() => {
          clone.destroy();
          completedFlights += 1;
          if (completedFlights === plan.flightOrder.length) {
            onFlightsComplete();
          }
        })
        .start();
    });

    const flightSpan = (plan.flightOrder.length - 1) * staggerSeconds + flightSeconds;
    const settlementStartSeconds = Math.max(0.26, Math.min(0.34, flightSpan * 0.45));
    const timeline = new Node('EffectTimeline');
    timeline.parent = this.fxRoot;
    tween(timeline)
      .delay(settlementStartSeconds)
      .call(() => {
        this.render(plan.settledBoard);
        const affected = new Set([
          ...plan.survivorMoves.map((move) => `${move.to.row}:${move.to.column}`),
          ...plan.refillMoves.map((move) => `${move.to.row}:${move.to.column}`),
        ]);
        for (let row = 0; row < 7; row += 1) {
          for (let column = 0; column < 7; column += 1) {
            if (!affected.has(`${row}:${column}`)) {
              continue;
            }
            const node = this.ingredientSprites[row][column].node;
            const target = this.basePositions[row][column];
            node.setPosition(target.x, target.y + 76, 0);
            tween(node).to(0.42, { position: target }, { easing: 'backOut' }).start();
          }
        }
      })
      .delay(0.58)
      .call(() => {
        this.render(plan.finalBoard);
        if (stableHash(this.currentBoard) !== plan.finalBoardHash) {
          throw new Error('Visible board hash diverged from Domain effect plan');
        }
        this.setInputEnabled(!plan.potFull);
        onComplete();
        timeline.destroy();
      })
      .start();
  }

  private handleStart(event: EventTouch): void {
    if (!this.inputEnabled) {
      return;
    }
    const coord = this.coordFromTouch(event);
    if (!coord) {
      return;
    }
    this.tracking = true;
    this.moveTouchIndicator(event);
    this.touchIndicator.node.active = true;
    this.activePath = this.onBegin?.(coord) ?? [];
    this.refreshSelection();
  }

  private handleMove(event: EventTouch): void {
    if (!this.tracking) {
      return;
    }
    this.moveTouchIndicator(event);
    const coord = this.coordFromTouch(event);
    if (!coord || this.activePath.some((item, index) =>
      sameCoord(item, coord) && index !== this.activePath.length - 2)) {
      return;
    }
    this.activePath = this.onExtend?.(coord) ?? this.activePath;
    this.refreshSelection();
  }

  private handleEnd(): void {
    if (!this.tracking) {
      return;
    }
    this.tracking = false;
    this.touchIndicator.node.active = false;
    this.onCommit?.();
  }

  private coordFromTouch(event: EventTouch): Coord | undefined {
    const location = event.getUILocation();
    const x = location.x;
    const y = SCREEN_HEIGHT - location.y;
    let best: { coord: Coord; distance: number } | undefined;
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const centerX = GRID_LEFT + column * STEP + SLOT_SIZE / 2;
        const centerY = GRID_TOP + row * STEP + SLOT_SIZE / 2;
        const distance = Math.hypot(x - centerX, y - centerY);
        if (distance <= 32 && (!best || distance < best.distance)) {
          best = { coord: { row, column }, distance };
        }
      }
    }
    return best?.coord;
  }

  private moveTouchIndicator(event: EventTouch): void {
    const location = event.getUILocation();
    this.touchIndicator.node.setPosition(
      location.x - SCREEN_WIDTH / 2,
      location.y - SCREEN_HEIGHT / 2,
      0,
    );
  }

  private refreshSelection(): void {
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const selected = this.activePath.some((coord) =>
          coord.row === row && coord.column === column);
        this.ingredientSprites[row][column].node.setScale(
          selected ? 1.06 : 1,
          selected ? 1.06 : 1,
          1,
        );
        this.ingredientSprites[row][column].color =
          this.activePath.length === 0 || selected
            ? Color.WHITE
            : new Color(255, 255, 255, 191);
      }
    }
    this.pathGraphics.clear();
    this.pathCountLabel.node.parent!.active = false;
    if (this.activePath.length > 1) {
      this.pathGraphics.strokeColor = new Color(255, 241, 216, 245);
      this.pathGraphics.lineWidth = 9;
      this.activePath.forEach((coord, index) => {
        const position = this.basePositions[coord.row][coord.column];
        if (index === 0) {
          this.pathGraphics.moveTo(position.x, position.y);
        } else {
          this.pathGraphics.lineTo(position.x, position.y);
        }
      });
      this.pathGraphics.stroke();
    }
    if (this.activePath.length > 0) {
      const endpoint = this.activePath[this.activePath.length - 1];
      const position = this.basePositions[endpoint.row][endpoint.column];
      this.pathCountLabel.string = String(this.activePath.length);
      this.pathCountLabel.node.parent!.setPosition(position.x + 23, position.y + 22, 0);
      this.pathCountLabel.node.setPosition(0, 0, 0);
      this.pathCountLabel.node.parent!.active = true;
    }
  }

  private clearPath(): void {
    this.activePath = [];
    this.refreshSelection();
  }
}
