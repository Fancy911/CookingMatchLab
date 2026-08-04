# CP0-R1-B-F1 Test Report

- Status: **PASS**
- Scope: CP0-R1-B-F1 only
- Baseline: `47b7d80d04f29983c3739bfde97427111879c9f3`
- Implementation commit: `3cf7ac3ddac28257e7bef2d8babf8ee6cbf0e95f`
- Cocos Creator: `3.8.8`
- Canonical config: Schema `2` / Hash `a35691f9`

## Acceptance

- RS02 natural controlled board: **PASS**
- Five configured ingredients / no tomato: **PASS**
- Count 7–12 each, six legal paths across three types, no straight 5+: **PASS**
- Natural refill and post-settle playability protection: **PASS**
- Free dead-board auto-shuffle with timer/score/pot/commercial state preserved: **PASS**
- Default menu excludes long-row and other test fixtures: **PASS**
- GOOD / GREAT / UNBELIEVABLE on natural boards: **PASS**
- Nine-link visible flight total: **480 ms — PASS**
- Warm hotpot independent dish asset: **PASS**
- Existing B101–B124: **24/24 PASS**
- New F101–F111: **11/11 PASS**
- All reproducible commands: **PASS**
- Cocos Creator 3.8.8 Web Mobile build: **PASS**
- Seven true PNG screenshots at 390×844: **PASS**
- One uncut H.264 video at 390×844 / 30fps / 12.00s: **PASS**
- Protected Domain/config/scene/Prefab diff: **zero**
- Manual reshuffle: **reserved port only; not invoked, not visible, no reward**

## Performance

- Sample time: `2026-08-04T15:16:01.548Z`
- Frames: `3600`
- Average FPS: `59.98`
- P50 frame: `16.70 ms`
- P95 frame: `17.80 ms`
- Max frame: `25.10 ms`
- Nine-link total flight: `480.00 ms`
- Peak active flight nodes: `9`

## Evidence

- Screenshots: `reports/cp0-r/r1b/f1/screenshots`
- Recording: `reports/cp0-r/r1b/f1/videos/CP0R-R1B-F1-V01-Natural-Long-Link-390x844.mp4`
- Command log: `reports/cp0-r/r1b/f1/CP0R-R1B-F1-Verification.log`
- Cocos build log: `reports/cp0-r/r1b/f1/CP0R-R1B-F1-Cocos-Build-3.8.8.log`
- Raw performance: `reports/cp0-r/r1b/f1/CP0R-R1B-F1-Performance-Raw.json`

## Boundary

The canonical Domain, gameplay configuration, scenes and Prefabs have zero
diff from the F1 baseline. This change adds only the R1-B application and
presentation protection required by F1. CP0-R2 has not started.
