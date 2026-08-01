# CP0-R0 Test Report

- Status: **PASS**
- Baseline: `fb28633422d6807afc259b7922912f83db859496`
- Report-generation HEAD: `fb28633422d6807afc259b7922912f83db859496`
- Cocos Creator: **3.8.8**
- Node.js: **v22.22.2**
- v1 historical config hash: `8737fa94`
- v2 canonical config hash: `a35691f9`
- Scope: CP0-R0 only; CP0-R1 not started

## Automated Rules

- R001–R024: **24/24 PASS**
- RS01–RS05: **6/6 cases PASS**
- Enumeration: **PASS** (3360 tagged inputs)
- Domain `cc` imports: **0**
- Domain `Math.random()` calls: **0**
- Protected presentation/scene differences: **0**
- Required command chain: **PASS**
- Cocos 3.8.8 build: **PASS**
- Smoke PNG audit: **PASS** (390×844)

## Historical Test Migration

| Historical tests | Disposition | v2 replacement |
| --- | --- | --- |
| U01-U03 | MIGRATED | R002, R005 |
| U04-U05 | SUPERSEDED_BY_V2 | R001, R009 |
| U06-U11 | MIGRATED | R006, R009, R020, R022 |
| U12-U13 | SUPERSEDED_BY_V2 | R001, R003 |
| U14-U16 | MIGRATED | R010, R011, R013 |
| U17-U19 | SUPERSEDED_BY_V2 | R012, R013 |
| U20-U22 | SUPERSEDED_BY_V2 | R014-R018 |
| U23-U24 | MIGRATED | R020-R022 |
| S01-S09 | SUPERSEDED_BY_V2 | RS01-RS05 |
| C001-C011 | UI_DEFERRED_TO_R1 | R0 build smoke only |

## Cocos Boundary

Cocos 3.8.8 receives a build-only smoke check. The runtime displays the explicit guard “CP0-R0规则迁移中，视觉接入待R1”; this is not a v2 playable UI claim.

## Known Temporary Items

- CP0-C Battle remains intentionally blocked from v2 runtime configuration until CP0-R1.
- No Cocos UI, audio playback, map, or formal save I/O is implemented in R0.
