# Cooking Match Lab - Codex CP0-C-C0 Only Execution Instruction

Version: 1.0  
Stage: CP0-C-C0  
Project: 《料理消消研究所》  
Authorization status: Not active until the user explicitly approves the CP0-C taskbook and authorizes C0

## 0. Only Authorization Boundary

When the user explicitly authorizes this instruction, execute only:

> CP0-C-C0: single-source runtime migration and Cocos compilation verification.

Do not implement touch linking, board animation, ingredient flight, pot runtime, firing, cooking, reveal, continue-after-wrong, new art, audio, save UI, PrototypeLab or any CP0-C-C1/CP0-D feature.

After C0 evidence is committed and pushed, stop and wait for user acceptance.

## 1. Required Baseline

- Repository: `Fancy911/CookingMatchLab`
- Required frozen commit in history: `13a1ca813f89c260a1aff42183fe6ec9b82b6e21`
- Cocos Creator: exactly `3.8.8`
- CP0-B config hash: `8737fa94`
- Existing tests: U01–U24 and S01–S09

Before writing:

1. report branch, HEAD, remote and clean/dirty status;
2. verify the frozen commit exists in the current history;
3. verify Creator 3.8.8;
4. verify all frozen planning docs exist;
5. verify CP0-A protected scene/prefab/art paths;
6. stop if unrelated local changes exist or ownership is unclear.

## 2. Target

Make CP0-B Domain, Application and JSON configuration importable by both:

- Cocos Creator runtime; and
- Node/Vitest tools,

while retaining exactly one rule source and one config source.

## 3. Required Migration

### 3.1 Canonical runtime source

Move the pure rule source into the Cocos asset database:

```text
assets/game/scripts/domain/cp0b/
  types.ts
  core.ts
  stable.ts
```

Split current mixed files so Cocos-safe code lives under:

```text
assets/game/scripts/application/cp0c/
  ConfigRegistry.ts
  OrderSession.ts
  ScenarioService.ts
```

Node-only code lives under:

```text
tools/cp0b/
  NodeConfigLoader.ts
  PrototypeTestRunner.ts
  RunLogger.ts
```

Exact filenames may follow an existing convention, but dependencies and single-source constraints may not change.

### 3.2 Canonical configuration

Move the only config tree to:

```text
assets/resources/game/config/cp0-b/
```

It must contain the same gameplay, ingredients, recipes, orders, tutorials and five scenario JSON files.

Tests and Node reports must read these exact files. Do not keep `config/cp0-b` as a second source.

### 3.3 Dependency separation

- Domain and pure Application: no `cc`, no `node:`, no DOM.
- Node loader/reporter: may use `node:fs`, `node:path` and process APIs.
- Cocos loader is not implemented in C0 unless a minimal compile-only adapter is required; no gameplay connection is allowed.
- Do not copy algorithms into Presentation or Infrastructure.

### 3.4 Module specifiers

Change TypeScript-to-TypeScript imports from forms such as:

```text
./types.js
```

to extensionless Cocos-compatible forms:

```text
./types
```

Adjust Vitest/TypeScript configuration so Node tests import the same files. Do not add experimental Import Maps.

### 3.5 Cocos metadata

Open the project with Cocos Creator 3.8.8 and allow it to import moved scripts/JSON.

- Do not hand-invent `.meta` UUIDs.
- Do not copy stale `.meta` files onto unrelated paths.
- Commit valid Creator-generated metadata required by the moved assets.

## 4. Protected Files and Prohibited Work

Do not intentionally modify:

```text
assets/game/scenes/
assets/game/prefabs/
assets/resources/game/art/
assets/game/scripts/presentation/CP0ABattleShell.ts
```

No C1 behavior may be added, including:

- touch events;
- interactive path rendering;
- board movement;
- ingredient flight;
- pot/throw/fire logic;
- cooking/reveal/continue;
- warm hotpot art;
- audio or effects;
- save UI or pause UI.

Do not change frozen gameplay values, recipes, boards, queues, expected scripts or expected results.

## 5. Mandatory Verification

Run:

```text
npm test
npm run test:unit
npm run test:scenarios
npm run typecheck
```

Required:

- U01–U24: 24/24 PASS
- S01–S09: 9/9 PASS
- report status PASS
- config hash remains `8737fa94`
- no `cc` in Domain/Application
- no Node built-ins in runtime Domain/Application
- no direct `Math.random()` in gameplay
- exactly one declaration for each CP0-B core class
- exactly one CP0-B config tree
- no old implementation under root `src/cp0b`
- Cocos Creator 3.8.8 script compilation PASS
- Web Mobile preview opens the unchanged Battle scene
- protected visual diff is empty

If the config hash changes, stop and report the exact content diff. Do not update the expected hash.

## 6. C0 Evidence

Create:

```text
reports/cp0-c/c0/CP0C-C0-Migration-Report.json
reports/cp0-c/c0/CP0C-C0-Migration-Report.md
reports/cp0-c/c0/CP0C-C0-Battle-Smoke-390x844.png
```

Report:

- baseline and final commit;
- exact Creator/Node versions;
- before/after mapping;
- deleted old paths;
- single-source and single-config audit;
- four command results;
- 33 existing test results;
- config hash;
- Cocos compilation result;
- protected directory diff;
- explicit statement that C1 was not started.

The screenshot must be a real Cocos 3.8.8 Web Mobile runtime image at exactly 390×844 and remain visually identical to accepted CP0-A/CP0-B.

## 7. Completion

Commit and push one focused commit:

```text
refactor: prepare CP0-C single-source runtime
```

Completion response:

1. C0 PASS/FAIL;
2. commit URL;
3. branch and clean status;
4. exact versions;
5. migration map;
6. command/test results;
7. config hash;
8. report/screenshot paths;
9. protected diff;
10. blockers or “none”.

Then stop. Do not begin CP0-C-C1.
