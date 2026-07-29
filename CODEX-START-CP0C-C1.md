# Cooking Match Lab - Codex CP0-C-C1 Only Execution Instruction

Version: 1.0
Stage: CP0-C-C1
Project: 《料理消消研究所》
Repository: `Fancy911/CookingMatchLab`
Authorization status: **Not active until the user explicitly authorizes CP0-C-C1**

## 0. 唯一授权边界

用户明确授权本文件后，只允许执行：

> CP0-C-C1：将已验收的静态对局壳改造成一个真实可玩的 ORD_01 闭环，并实现一次普通非目标料理揭晓后的继续研究流程。

本文件不授权 CP0-D，不授权完整MVP，不授权扩展其他订单、食材、料理、锅具、图鉴、首页、成长、商业化或Android发布。

完成C1全部证据、提交并推送后必须停止，等待用户验收。不得自行开始CP0-D。

## 1. 强制基线

- 分支：先报告当前分支，不得擅自切换不明分支。
- 必须位于或包含最终C0提交：

```text
3f6995a5f79369ac18042b682e5bc5e8a715e1b7
```

- C0迁移提交：

```text
19eeecfddf506c282ca608b4d79df9d39d09d572
```

- Cocos Creator：严格使用`3.8.8`。
- Node.js验收参考版本：`v22.22.2`。
- 冻结配置哈希：`8737fa94`。
- 已冻结测试：U01～U24、S01～S09。
- 设计验收基准：390×844、G1-B“果冻玩具厨房”。

开工前必须：

1. 报告分支、HEAD、remote、工作区干净状态；
2. 确认最终C0提交存在于当前历史；
3. 确认Cocos Creator精确版本为3.8.8；
4. 确认以下冻结文档存在且正文完整；
5. 从无`temp/`、`library/`和`node_modules/`的干净克隆运行`npm ci`及C0验收命令；
6. 确认C0配置哈希仍为`8737fa94`；
7. 如存在无关本地改动、文档缺失或基线不一致，立即停止报告。

冻结文档：

```text
docs/00-project/Project-Baseline-v1.md
docs/01-visual/G1B-Visual-Direction-v1.md
docs/02-gameplay/Core-Gameplay-Rules-v1.1.md
docs/03-content/G2-MVP-Content-v0.2.md
docs/04-handoff/G3-Development-Handoff-v0.2.md
```

本文件已包含C1完整执行口径。若仓库中另有`CP0C-Development-Taskbook-v0.1.md`，可作为补充来源；该补充文件不存在时不构成阻塞。不得自行重写冻结规则。

## 2. 事实优先级

发生冲突时依次采用：

1. `Core-Gameplay-Rules-v1.1.md`
2. `G2-MVP-Content-v0.2.md`
3. `G1B-Visual-Direction-v1.md`
4. `G3-Development-Handoff-v0.2.md`
5. 已验收C0源码、配置和测试
6. 本执行指令的阶段边界与验收要求
7. 仓库中如存在的`CP0C-Development-Taskbook-v0.1.md`

无法依此顺序消除的真实冲突必须停止报告。不得静默修改配方、棋盘、补充队列、评分、视觉方向或布局。

## 3. C1最终必须证明

C1结束时必须真实证明：

- Cocos运行时读取C0唯一配置源；
- ORD_01固定棋盘由Domain快照驱动；
- 玩家可以单指连接八方向相邻的同类食材；
- 少于3连取消且不改变任何Domain状态；
- 合法连线只提交一次原子Domain动作；
- 食材逐个离开棋盘并飞入锅中；
- 掉落和逐列补盘与Domain结果一致；
- 投料托盘、锅内数量、剩余步数和开火资格一致；
- 两次投料后玩家主动开火；
- 第三次投料不自动开火；
- 烹饪后按确定性结果揭晓料理和星级；
- 正确流程生成三星番茄炒蛋并完成订单；
- 偏离流程生成暖锅杂烩，完整揭晓后保留棋盘继续研究；
- 首次发现和最高星级可以本地保存；
- C0的33项测试继续通过；
- C001～C010新增测试通过；
- 交付规定截图、两段无剪辑录屏和完整报告。

