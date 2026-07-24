# CP0-A 资产与交付记录

## 基线与范围

- Cocos Creator：3.8.8
- CP0-A 开始前基线提交：`08a6c8b1bcc407230c548285a48b1cc212731a4b`
- 本次仅实现静态视觉壳：初始对局、投锅就绪、普通菜品揭晓三态。
- 状态切换仅供验收：运行时按隐藏键 `1`、`2`、`3`，或使用查询参数 `?state=1|2|3`。
- 未实现 CP0-B 及后续内容：无三消算法、触控、重力/补位、配方/星级/订单逻辑、存档、正式动画、粒子或音频。

## 内置图片生成模式与最终提示词

本次使用 Codex 内置图片生成模式。四张源图均由参考图的构图、材质和色彩角色约束后生成，再拆分为模块化运行资产。

### A. 厨房背景

> Create a pure warm “jelly toy kitchen” game background for a 390x844 portrait mobile screen. Mint-green retro kitchen, cream subway tiles, soft rounded cabinets, brass details, warm wooden counter at the bottom, subtle depth and cozy morning light. Background only: no UI, no board, no pot, no buttons, no text, no characters. Keep the center readable and low-detail for gameplay overlays. Polished casual mobile game art, soft plastic and clay materials.

输出：`kitchen-bg-source.png`（853×1844）。

### B. 对局 UI 模块表

> Create a clean 3x3 modular asset sheet for a warm jelly-toy cooking match game. Separate isolated objects on a flat vivid magenta chroma background with generous spacing and no overlap: rounded cream-and-coral board frame, glossy rounded square normal tile, cream order tray with coral rim, mint pause button, small cream step-count badge, cream throw tray with coral rim, orange-red fire button, coral research pot, matching pot lid. No letters, no numbers, no watermark. Front-facing orthographic casual mobile game UI, soft plastic/clay, consistent warm outlines and lighting.

输出：`battle-ui-sheet-source.png`（1254×1254）。

### C. 食材与锅内模块表

> Create a clean 3x3 modular asset sheet for the same warm jelly-toy cooking match game. Separate isolated objects on a flat vivid magenta chroma background with generous spacing and no overlap: whole tomato ingredient icon, fried-egg ingredient icon, potato icon, carrot icon, mushroom icon, tomato wedges for inside a pot, raw egg for inside a pot, small tomato-and-egg dish thumbnail, tomato slices. No letters, no numbers, no watermark. Front-facing orthographic casual mobile game art, soft plastic/clay, consistent warm outline and lighting.

输出：`ingredients-sheet-source.png`（1254×1254）。

### D. 揭晓 UI 模块表

> Create a clean 3x3 modular asset sheet for a warm jelly-toy cooking game dish reveal. Separate isolated objects on a flat vivid magenta chroma background with generous spacing and no overlap: large tomato scrambled eggs hero dish in a cream bowl, cream reveal pedestal, coral nameplate, green “normal rarity” style badge with no text, glowing gold star, dim empty star, coral continue button with no text, cream recipe-book button with no text, soft golden halo. No letters, no numbers, no watermark. Front-facing polished casual mobile game UI, soft plastic/clay, consistent warm outlines and lighting.

输出：`reveal-sheet-source.png`（1254×1254）。

## 模块化运行资产

### 背景

- `assets/resources/game/art/background/kitchen_bg_base.png`：780×1688。

### 对局 UI

- `board_frame.png`：400×400；九宫格边距 70/70/70/70。
- `tile_normal.png`：340×400；九宫格边距 80/80/80/80。
- `order_tray.png`：462×400；九宫格边距上/下 70、左/右 110。
- `throw_tray.png`：462×340；九宫格边距上/下 70、左/右 110。
- `pause_button.png`：400×340。
- `step_badge.png`：340×340。
- `fire_button.png`：400×440。
- `dish_thumbnail.png`：400×400。

### 研究锅与食材

- `research_pot.png`：440×444。
- `pot_lid.png`：374×440。
- `pot_tomato.png`、`pot_egg.png`：各 400×400。
- `ingredient_tomato.png`、`ingredient_egg.png`、`ingredient_potato.png`、`ingredient_carrot.png`、`ingredient_mushroom.png`：各 400×400。

### 菜品与揭晓 UI

- `dish_tomato_egg.png`：400×400。
- `reveal_pedestal.png`、`reveal_nameplate.png`、`rarity_normal.png`、`star_on.png`、`star_off.png`、`continue_button.png`、`book_button.png`、`reveal_halo.png`：各 400×400。

## 场景、预制体与脚本

- 场景：`assets/game/scenes/Battle.scene`
- 预制体：`assets/game/prefabs/battle/Board.prefab`
- 预制体：`assets/game/prefabs/battle/ResearchPot.prefab`
- 预制体：`assets/game/prefabs/reveal/RevealOverlay.prefab`
- 静态展示脚本：`assets/game/scripts/presentation/CP0ABattleShell.ts`

## 临时项

- CP0-A 文本使用系统 `PingFang SC`，后续如有正式字体资产须统一替换并复核字号与换行。
- 模块资产由图片生成源图拆分；源图完整保存在 `docs/04-handoff/cp0a-sources/`，便于后续美术重制或追溯。
- CP0-A 未配置音频、粒子和正式转场；这些不属于本检查点交付范围。

## 运行交付

- `CP0A-01-Battle-Ready-390x844.png`
- `CP0A-02-Pot-Ready-390x844.png`
- `CP0A-03-Reveal-Normal-390x844.png`
- `CP0A-States-390x844-15s.mp4`

三张图片均来自 390×844 真实 Web Mobile 运行视口；录屏为同一运行页面连续 15 秒、三态依次切换，无浏览器边框、调试 UI 或鼠标指针。
