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
  UITransform,
  view,
} from 'cc';
import { CocosJsonConfigLoader } from '../infrastructure/CocosJsonConfigLoader';

const { ccclass } = _decorator;
const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;

@ccclass('CP0ABattleShell')
export class CP0ABattleShell extends Component {
  protected onLoad(): void {
    view.setDesignResolutionSize(SCREEN_WIDTH, SCREEN_HEIGHT, ResolutionPolicy.FIXED_WIDTH);
  }

  protected start(): void {
    this.bootstrap().catch((error: unknown) => {
      console.error('[CP0-R0-A1] canonical config bootstrap failed', error);
      this.showFatal(error instanceof Error ? error.message : String(error));
    });
  }

  private async bootstrap(): Promise<void> {
    const registry = await new CocosJsonConfigLoader().load();
    this.showStageProtection(registry.configHash);
    console.info(`[CP0-R0-A1] canonical schema v2 config hash ${registry.configHash}`);
  }

  private showStageProtection(configHash: string): void {
    const root = this.makeOverlay('CP0R0StageProtection', new Color(78, 39, 30, 255));

    const glow = new Node('WarmGlow');
    glow.layer = Layers.Enum.UI_2D;
    glow.parent = root;
    glow.addComponent(UITransform).setContentSize(310, 310);
    glow.setPosition(0, 105, 0);
    const glowGraphics = glow.addComponent(Graphics);
    glowGraphics.fillColor = new Color(148, 76, 43, 115);
    glowGraphics.circle(0, 0, 150);
    glowGraphics.fill();

    const pot = new Node('ResearchPotMark');
    pot.layer = Layers.Enum.UI_2D;
    pot.parent = root;
    pot.addComponent(UITransform).setContentSize(190, 118);
    pot.setPosition(0, 124, 0);
    const potGraphics = pot.addComponent(Graphics);
    potGraphics.fillColor = new Color(255, 194, 94, 255);
    potGraphics.strokeColor = new Color(91, 45, 32, 255);
    potGraphics.lineWidth = 7;
    potGraphics.roundRect(-82, -42, 164, 84, 34);
    potGraphics.fill();
    potGraphics.stroke();
    potGraphics.fillColor = new Color(255, 226, 155, 255);
    potGraphics.ellipse(0, 38, 72, 17);
    potGraphics.fill();
    potGraphics.stroke();
    potGraphics.moveTo(82, 15);
    potGraphics.lineTo(117, 30);
    potGraphics.lineTo(121, 13);
    potGraphics.lineTo(85, -4);
    potGraphics.close();
    potGraphics.fill();
    potGraphics.stroke();

    const panel = new Node('VerificationPanel');
    panel.layer = Layers.Enum.UI_2D;
    panel.parent = root;
    panel.addComponent(UITransform).setContentSize(342, 270);
    panel.setPosition(0, -118, 0);
    const panelGraphics = panel.addComponent(Graphics);
    panelGraphics.fillColor = new Color(255, 239, 199, 255);
    panelGraphics.strokeColor = new Color(119, 62, 38, 255);
    panelGraphics.lineWidth = 5;
    panelGraphics.roundRect(-171, -135, 342, 270, 28);
    panelGraphics.fill();
    panelGraphics.stroke();

    this.makeLabel(
      'StageTitle',
      'CP0-R0规则验证完成',
      panel,
      0,
      68,
      312,
      54,
      25,
      new Color(112, 50, 32, 255),
    );
    this.makeLabel(
      'StageMessage',
      '新核心循环将在CP0-R1接入可玩界面',
      panel,
      0,
      8,
      300,
      52,
      17,
      new Color(128, 69, 41, 255),
    );
    this.makeLabel(
      'ConfigStatus',
      `schemaVersion 2  ·  ${configHash}`,
      panel,
      0,
      -58,
      290,
      42,
      14,
      new Color(154, 91, 54, 255),
    );
    this.makeLabel(
      'WaitStatus',
      '等待 CP0-R1 明确授权',
      panel,
      0,
      -101,
      290,
      36,
      14,
      new Color(176, 105, 58, 255),
    );
  }

  private showFatal(message: string): void {
    const root = this.makeOverlay('ConfigFailure', new Color(50, 28, 28, 255));
    this.makeLabel(
      'FatalTitle',
      '配置加载失败',
      root,
      0,
      90,
      320,
      54,
      26,
      new Color(255, 235, 220, 255),
    );
    this.makeLabel(
      'FatalMessage',
      message,
      root,
      0,
      18,
      330,
      120,
      15,
      new Color(255, 220, 210, 255),
    );
  }

  private makeOverlay(name: string, color: Color): Node {
    const root = new Node(name);
    root.layer = Layers.Enum.UI_2D;
    root.parent = this.node;
    root.addComponent(UITransform).setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    root.addComponent(BlockInputEvents);
    const background = root.addComponent(Graphics);
    background.fillColor = color;
    background.rect(
      -SCREEN_WIDTH / 2,
      -SCREEN_HEIGHT / 2,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
    );
    background.fill();
    return root;
  }

  private makeLabel(
    name: string,
    text: string,
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    color: Color,
  ): Label {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.parent = parent;
    node.addComponent(UITransform).setContentSize(width, height);
    node.setPosition(x, y, 0);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 7;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    const outline = node.addComponent(LabelOutline);
    outline.width = 1;
    outline.color = new Color(255, 246, 221, 100);
    return label;
  }
}
