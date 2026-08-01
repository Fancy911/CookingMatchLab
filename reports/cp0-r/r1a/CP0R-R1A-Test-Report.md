# CP0-R1-A Test Report

- Status: **PASS**
- Scope: CP0-R1-A static visual shell only
- Cocos Creator: **3.8.8**
- Start commit: `a2e662883d73062b57e05a8d311543c06ab24762`
- Baseline tag: `cp0-r1a-baseline`
- Completion implementation commit: `4bea8b773e53ec32915462e30827dff2b3c02a90`
- Canonical config: schema `2`, hash `a35691f9`
- Protected Domain/config diff: **zero**

## Delivered states

- READY: 01:30, score 0, clue 2/2/1, empty pot, six empty slots, disabled fire.
- POT_REVIEW: 01:08, score 12,480, COMBO ×1.5, GOOD, five one-unit slots, tomato/egg/scallion pot, enabled fire.
- QUICK_REVEAL_REPEAT: dimmed kitchen, normal tomato-egg dish, three stars, +1,100, cumulative ×2 and one next clue.

Hidden keyboard keys 1/2/3 and query values `ready`, `pot`, `reveal` are the only state-switching entry points. There are no visible debug controls and no gameplay input.

## Alignment basis

The scene uses a 390×844 `SafeAreaRoot` under Cocos `FIXED_WIDTH`. Critical HUD begins at y=46; horizontal content retains at least 14 px logical inset. The board frame and programmatic 7×7 matrix share the screen center. The six-slot board is one fixed 2×3 local grid, and the pot uses back → ingredient → front layering.

## Commands

| Command | Status | Exit |
|---|---:|---:|
| `npm test` | PASS | 0 |
| `npm run test:unit` | PASS | 0 |
| `npm run test:scenarios` | PASS | 0 |
| `npm run test:r0` | PASS | 0 |
| `npm run test:r1a` | PASS | 0 |
| `npm run typecheck` | PASS | 0 |

## Screenshots

| File | Size | PNG signature | Status | SHA-256 |
|---|---:|---:|---:|---|
| CP0R-R1A-01-Ready-390x844.png | 390×844 | true | PASS | `3effe7f04ac5624b6841247cf46a15c340505b6d8c4cc283ddbf3b99e25d0c8c` |
| CP0R-R1A-02-Pot-Review-390x844.png | 390×844 | true | PASS | `99ddf068b68f56b907b2478cb8adeb0fc2c20ec1bf2b835314039157d95154ad` |
| CP0R-R1A-03-Quick-Reveal-Repeat-390x844.png | 390×844 | true | PASS | `2a4be31b2b3b33fba126cc3d6b1af10883175888126fc061dc38e032395ab420` |

## Video

- File: `CP0R-R1A-V01-Static-States-390x844.mp4`
- Audit: **PASS**
- Size: 390×844
- Duration: 12.000 s
- Codec/FPS/frames: h264, 15/1, 180
- SHA-256: `acef1f714ba0e9479d90935a62aa12a366540d3f9e5ae05ca2010ce0af8eab1f`
- Capture: 180 consecutive screenshots captured from one live Cocos instance while hidden keys 1/2/3 switched READY, POT_REVIEW and QUICK_REVEAL_REPEAT; encoded at 15 fps without visible debug controls or cursor.

## Cocos build

- Status: **PASS**
- Engine confirmed: true
- Named build-finished marker: true
- Actual exit code: 36
- Artifact: `build/cp0r-r1a-web-mobile`, 132 files
- Manifest SHA-256: `721a173612b847e98c6569ebb9dab32eb16eae75a1f4d33281f32faee0febc4d`
- Failure markers: none

## Generated asset list

| Asset | Size | SHA-256 |
|---|---:|---|
| assets/resources/game/art/ingredients/ingredient_scallion.png | 400×400 | `efc596fe5c9db64d572dca03f60302441ec82f366341217c28c9f8325aa4f442` |
| assets/resources/game/art/pot/pot_scallion.png | 400×400 | `708c21a07eaccc3046ff8687c60f20ce11b56260d58f7e634de3084b2dd78d8f` |

Both modular scallion assets were generated with OpenAI imagegen in the existing G1-B jelly-toy style. The tool did not expose a model identifier. Chroma-key removal used soft matte and despill; transparent edges were inspected in the real Cocos 3.8.8 build.

## Temporary boundaries

- All three states remain static acceptance ViewModels.
- No playable Domain session, countdown, touch linking, audio, or multi-pot flow is connected.
- CP0-R1-B has not started.
