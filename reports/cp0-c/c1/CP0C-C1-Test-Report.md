# CP0-C-C1 Test Report

**Result: PASS**

- C0 baseline: `3f6995a5f79369ac18042b682e5bc5e8a715e1b7`
- C1 final commit: this report commit; use the final GitHub URL returned with delivery
- Branch: `main`
- Cocos Creator: **3.8.8**
- Node: **v22.22.2**
- Runtime config hash: **8737fa94**
- Scope: **CP0-D has not started**

## Automated verification

| Area | Result |
| --- | --- |
| U01–U24 | 24/24 PASS |
| S01–S09 | 9/9 PASS |
| Frozen regression total | 33/33 PASS |
| C001–C010 | 10/10 PASS |
| `npm test` | PASS, actual exit 0 |
| `npm run test:unit` | PASS, actual exit 0 |
| `npm run test:scenarios` | PASS, actual exit 0 |
| `npm run test:c1` | PASS, actual exit 0 |
| `npm run typecheck` | PASS, actual exit 0 |
| Static architecture audit | PASS |
| Cocos web-mobile build | PASS; Cocos command exit 36, completion markers present, no failure markers |

Raw command results are in `CP0C-C1-Command-Results.json`; the complete verification log and sanitized Cocos 3.8.8 build evidence are stored beside this report.

## C001–C010

- C001: portable/Cocos adapter equals the Node loader; hash `8737fa94`.
- C002: two-cell release changes no state and creates no `EffectPlan`.
- C003: fixed tomato path records 5 source cells, 5 units, slot 0 and one step.
- C004: effect-plan final board hash equals the Domain snapshot.
- C005: tomato 5 + egg 4 enables fire with 5 steps remaining.
- C006: fire resolves `RCP_TOMATO_EGG`, 3 stars, `SUCCESS`.
- C007: a third throw does not auto-fire.
- C008: warm hotpot continue preserves board, queue cursors and 5 steps while clearing the pot.
- C009: discovery and best stars persist; a refreshed run starts at 7 steps with an empty pot.
- C010: duplicate submission, animation and cooking callbacks are idempotent; save executes once.

## Manual C1 checks

M01, M02, M03, M04, M05, M08, M09, M10, M11, M18, M19 and M20 all PASS. The main recording shows short-link cancellation, fixed five-tomato and four-egg paths, flights, drop/refill, tray review, player-triggered fire, cooking and the three-star target reveal. The fallback recording shows five-path backtracking to three tomatoes, four eggs, ordinary warm-hotpot reveal and continue to an empty pot with the resolved board and five steps preserved. M09/M10 are additionally pinned by C007/U11; M20 is pinned by C009 and the Cocos local-save adapter.

## Runtime evidence

All required screenshots exist at their exact requested sizes:

- Seven core screenshots: 390×844
- Layout smoke: 360×800 and 412×915

Recordings:

- `CP0C-V01-O1-Playable-390x844.mp4`: 390×844, 30fps, 46.033s, one uncut capture.
- `CP0C-V01B-Fallback-Continue-390x844.mp4`: 390×844, 30fps, 36.033s, one uncut capture.

The recordings originate from the live Cocos Canvas stream. Conversion changed only the container/codec and reduced the integer-multiple source to 390×844; no frame sequence was cut or rearranged.

## Performance

- 146-frame live sample
- Average: 58.489 FPS
- P95 frame time: 17.7ms
- Maximum observed frame delta: 83.3ms
- Maximum observed long task: 96ms
- Pointer-down to next rendered frame: 14.4ms

Input remained below 100ms and the longest observed main-thread pause remained below 150ms. The 49 board nodes are reused; there is one board controller and no hidden duplicate board/reveal tree.

## Visual and configuration protection

Compared with the C0 baseline:

- Frozen docs: zero diff
- Gameplay JSON/config tree: zero diff
- Scene/Prefab files: zero diff
- Existing CP0-A art: zero diff
- New art only: modular `dish_warm_hotpot_mix.png`

`CP0ABattleShell` was intentionally converted from static state switching to real C1 state presentation while retaining the approved CP0-A coordinates and visual modules. Static `1/2/3` switching is removed.

## Known limitations

None blocking C1 acceptance. The measured average is slightly below the 60fps target during evidence capture, while P95 frame time, input latency and maximum stall all pass their explicit limits.

**CP0-D has not started.**