## 4. C1允许出现的玩家内容

只允许：

- 订单：`ORD_01`
- 固定场景：`O1_TUTORIAL_001`
- 棋盘食材：番茄、鸡蛋、土豆、胡萝卜、蘑菇
- 正确料理：番茄炒蛋，`RCP_TOMATO_EGG`
- 普通非目标料理：暖锅杂烩，`RCP_WARM_HOTPOT_MIX`
- 锅具：基础研究锅
- 普通稀有度揭晓
- 1～3星动态结果
- 番茄炒蛋与暖锅杂烩的首次发现和最高星本地记录
- 当前阶段所需的暂停、继续、重新开始
- 测试专用死盘注入，但不得成为玩家菜单

不得增加第六种棋盘食材、第二个订单、第二种锅具或第七道料理。

## 5. 强制架构

### 5.1 唯一Domain与配置源

必须继续使用C0唯一源码：

```text
assets/game/scripts/domain/cp0b/
assets/game/scripts/application/cp0c/
assets/resources/game/config/cp0-b/
```

禁止：

- 在Presentation复制路径判定、掉落、补盘、料理或星级逻辑；
- 恢复根目录`src/cp0b`；
- 新建第二棵`config/cp0-b`；
- 把CP0-B打包成第二份本地npm包；
- 使用`Math.random()`决定玩法结果；
- 修改固定场景来迁就表现层实现。

### 5.2 分层职责

Domain/Application：

- 保持纯TypeScript；
- 不导入`cc`；
- 不导入Node内建模块；
- 不读取DOM或`localStorage`；
- 只负责确定状态、命令和结果。

Infrastructure：

- `CocosJsonConfigLoader`负责将Cocos `JsonAsset`转换为`RawConfigData`；
- `LocalSaveRepository`负责SaveDataV1持久化；
- 可以导入`cc`或浏览器存储；
- 不实现玩法算法。

Presentation：

- 负责触摸、节点、绘制、Tween、动画、音效和显示；
- 只消费Application返回的状态与EffectPlan；
- 不自行计算掉落、配方、星级或奖励。

### 5.3 推荐模块

允许按现有约定调整文件名，但职责必须保留：

```text
assets/game/scripts/application/cp0c/
  EffectPlanBuilder.ts
  PrototypeSession.ts

assets/game/scripts/presentation/
  BattleSceneController.ts
  LinkInputController.ts
  LinkPathRenderer.ts
  BoardView.ts
  BoardAnimationController.ts
  PotView.ts
  ThrowTrayView.ts
  CookingSequence.ts
  RevealPresenter.ts
  PausePresenter.ts

assets/game/scripts/infrastructure/
  CocosJsonConfigLoader.ts
  LocalSaveRepository.ts
```

### 5.4 Cocos配置加载

- 从`assets/resources/game/config/cp0-b/`加载唯一JSON源；
- 运行时验证配置后才能创建棋盘；
- 只选择`O1_TUTORIAL_001`作为当前玩家场景；
- 固定补充队列不得使用PRNG；
- 配置或资源缺失时显示开发错误并停止会话；
- 禁止回退到随机棋盘、硬编码副本或静态假数据；
- Cocos加载后的配置哈希必须为`8737fa94`。

## 6. 静态壳接入规则

`CP0ABattleShell.ts`在C1允许为真实交互接入而重构或退役，但必须遵守：

- 运行时只能存在一套棋盘、锅、投料托盘和揭晓层级；
- 禁止把新交互棋盘叠在旧静态棋盘上；
- 正常玩家流程不得再响应键盘`1/2/3`静态状态切换；
- 如保留调试注入，只能存在于隔离开发模式；
- 截图和录屏中不得出现调试按钮、状态列表、seed、hash或后台面板；
- 尽量复用已验收坐标、素材路径和视觉层级。

如交互确实需要调整CP0-A布局：

- 必须列出受影响节点和原因；
- 提供修改前后390×844截图；
- 单个节点位移原则上不超过约±4 px；
- 需要更大布局变化时停止并请求用户确认。

