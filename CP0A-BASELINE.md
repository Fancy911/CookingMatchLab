# CP0-A Visual Shell Baseline

## Status

CP0-A 的 390×844 核心对局视觉壳已通过阶段验收，并从本提交开始作为后续功能开发的 UI 与素材基线。

- Cocos Creator：3.8.8
- 设计分辨率：390×844
- 基线 Git 标签：`cp0-a-baseline`
- 基线提交信息：`chore: approve CP0-A visual shell`

## Current Acceptance Evidence

- 初始对局：`docs/04-handoff/cp0a-r3-deliverables/CP0A-R3-01-Battle-Ready-390x844.png`
- 投锅就绪：`docs/04-handoff/cp0a-r3-deliverables/CP0A-R3-02-Pot-Ready-390x844.png`
- 普通料理揭晓：`docs/04-handoff/cp0a-r2-deliverables/CP0A-R2-03-Reveal-Normal-390x844.png`
- 三状态连续录屏：`docs/04-handoff/cp0a-r2-deliverables/CP0A-R2-States-390x844-15s.mp4`

## Protected Baseline

以下内容属于已批准基线，后续功能开发不得无意改变或降级：

1. G1-B“果冻玩具厨房”整体视觉方向、色彩、材质和模块化资产风格。
2. 顶部安全区、屏幕中心标题、订单托盘四列信息层级与完整需求范围。
3. 棋盘框与程序化 7×7 矩阵的中心、边距、行列间距及固定初始内容。
4. 研究锅的后层、食材层、前沿层与处理指示层关系。
5. 投料槽圆心、数量标签、空槽横线、开火按钮和底部安全区。
6. 普通料理揭晓的全屏遮罩、输入拦截、料理/名牌/三星/按钮对齐关系。
7. 番茄炒蛋仅由番茄和鸡蛋构成；订单缩略图及揭晓成品不得出现葱花或其他未投入食材。
8. `assets/resources/game/art/` 下的当前运行素材，以及 `Battle.scene`、相关 Prefab 和静态壳脚本。

## Change Rule

后续 CP0-B 及之后的功能开发可以在此基线上增加交互和逻辑，但不得随意重排、拉伸、替换或覆盖已批准 UI 与素材。

任何确需改变上述基线的提交，必须：

1. 明确说明变更原因和受影响节点/素材；
2. 提供新的 390×844 真实 Cocos 运行截图；
3. 与本文件列出的验收图进行视觉回归对比；
4. 获得项目负责人明确确认后再合入。
