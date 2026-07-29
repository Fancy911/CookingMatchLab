# CP0-C-C0 迁移报告

- 总状态：**PASS**
- C0 基线：`13a1ca813f89c260a1aff42183fe6ec9b82b6e21`
- 最终提交：本报告所在的单一提交（提交后以 GitHub 链接固化）
- Cocos Creator：`3.8.8`
- Node：`v22.22.2`
- 配置哈希：`8737fa94`（预期 `8737fa94`）
- C1：**未开始**

## 迁移映射

| 迁移前 | 唯一迁移后位置 |
| --- | --- |
| `src/cp0b/{types,core,stable}.ts` | `assets/game/scripts/domain/cp0b/{types,core,stable}.ts` |
| `src/cp0b/config.ts` | `assets/game/scripts/application/cp0c/ConfigRegistry.ts + tools/cp0b/NodeConfigLoader.ts` |
| `src/cp0b/scenario.ts` | `assets/game/scripts/application/cp0c/{OrderSession,ScenarioService}.ts + tools/cp0b/{PrototypeTestRunner,RunLogger}.ts` |
| `config/cp0-b/` | `assets/resources/game/config/cp0-b/` |

已删除旧位置：`src/cp0b/`、`config/cp0-b/`。

## 四条验收命令

| 命令 | 结果 |
| --- | --- |
| `npm test` | PASS |
| `npm run test:unit` | PASS |
| `npm run test:scenarios` | PASS |
| `npm run typecheck` | PASS |

- U01～U24：24/24 PASS
- S01～S09：9/9 PASS
- 总计：33/33 PASS

## 单一规则源码审计

| 类 | 声明数 | 唯一文件 |
| --- | ---: | --- |
| `BoardModel` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `PathValidator` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `PathEditor` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `BoardResolver` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `InspirationResolver` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `PotModel` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `RecipeResolver` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `StarCalculator` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `OrderResolver` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `DiscoveryModel` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `DeterministicRng` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `DeadBoardDetector` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `ShuffleResolver` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `RunSnapshot` | 1 | `assets/game/scripts/domain/cp0b/core.ts` |
| `ConfigRegistry` | 1 | `assets/game/scripts/application/cp0c/ConfigRegistry.ts` |
| `OrderSession` | 1 | `assets/game/scripts/application/cp0c/OrderSession.ts` |
| `ScenarioService` | 1 | `assets/game/scripts/application/cp0c/ScenarioService.ts` |
| `PrototypeTestRunner` | 1 | `tools/cp0b/PrototypeTestRunner.ts` |
| `RunLogger` | 1 | `tools/cp0b/RunLogger.ts` |

- 审计范围：仓库全部 TypeScript（排除依赖、缓存与构建输出）；非 CP0-B 导出类不计入本项。
- 运行时 Domain/Application 导入 `cc`：无
- 运行时 Domain/Application 导入 Node 内建模块：无
- 运行时 Domain/Application 引用 DOM：无
- 玩法源码直接调用 `Math.random()`：无
- TypeScript 相对导入显式使用 `.js/.ts`：无

## 单一配置源审计

- 唯一配置树：`assets/resources/game/config/cp0-b`
- JSON 数量：10（基础 5 个 + 场景 5 个）
- 旧 `src/cp0b`：不存在
- configHash：`8737fa94`，PASS

## Cocos 3.8.8 验证

- Web Mobile 发布构建：PASS
- 构建日志：`temp/builder/log/web-mobile7-29-2026 10-34.log`
- `CP0ABattleShell` 注册：PASS
- Creator 生成迁移资产元数据：PASS
- 真实运行截图：`reports/cp0-c/c0/CP0C-C0-Battle-Smoke-390x844.png`，390×844 PNG，PASS

## 保护范围

- 相对 `13a1ca813f89c260a1aff42183fe6ec9b82b6e21` 的场景、Prefab、美术、`CP0ABattleShell.ts` 变更：无
- 保护视觉差异：空，PASS

## 阶段边界

本次只完成 CP0-C-C0 的单一规则源码、单一配置源迁移、Cocos 导入/编译与冒烟验证。未实现触摸连线、棋盘动画、食材飞行、锅/投料/开火运行时、料理揭晓、继续流程、音效、存档或任何 CP0-C-C1/CP0-D 内容。

## 首个差异

无。