## 7. 对局启动与状态机

最低状态机：

```text
BOOT
→ ORDER_LOADING
→ ORDER_ACTIVE.READY

READY
├─ Touch → LINKING
├─ Fire allowed → COOKING
└─ Pause → PAUSED

LINKING
├─ invalid release → CANCELING → READY
└─ valid release → COMMITTING
                   → ANIMATING_THROW
                   → DEAD_CHECK
                   → POST_ACTION
                   → READY or POT_REVIEW

COOKING → REVEAL

REVEAL
├─ target → ORDER_SETTLEMENT.SUCCESS
└─ non-target with steps → clear pot → READY
```

硬约束：

- COMMITTING、动画、COOKING、REVEAL期间锁定棋盘输入；
- 每个完成回调必须幂等；
- 一次合法连线只提交一次；
- 第三次投料不自动开火；
- 料理结果必须先锁定，再播放表现；
- Reveal拦截底层全部触摸；
- 非目标继续只清理锅侧状态。

## 8. 连线交互

实现单指触摸：

- 从食材格开始触摸才进入LINKING；
- 使用CP0-B `PathValidator`的八方向相邻规则；
- 只能加入同类食材；
- 选中食材缩放至约1.06；
- 非匹配格降低约25%亮度；
- 合法路径使用约9 px奶油黄连线；
- 连线位于棋盘凹槽之上、食材图标之下；
- 回到倒数第二格时只撤回最后一格；
- 经过路径中其他已选格不得重复加入；
- 划过不同食材时保留当前路径，不取消；
- 路径端点显示当前格数；
- 少于3格松手时回弹取消；
- 取消不得改变步数、棋盘、队列、锅、发现记录、RNG或快照hash；
- 合法松手后立即锁定输入，直到表现确认完成。

Presentation可以预览路径，但只有`OrderSession.commit`可以改变真实状态。

## 9. 原子提交与EffectPlan

每次合法连线：

1. 保存before snapshot；
2. 调用Application/Domain提交；
3. 获得after snapshot；
4. 由`EffectPlanBuilder`生成唯一表现计划；
5. Presentation只执行计划；
6. 动画完成后校验可见棋盘与after snapshot/hash；
7. 幂等确认后解锁下一次输入。

EffectPlan至少包含：

- 路径源格；
- 食材ID和素材key；
- 飞行顺序；
- 留存格源坐标与目标坐标；
- 新补格来源与目标坐标；
- 最终棋盘快照/hash；
- 投料槽索引；
- 路径格数与真实单位数；
- 锅中单位变化；
- 步数变化；
- 开火资格；
- 如发生死盘，确定性洗牌计划。

动画不得反向计算或修改玩法结果。

## 10. 消除、飞锅、掉落和补盘

目标时序：

| 松手后时间 | 表现 |
| ---: | --- |
| 0～100 ms | 路径确认，步数变化开始 |
| 80～220 ms | 被采集食材抬起并离开格子 |
| 180～620 ms | 每个被采集食材沿弧线飞入锅中 |
| 330～680 ms | 同列食材掉落，新食材从上方补入 |
| 540～760 ms | 锅内出现对应颜色反馈和原料层 |
| 620～800 ms | 投料槽亮起并更新 |
| 820～980 ms | 必要时死盘重排，之后解锁输入 |

长路径飞行间隔：

```text
clamp(420 / pathLength, 24, 55) ms
```

要求：

- 49个棋盘食材节点必须复用或池化；
- 禁止每步销毁并重建整个棋盘；
- 所有选中食材都必须肉眼可见地飞入锅中；
- 飞行克隆放在`FxLayer`且不拦截触摸；
- 补盘不自动消除、不自动入锅；
- 队列头进入该列最低的新补格；
- 动画结束后的49格必须与Domain快照完全一致。

## 11. 锅、投料槽、步数与开火

