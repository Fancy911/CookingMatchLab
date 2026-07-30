# CP0-C-C1 Test Report

**Result: PASS**

- C0 baseline: `3f6995a5f79369ac18042b682e5bc5e8a715e1b7`
- Accepted C1 base: `318f9fc01d3c09e0576b9fe40bb34ca35ddd0b05`
- C1-R1 implementation commit: `9c0b242f4d9cb60e800026029326d1637a9f3586`
- C1-R2 base: `2c9c0c428acf7e68fa013bc5111805b3ec02da71`
- C1-R2 implementation commit: `73d33dbb60bf4d9aa7c12d07d9ad5458ca1d1035`
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
| C001–C011 | 11/11 PASS |
| `npm test` | PASS, actual exit 0 |
| `npm run test:unit` | PASS, actual exit 0 |
| `npm run test:scenarios` | PASS, actual exit 0 |
| `npm run test:c1` | PASS, actual exit 0 |
| `npm run typecheck` | PASS, actual exit 0 |
| Static architecture audit | PASS |
| PNG signature and dimensions audit | 9/9 PASS |
| Cocos web-mobile build | PASS; Cocos command exit 36, completion markers present, no failure markers |

Raw command results are in `CP0C-C1-Command-Results.json`; the complete verification log and sanitized Cocos 3.8.8 build evidence are stored beside this report.

## C001–C011

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
- C011: pausing during `LINKING` clears the uncommitted path and resumes to `READY` or `POT_REVIEW`; the complete run snapshot, steps, pot, queues and hash remain unchanged.

## Manual C1 checks

M01, M02, M03, M04, M05, M08, M09, M10, M11, M18, M19 and M20 all PASS. The main recording visibly slows path growth and backtracking, then shows all five tomatoes and all four eggs following staggered arcs, delayed pot/tray/fire updates, complete cooking feedback and the three-star target reveal. The fallback recording visibly grows to five tomatoes, backtracks to three, completes the warm-hotpot reveal, and only then continues to an empty pot with the resolved board and five steps preserved. M09/M10 are additionally pinned by C007/U11; M20 is pinned by C009 and the Cocos local-save adapter.

## C1-R1 presentation and pause verification

- The cream path is rendered after board slots and before ingredient icons. The endpoint badge and touch indicator remain readable above ingredients.
- The endpoint count updates on every `PathEditor` snapshot, including backtracking.
- A committed link updates remaining steps immediately but defers pot ingredients, throw slots and fire state.
- The visible order is: ingredients leave the board → every selected icon follows a staggered two-segment arc → pot feedback appears → the throw slot shows `pathLength` and `units` → fire state updates.
- Throw slots visibly show `5格 / 5份` and `4格 / 4份`.
- Cooking includes explicit flames, lid motion, subtle pot shake, steam and a warm completion flash.
- Reveal reads `FireResult.isNewDiscovery` and displays `首次发现` or `再次完成`.
- `C011` verifies LINKING pause cancellation and full snapshot/hash preservation. `CP0ABattleShell` also clears the path, selection and touch indicator before showing the pause overlay.

## C1-R2 timing verification

- Flight staggering now uses `clamp(420 / pathLength, 24, 55) ms`: five cells use 55ms and four cells use 55ms.
- Drop/refill starts while the visible arc-flight sequence is still running. No selected ingredient is skipped, reduced or teleported.
- Pot feedback still waits for every selected ingredient to finish flying; throw-slot and fire-state updates remain delayed and ordered.
- Five-cell release reached `POT_REVIEW` in **912.6ms**.
- Four-cell release reached `POT_REVIEW` in **878.7ms**.
- Both measured settlements are in the requested 820–980ms target and below the 1.2s hard maximum.
- V01 and V01B were re-recorded from the final R2 build; gesture growth/backtracking remains deliberately readable while post-release flight uses the production timing.

## Runtime evidence

All required screenshots have the eight-byte PNG signature and their exact requested sizes:

- Seven core screenshots: 390×844
- Layout smoke: 360×800 and 412×915

Recordings:

- `CP0C-V01-O1-Playable-390x844.mp4`: 390×844, 30fps, 46.733s, one uncut capture.
- `CP0C-V01B-Fallback-Continue-390x844.mp4`: 390×844, 30fps, 36.867s, one uncut capture.

The recordings originate from the live Cocos Canvas stream. Conversion changed only the container/codec and normalized output to 30fps at 390×844; no frame sequence was cut or rearranged.

## Performance

- Fresh sample time: `2026-07-30T04:43:31.368Z` (`2026-07-30 12:43:31 +08:00`)
- Sample frames: 452
- Average: 59.752 FPS
- Mean frame time: 16.736ms
- P95 frame time: 18.5ms
- Maximum observed frame pause: 50ms
- Maximum observed long task: 51ms
- Pointer-down to next rendered frame: 10.8ms and 11.1ms; maximum 11.1ms
- Five-cell release to `POT_REVIEW`: 912.6ms
- Four-cell release to `POT_REVIEW`: 878.7ms

Input remained below 100ms, the longest observed main-thread pause remained below 150ms, and both settlement samples remained below 1.2s. This sample was collected from the final R2 source; no R1 performance values were reused. Full frame deltas, input samples, long-task observations and settlement measurements are retained in `performance/CP0C-C1-R2-Performance-Raw.json`; the matching runtime console lines are in `performance/CP0C-C1-R2-Performance-Console.log`.

## Visual and configuration protection

Compared with the C0 baseline:

- Frozen docs: zero diff
- Gameplay JSON/config tree: zero diff
- Scene/Prefab files: zero diff
- Existing CP0-A art: zero diff
- New art only: modular `dish_warm_hotpot_mix.png`

The R2 changes are limited to C1 presentation timing and regenerated evidence. Frozen documentation, gameplay configuration, fixed scenarios, scenes, Prefabs, existing CP0-A art and Domain rules remain unchanged.

## Known limitations

None blocking C1 acceptance.

**CP0-D has not started.**
