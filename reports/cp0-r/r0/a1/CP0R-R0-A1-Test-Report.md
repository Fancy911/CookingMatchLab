# CP0-R0 Acceptance Fix A1 Verification

- Status: **PASS**
- Original R0 commit: `bce05a6a67a35e212f011e99194ad4523fea444e`
- A1 implementation commit: `4d6adefe97f04cf0411bb12482906d6702a9cd4f`
- A1 report archive commit: `PENDING_REPORT_ARCHIVE_COMMIT`
- Report-generation HEAD: `4d6adefe97f04cf0411bb12482906d6702a9cd4f`
- Cocos Creator: **3.8.8**
- Node.js: **v22.22.2**
- Canonical schema/config hash: **2 / `a35691f9`**
- Scope: CP0-R0 acceptance fix A1 only; CP0-R1 not started

## Canonical Architecture

- A001: **PASS**
- A002: **PASS**
- A003: **PASS**
- A004: **PASS**
- A005: **PASS**
- A006: **PASS**
- A007: **PASS**
- A008: **PASS**
- Classes: `PotModel`, `RecipeResolver`, `StarCalculator`, `TimedResearchSession`, `CookingHistoryModel`, `ConfigRegistry`
- Parallel `R0*` rule classes/types: **0**
- ConfigRegistry declarations: **1**

## Test Results

- R001–R024: **24/24 PASS**
- A001–A008: **8/8 PASS**
- RS01–RS05: **6/6 cases PASS**
- Enumeration: **PASS** (840 base combinations × 4 tag states = 3360)
- Conflicts / empty / unstable: **0 / 0 / 0**

## Required Commands

| Command | Exit code | Status |
| --- | ---: | --- |
| `npm test` | 0 | PASS |
| `npm run test:unit` | 0 | PASS |
| `npm run test:scenarios` | 0 | PASS |
| `npm run test:r0` | 0 | PASS |
| `npm run typecheck` | 0 | PASS |

## Cocos 3.8.8 Evidence

- Status: **PASS**
- Actual exit code: **36**
- Build-finished marker: **true**
- Artifact directory: `build/cp0r-r0-a1-web-mobile` (**true**)
- Entry file: `build/cp0r-r0-a1-web-mobile/index.html` (**true**)
- Artifact file count: **126**
- Artifact manifest SHA-256: `081787f53198ba683272c1dc3f9a2c0888474ad39fa24a696072dd1c8a772514`
- Screenshot current-build linkage: **PASS**
- Screenshot PNG audit: **PASS** (390×844)
- Exit-code decision: Cocos/Electron returned 36 after emitting Build Assets success and the named build-finished marker. PASS additionally requires a fresh artifact directory, index.html, all required key files, a non-empty manifest, confirmed engine 3.8.8, and zero failure markers.

## Removed Parallel Sources

- `assets/game/scripts/application/cp0c/R0ConfigRegistry.ts`
- `tools/cp0b/R0NodeConfigLoader.ts`
- `tools/cp0b/R0ScenarioRunner.ts`
- `tests/c1/cp0c-c1.SUPERSEDED_BY_V2.ts`
- `tests/scenarios/cp0b-scenarios.SUPERSEDED_BY_V2.ts`
- `tests/unit/cp0b-unit.SUPERSEDED_BY_V2.ts`

## Temporary Boundary

- The old Battle runtime is intentionally replaced by the A1 stage-protection screen until CP0-R1.
- No timer HUD, multi-pot presentation, audio playback, research map, or formal save I/O is implemented.