- 一次合法连线扣1步并占1个投料槽；
- 投料槽代表投料次数，不代表食材种类；
- 槽位显示食材图标、路径格数和实际单位；
- 锅内显示未烹饪的模块化番茄/鸡蛋原料层；
- 第一次指定番茄路径显示5格/5份；
- 第二次指定鸡蛋路径显示4格/4份；
- 两次投料后开火按钮清晰变亮并可点击；
- 第三次投料后棋盘只读，但不得自动开火；
- 开火本身不扣步数；
- 少于两次投料时开火不可用；
- 锁定和解锁状态必须同时阻止视觉按钮与命令重复提交。

## 12. ORD_01正确流程

使用零基坐标：

```json
[
  [[0,0],[0,1],[1,1],[1,2],[2,2]],
  [[6,3],[6,4],[6,5],[6,6]]
]
```

必须得到：

- 第一投：番茄5格、5份；
- 第二投：鸡蛋4格、4份；
- 剩余步数：5；
- 料理：`RCP_TOMATO_EGG`；
- 星级：3星；
- 订单结果：成功。

## 13. 主动开火与烹饪

按下开火后：

1. 由Domain确定料理、星级和订单结果；
2. 锁定所有玩法输入；
3. 开火按钮按压回弹；
4. 播放火焰、锅盖、锅体晃动和蒸汽；
5. 成品料理不得提前出现在锅中；
6. 结果锁定后才允许暖色闪光；
7. Reveal作为Battle上的遮罩层打开，不切换到网页或后台页面。

从开火到Reveal目标约1.45秒。可以根据真实观感微调，但必须在报告中说明。

## 14. 普通料理揭晓

Reveal必须显示：

- 普通稀有度徽章；
- 对应料理成品；
- 准确料理名；
- 动态1～3星；
- 实际食材数量；
- 首次发现状态；
- 与结果一致的按钮文案；
- 不显示虚构金币、经验、广告或付费奖励。

番茄炒蛋成功揭晓：

- 成品料理是最大视觉主体；
- 成品宽度约占屏幕70%；
- 显示3星；
- 主按钮表达订单完成；
- 底层Battle完全不可交互。

## 15. 暖锅杂烩与继续研究

仍使用`O1_TUTORIAL_001`，不得创建第六个固定场景。

偏离路径：

```json
[
  [[0,0],[0,1],[1,1]],
  [[6,3],[6,4],[6,5],[6,6]]
]
```

必须得到：

- 番茄3份；
- 鸡蛋4份；
- 剩余步数5；
- 料理：`RCP_WARM_HOTPOT_MIX`；
- 订单结果：`CONTINUE_AFTER_REVEAL`；
- 星级由冻结公式计算，不得写死。

点击“继续研究”后必须：

- 关闭Reveal；
- 清空锅中单位、处理标签和投料槽；
- 保留开火前的当前棋盘；
- 保留当前列队列游标；
- 保留剩余5步；
- 保留订单目标；
- 保留首次发现与最高星；
- 返回READY；
- 不额外消耗步数。

至少用before/after hash证明：

- board hash不变；
- queue cursor不变；
- remaining steps不变；
- pot和throws被清空；
- discovery被保留。

## 16. 暖锅杂烩素材边界

C1允许新增且必须模块化：

- 无可识别额外配菜的中性暖汤/碗底；
- 可复用番茄料理层；
- 可复用鸡蛋料理层；
- C1所需的番茄＋鸡蛋暖锅杂烩组合成品。

禁止在玩家没有投入时出现：

- 香葱；
- 蘑菇；
- 胡萝卜；
- 土豆；
- 肉类；
- 绿色装饰叶或其他可识别配菜。

素材必须：

- 透明背景；
- 符合G1-B果冻玩具厨房；
- 与现有番茄炒蛋、锅和揭晓台透视一致；
- 边缘干净，无洋红残边；
- 提供源文件、尺寸、用途、授权/来源或生成prompt记录。

如果现有素材不足，必须使用imagegen生产并检查，不得用Emoji、色块、网页组件或无关菜品代替。无法达到当前视觉质量时停止报告阻塞。

## 17. 暂停、重开与最小存档

暂停：

- READY和LINKING状态可暂停；
- LINKING中暂停应取消未提交路径且不改变状态；
- 继续后恢复同一已提交状态；
- 重新开始加载O1固定棋盘和固定队列，清空当前锅；
- C1不增加PrototypeLab入口。

