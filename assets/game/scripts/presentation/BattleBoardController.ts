import {
  Color,
  EventTouch,
  Graphics,
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
    for (let row = 0; row < 7; row += 1) {
      this.ingredientSprites[row] = [];
      this.basePositions[row] = [];
      for (let column = 0; column < 7; column += 1) {
        const x = GRID_LEFT + column * STEP;
        const y = GRID_TOP + row * STEP;
        makeSprite(`Slot_${row}_${column}`, tileFrame, boardRoot, x, y, SLOT_SIZE, SLOT_SIZE);
        const sprite = makeSprite(
          `Ingredient_${row}_${column}`,
          ingredientFrames.ING_TOMATO,
          boardRoot,
          x + (SLOT_SIZE - ICON_SIZE) / 2,
          y + (SLOT_SIZE - ICON_SIZE) / 2,
          ICON_SIZE,
          ICON_SIZE,
        );
        this.ingredientSprites[row][column] = sprite;
        this.basePositions[row][column] = sprite.node.position.clone();
      }
    }

    const lineNode = new Node('LinkPathLine');
    lineNode.layer = Layers.Enum.UI_2D;
    lineNode.parent = boardRoot;
    lineNode.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.pathGraphics = lineNode.addComponent(Graphics);
    this.pathGraphics.lineWidth = 9;
    this.pathGraphics.lineCap = Graphics.LineCap.ROUND;
    this.pathGraphics.lineJoin = Graphics.LineJoin.ROUND;
    this.pathGraphics.strokeColor = new Color(255, 241, 216, 245);

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
    }
  }

  public animate(plan: EffectPlan, onComplete: () => void): void {
    this.setInputEnabled(false);
    const stagger = Math.max(24, Math.min(55, 420 / plan.path.length));
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
      source.node.active = false;
      tween(clone)
        .delay(index * stagger / 1000)
        .to(0.34, {
          position: new Vec3(-40 + plan.throwSlotIndex * 38, -202, 0),
          scale: new Vec3(0.48, 0.48, 1),
        }, { easing: 'quadIn' })
        .call(() => clone.destroy())
        .start();
    });

    const timeline = new Node('EffectTimeline');
    timeline.parent = this.fxRoot;
    tween(timeline)
      .delay(0.54)
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
            tween(node).to(0.48, { position: target }, { easing: 'backOut' }).start();
          }
        }
      })
      .delay(0.62)
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
  }

  private clearPath(): void {
    this.activePath = [];
    this.pathGraphics.clear();
  }
}
