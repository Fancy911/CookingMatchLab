# CP0-R1-A Visual Fix Test Report

- Status: **PASS**
- Scope: CP0-R1-A visual repair only
- Cocos Creator: **3.8.8**
- Start commit: `f4d1f29252319aa6fdf6b7c087bac074ad4eeaae`
- Completion implementation commit: `875ea851651df1e28daa0238c55cded27bf501f8`
- Canonical config: schema `2`, hash `a35691f9`
- Protected Domain/config diff: **zero**
- CP0-R1-B: **not started**

## Delivered states

- READY: physical timer/score HUD, clue tray, complete 49-slot board, empty integrated six-slot wooden tray and material-preserving disabled fire.
- POT_REVIEW: GOOD jelly sticker, Combo badge, filled wooden slots with stable icon/quantity anchors, original research pot and bright “开火研究” action.
- QUICK_REVEAL_REPEAT: deep mask, circular halo, large dish, physical pedestal/nameplate, three stars, integrated +1,100 / 累计×2 reward plaque and small next-clue note.

Hidden keys 1/2/3 remain the only switching mechanism. No visible debug controls, test panel or cursor appears in the evidence.

## CP0-C comparison

- Board: the reduced floating layout was replaced by the accepted CP0-C 7×7 slot geometry and mint toy frame.
- HUD and clue: thin brown rectangles and one-line status text were replaced by physical candy/timer/nameplate and order-tray assets.
- Throw area: six table-like rectangles were replaced by one integrated wooden 2×3 kitchen prop.
- Fire: restored the original large bright tactile gold fire-button material and visual priority.
- Quick reveal: restored CP0-C scale hierarchy with deep mask, halo, pedestal, large dish, nameplate and three large stars.

## Alignment basis

- Board frame and 7×7 matrix share the 390 px screen center.
- Restored CP0-C board values: frame `[-55,110,500,480]`, matrix origin `[13,181]`, slot `70`, ingredient `52`, center step `49`.
- Top components reuse tactile asset shells; the score remains the dominant value and “研究分数” is auxiliary.
- The six wells are one integrated 2×3 prop with unified local anchors.
- Quick reveal restores CP0-C hierarchy: halo, pedestal, 336 px dish, nameplate and 76 px stars.

## Commands

| Command | Status | Exit | Output SHA-256 |
|---|---:|---:|---|
| `npm test` | PASS | 0 | `aa97bbd4e4521042dada6a058cd0379a65b76302e27d9a31ee6558c1e978ed26` |
| `npm run test:unit` | PASS | 0 | `3d29c7ab61e968f68ed9ea3461f5a9682be8426424d00096da6ef0658ae605f7` |
| `npm run test:scenarios` | PASS | 0 | `8ce76dc1311dc2cf99cf5e904d6a85f0794bb1c38b14ebb63dd3bf727eee70af` |
| `npm run test:r0` | PASS | 0 | `586567a6d13c7896db0025e1588bbc6189a746e99558981a441f411f3b341159` |
| `npm run test:r1a` | PASS | 0 | `7f13abd68eb363dc4ffce5bbd2a00c02d5755715b38d73f15b7c347ca604185b` |
| `npm run typecheck` | PASS | 0 | `aae295b7a6d53a806fd95bbd8ac992dc8b13a1e291666431e0395f141e25078d` |

## Screenshots

| File | Size | PNG signature | Status | SHA-256 |
|---|---:|---:|---:|---|
| CP0R-R1A-FIX-01-Ready-390x844.png | 390×844 | true | PASS | `1fb5df47215da820b116d1a9403deb1a606c55cee6967cf637ef23a09797c3fb` |
| CP0R-R1A-FIX-02-Pot-Review-390x844.png | 390×844 | true | PASS | `a09677acf4ef4856b6313feffeefa0694b23da2e9fa00126edb2639f6f5c441e` |
| CP0R-R1A-FIX-03-Quick-Reveal-Repeat-390x844.png | 390×844 | true | PASS | `c9a46bee7d54a33632ad383ea003e657819f50ad84ddbbb86d1a9831ef11b3a6` |

## Video

- File: `CP0R-R1A-FIX-V01-Static-States-390x844.mp4`
- Audit: **PASS**
- Size/duration: 390×844, 12.000 s
- Codec/FPS/frames: h264, 15/1, 180
- SHA-256: `c7b265b436232c5721424083cc165e9465eff016aa24ca89b8351d5f58236e04`
- Capture: 180 consecutive frames from one live Cocos Creator 3.8.8 Web Mobile instance; hidden keys 1/2/3 switched READY, POT_REVIEW, QUICK_REVEAL_REPEAT; encoded at 15 fps as one uncut 12-second video.

## Cocos build

- Status: **PASS**
- Engine confirmed: true
- Build-finished marker: true
- Actual exit code: 36
- Artifact: `build/cp0r-r1a-visual-fix-web-mobile`, 135 files
- Manifest SHA-256: `33da51b6bb48e5a23708ca90f339e36cf900dfcb4a4279fd511633c4765b33c9`
- Failure markers: none

## New asset

| Asset | Size | SHA-256 |
|---|---:|---|
| `assets/resources/game/art/ui/battle/throw_tray_six.png` | 1024×455 | `8d3bc1853d14a1a0d29422e464e1827835e5ced4ce42e11bbca8452f16491c50` |

OpenAI imagegen edited the accepted CP0-C wooden throw tray into one modular 2×3 six-well prop. Chroma removal used a soft matte and despill; the transparent PNG was inspected in the real Cocos build.

## Reused assets

- `background/kitchen_bg.png`
- `ui/battle/board_frame.png`
- `ui/battle/tile_normal.png`
- `ui/battle/order_tray.png`
- `ui/battle/step_badge.png`
- `ui/battle/throw_tray.png`
- `ui/battle/fire_button.png`
- `pot/pot_research.png`
- `pot/pot_research_front.png`
- `ui/reveal/reveal_halo.png`
- `ui/reveal/reveal_pedestal.png`
- `ui/reveal/reveal_nameplate.png`
- `ui/reveal/rarity_normal.png`
- `ui/reveal/star.png`
- `dishes/tomato_egg_no_scallion.png`
- `ingredients/ingredient_tomato.png`
- `ingredients/ingredient_egg.png`
- `ingredients/ingredient_potato.png`
- `ingredients/ingredient_carrot.png`
- `ingredients/ingredient_mushroom.png`
- `ingredients/ingredient_scallion.png`

## Modified files

- `assets/game/scripts/presentation/CP0ABattleShell.ts`
- `assets/resources/game/art/ui/battle/throw_tray_six.png`
- `assets/resources/game/art/ui/battle/throw_tray_six.png.meta`
- `package.json`
- `scripts/capture-cp0r-r1a-cocos-build.mjs`
- `scripts/capture-cp0r-r1a-visual-fix-cocos-build.mjs`
- `scripts/generate-cp0r-r1a-visual-fix-report.ts`
- `scripts/run-cp0r-r1a-verification.mjs`
- `scripts/run-cp0r-r1a-visual-fix-verification.mjs`
- `tests/r1a/cp0r-r1a-static.test.ts`

## Scope boundary

- Domain, canonical config and rules have zero diff from the start commit.
- The three states remain static acceptance ViewModels.
- No real countdown, touch linking, multi-pot loop, audio or other gameplay was connected.
- CP0-R1-B has not started.