SaveDataV1只保存：

- 番茄炒蛋首次发现；
- 暖锅杂烩首次发现；
- 两道料理各自最高星；
- 灵感首次提示不属于C1玩家流程，不得借此实现灵感UI。

不保存：

- 当前棋盘；
- 当前锅；
- 当前步数；
- 当前投料槽。

刷新后：

- O1重新开始；
- 发现记录和最高星保留。

存档损坏时：

- 备份原始值到独立backup key；
- 建立合法默认存档；
- 不得白屏或卡死。

## 18. 死盘处理

运行时使用CP0-B确定性洗牌：

- 免费；
- 不扣步；
- 不清锅；
- 不清投料槽；
- 保留食材多重集合；
- 结果必须存在合法路径；
- 播放简短“重新整理食材”表现；
- 不出现广告或道具入口。

只允许用测试专用死盘fixture做人工验收。不得增加玩家可见的第六场景或调试菜单。

## 19. 视觉与音效边界

必须保持：

- 物理玩具厨房，而非卡片、网页或后台面板；
- 棋盘是第一交互中心，锅是第二视觉中心；
- 深棕文字，不使用纯黑；
- 飞锅、锅内反馈和Reveal是奖励反馈重点；
- Reveal期间底层压暗且禁止触摸；
- 安全区、订单托盘、棋盘框、锅、投料槽和开火按钮保持已验收对齐。

本阶段仅允许新增：

- 路径计数；
- 选择环/选择态；
- 奶油黄连线；
- 飞行轨迹；
- 锅内轻量溅射；
- 蒸汽和揭晓暖闪；
- 第16章限定的暖锅杂烩模块素材；
- 可选的合法临时音效：连线、入锅、开火/烹饪、揭晓/星星。

不得新增：

- BGM；
- 香葱素材；
- 灵感素材；
- 黑暗、特色、珍稀或传说揭晓包；
- 其他四道料理大图；
- 人物、立绘或料理CG；
- 未来活动或商店素材。

每个新增素材必须进入资产清单。

## 20. 自动化测试

### 20.1 冻结回归

以下必须持续通过：

- U01～U24：24/24；
- S01～S09：9/9；
- `npm test`；
- `npm run test:unit`；
- `npm run test:scenarios`；
- `npm run typecheck`；
- 配置哈希`8737fa94`。

如果确需增加纯动画字段：

- 不得改变玩法值；
- 必须给出配置diff与新hash；
- 在修改前停止并请求用户批准。

### 20.2 C1新增纯测试

新增独立标识的C001～C010：

| ID | 必须验证 |
| --- | --- |
| C001 | Cocos与Node加载路径产生等价的已验证配置，Cocos运行时hash为`8737fa94` |
| C002 | 2格松手不产生命令状态变化或EffectPlan |
| C003 | O1番茄5连EffectPlan包含正确源格、5份与-1步 |
| C004 | 掉落/补盘EffectPlan结束棋盘hash等于Domain |
| C005 | O1两次投料后可开火，快照为番茄5/鸡蛋4 |
| C006 | O1开火得到番茄炒蛋、3星和订单成功 |
| C007 | 第三次投料不会自动开火 |
| C008 | O1偏离流程得到暖锅杂烩，继续后保留棋盘/队列/步数 |
| C009 | 发现与最高星持久化，但活动订单状态不持久化 |
| C010 | 重复动画完成回调不会重复提交、发放、保存或跳转 |

Node测试不得导入Presentation组件或直接导入`cc`。Cocos加载器等价性应通过纯适配层测试加真实Cocos运行时hash证据完成。

### 20.3 静态审计

- Domain/Application无`cc`；
- Domain/Application无Node内建模块；
- Gameplay无`Math.random()`；
- 只有Presentation/Infrastructure导入`cc`；
- 运行时只有一套棋盘控制器；
- 正常玩家流程不受静态`1/2/3`切换影响；
- 不存在第二份规则或配置源码。

## 21. 人工验收

| ID | 操作 | 通过条件 |
| --- | --- | --- |
| M01 | 连3个相同食材 | 扣1步、占1槽、每个食材飞锅 |
| M02 | 2连松手 | 回弹取消，state/hash/RNG不变 |
| M03 | 返回倒数第二格 | 只移除路径最后一格 |
| M04 | 划过不同食材 | 已有路径保留 |
| M05 | 番茄恰好停在5连 | 投入5份，反馈清晰 |
| M08 | 完成第二次投料 | 开火明确启用且可用 |
| M09 | 测试第三次投料 | 不自动开火 |
| M10 | 注入测试死盘 | 免费确定性洗牌，锅和步数保留 |
| M11 | 正确完成O1 | 番茄炒蛋完整揭晓、3星、成功 |
| M18 | 完成偏离流程 | 暖锅杂烩完整揭晓、动态星级 |
| M19 | 点击继续研究 | 空锅、原棋盘/队列/5步、发现保留 |
| M20 | 发现后刷新 | O1重开，发现和最高星仍在 |

所有人工结果必须记录实际值、PASS/FAIL和证据文件。

## 22. 截图验收

必须提交以下真实Cocos运行时截图：

```text
reports/cp0-c/c1/screenshots/Core-01-Battle-Ready-390x844.png
reports/cp0-c/c1/screenshots/Core-02-Link-Five-390x844.png
reports/cp0-c/c1/screenshots/Core-03-Flying-To-Pot-390x844.png
reports/cp0-c/c1/screenshots/Core-04-Pot-Review-390x844.png
reports/cp0-c/c1/screenshots/Core-06-Cooking-390x844.png
reports/cp0-c/c1/screenshots/Core-07-Reveal-Normal-390x844.png
reports/cp0-c/c1/screenshots/Core-10-Continue-After-Wrong-390x844.png
```

要求：

- 原始尺寸严格390×844；
- 来自真实可达的Cocos运行状态；
- 不得后期拉伸或拼出假状态；
- 不含浏览器框、编辑器选中框、控制台、调试UI、鼠标光标；
- 不使用占位素材；
- 食材、投料槽、锅、星级和按钮文字清晰；
- `Core-10`必须显示继续后空锅与保留的棋盘/5步状态。

另提供：

```text
Layout-Smoke-360x800.png
Layout-Smoke-412x915.png
```

两种尺寸不得出现重叠、裁切、越过安全区或无法点击。

## 23. 录屏验收

### 23.1 正确流程

```text
reports/cp0-c/c1/recordings/CP0C-V01-O1-Playable-390x844.mp4
```

一镜到底45～75秒：

1. 先演示一次2连取消；
2. 连固定5番茄；
3. 完整看到飞锅、掉落和补盘；
4. 连固定4鸡蛋；
5. 检查投料槽番茄5/鸡蛋4；
6. 玩家主动点击开火；
7. 播放烹饪；
8. 揭晓番茄炒蛋与3星。

### 23.2 暖锅杂烩继续

```text
reports/cp0-c/c1/recordings/CP0C-V01B-Fallback-Continue-390x844.mp4
```

一镜到底30～60秒：

1. 连3番茄；
2. 连4鸡蛋；
3. 主动开火；
4. 完整揭晓暖锅杂烩；
5. 点击“继续研究”；
6. 显示空锅、保留棋盘和剩余5步。

录屏统一要求：

- 竖屏390×844或整数倍；
- 不低于30 FPS，优先60 FPS；
- 显示触摸/拖动指示，但不得遮挡格子；
- 禁止剪切、跳帧拼接或切换到调试菜单；
- 步数、投料槽、锅和星级可读；
- 如有音效必须与画面同步。

V02黑暗料理和V03灵感料理仍属于CP0-D，禁止在C1制作。

## 24. 性能目标

Web Mobile预览：

- 目标60 FPS；
- 松手到确认开始不超过100 ms；
- 连线结算期间主线程单次停顿不超过150 ms；
- 所有选中食材均可见飞行；
- 49个棋盘节点复用/池化；
- 不保留隐藏的第二套棋盘或Reveal树；
- 报告实际观测FPS、输入响应和最长停顿。

Android设备性能属于CP0-D，本阶段不得为满足Android验收扩展工作。

## 25. C1交付目录

```text
reports/cp0-c/c1/
  CP0C-C1-Test-Report.json
  CP0C-C1-Test-Report.md
  screenshots/
  recordings/
  assets/
    CP0C-C1-Asset-Manifest.md
```

资产清单必须记录：

- 文件路径；
- 原始尺寸；
- 运行时用途；
- 是否复用CP0-A；
- 来源/许可证或imagegen prompt；
- 是否模块化；
- 边缘与透明背景检查结果。

测试报告必须记录：

- C0基线提交`3f6995a5f79369ac18042b682e5bc5e8a715e1b7`；
- C1最终提交；
- 精确Cocos Creator和Node版本；
- 全部变更文件；
- 33项冻结测试；
- C001～C010；
- M01～M20中本阶段用例；
- 配置hash；
- 截图、录屏路径和原始尺寸；
- CP0-A视觉保护diff；
- 实际FPS和输入响应；
- 已知限制；
- CP0-D未开始的明确声明。

## 26. C1明确禁止

禁止开发：

- PrototypeLab或玩家场景选择；
- O2_STANDARD、O2_BLACK、O3_STANDARD、O3_INSPIRATION玩家流程；
- 香葱棋盘/锅内素材；
- 香葱土豆饼；
- 田园菌菇汤；
- 黏糊番茄薯团；
- 星辉菌菇蛋盅；
- 灵感食材视觉、提示和隐藏料理流程；
- 特色、珍稀、传说、黑暗揭晓包；
- Android构建与设备验收；
- 首页、厨房主界面、关卡选择、订单地图；
- 菜谱图鉴和食材图鉴；
- 长期成长、金币、经验、厨房装修；
- 广告、Mock广告、内购、TapTap SDK、埋点；
- 撤回、主动洗牌、神秘食材、第四投料槽；
- 新食材、新料理、新订单、新锅具或新规则；
- 人物、剧情、对话、活动或商店；
- BGM和未来素材预生产。

禁止用未来系统解决C1问题。

## 27. 停止和阻塞规则

出现以下任一情况立即停止，不得降低标准绕过：

- 冻结文档与配置冲突；
- 当前HEAD不包含C0最终提交；
- 工作区含来源不明改动；
- Cocos无法使用唯一源码/配置完成加载；
- Node依赖泄漏到运行时Domain/Application；
- 配置hash变化；
- 固定O1路径无法复现冻结结果；
- 必要素材缺失；
- imagegen无法达到G1-B质量；
- 交互需要超过约±4 px的大范围未批准改版；
- 33项回归或C001～C010失败；
- Cocos编译失败；
- 无法从真实运行状态获取截图或录屏；
- 无法保持一套运行时棋盘；
- 需要扩展CP0-D内容才能完成C1。

禁止：

- 弱化或删除测试；
- 更改固定数据来让测试通过；
- 伪造截图、录屏、FPS或日志；
- 使用网页、Emoji、扁平色块或后台面板代替游戏UI；
- 以“以后再优化”为由提交不合格视觉。

## 28. 提交与停止

建议只提交一个聚焦的C1完成提交：

```text
feat: complete CP0-C playable O1 loop
```

如验收修正需要额外提交，应保持聚焦且在报告中列明，不得重写或破坏C0历史。

推送后交付：

1. C1 PASS/FAIL；
2. 最终提交链接；
3. 分支与工作区干净状态；
4. Cocos Creator和Node精确版本；
5. 变更文件与架构说明；
6. 33项回归和C001～C010结果；
7. 配置哈希；
8. M01～M20本阶段结果；
9. 截图路径与原始尺寸；
10. 两段录屏路径、时长、FPS和是否无剪辑；
11. 新素材清单；
12. CP0-A视觉保护diff；
13. 性能数据；
14. 已知限制或“无”；
15. “CP0-D未开始”的明确声明。

然后停止。不得开始CP0-D，不得继续扩写产品功能。
