# Cooking Match Lab - CP0-R0 Acceptance Fix A1

版本：v0.1  
性质：CP0-R0 验收修正唯一执行指令  
基线提交：`bce05a6a67a35e212f011e99194ad4523fea444e`  
授权范围：仅修正 CP0-R0 架构与验收证据  

> 本次不是 CP0-R1。完成后必须停止，不得接入正式计时 HUD、多锅 Cocos 表现、音频或料理地图。

## 1. 验收结论

CP0-R0 的以下结果暂予认可，不要求推翻：

- v2 配置哈希 `a35691f9`；
- R001～R024 24/24；
- RS01～RS05 共 6 个用例；
- 840 个基础份数组合、4 种标签状态、3360 个输入；
- 配方冲突 0、空结果 0、不稳定哈希 0；
- 90 秒、多锅、重复料理、灵感标签、自动开火和半成品规则方向。

但当前提交不能结束 CP0-R0，因为违反了“只保留一套规则逻辑”的架构约束。

## 2. 必须修正的问题

当前 Domain 同时存在：

- `PotModel` 与 `R0PotModel`；
- `RecipeResolver` 与 `R0RecipeResolver`；
- `StarCalculator` 与 `R0StarCalculator`；
- v1 Gameplay/Recipe/Order 类型与 R0 前缀的 v2 类型。

配置层同时存在：

- `ConfigRegistry`；
- `R0ConfigRegistry`。

`core.ts` 从约 639 行增加至约 1347 行且未删除旧逻辑，说明当前实现是把 v2 追加在 v1 后面，并非把 canonical 规则升级为 v2。

此外，`CocosJsonConfigLoader.load()` 当前无条件抛出“CP0-R0规则迁移中，视觉接入待R1”，使“配置加载失败”成为正常启动路径。R0 可以暂时阻止旧 Battle 进入，但不能把基础配置加载器永久改成必然失败，更不能用失败标题掩盖双模型问题。

## 3. 单一 canonical 模型要求

### 3.1 Domain

完成后，编译中的 Domain 只能保留一套 canonical v2 类：

- `PotModel` 使用 v2 的 4～6 份规则；
- `RecipeResolver` 使用 v2 六道份数配方；
- `StarCalculator` 使用 v2 60%/40% 公式；
- `TimedResearchSession` 或等价会话类作为唯一局内会话模型；
- `CookingHistoryModel` 作为唯一料理计数模型。

删除 `R0PotModel`、`R0RecipeResolver`、`R0StarCalculator` 等并行前缀类。不得仅重命名旧类后继续保留两套实现。

类型层也应以 canonical 名称表达 v2：

- `GameplayConfig`；
- `RecipeConfig`；
- `OrderConfig` 或 `ResearchSessionConfig`；
- `ScenarioConfig`；
- `ThrowRecord`；
- `CookResult`。

删除或迁出编译范围内的同义 `R0*` 类型。版本信息应由 `schemaVersion: 2` 和 Git 历史表达，不使用永久 `R0` 前缀制造第二套模型。

### 3.2 Config Registry

- 将 v2 校验能力合并到唯一 `ConfigRegistry`；
- 删除 `R0ConfigRegistry.ts`；
- `ConfigRegistry` 只解析 schemaVersion 2 canonical config；
- 旧 v1 配置解析器不再参与编译或运行；
- 配方全量枚举继续调用 canonical `RecipeResolver`。

### 3.3 历史代码保存方式

旧 v1 行为已经保存在 Git 历史、CP0-B/C 报告和历史提交中，不需要继续保留为可编译逻辑。

旧测试如需保留说明，应移动为 Markdown 迁移清单或保留在 Git 历史中。禁止以 `.ts` 文件继续留在测试源码目录内形成模糊的第二套测试实现。

## 4. Cocos 边界修正

### 4.1 配置加载

`CocosJsonConfigLoader` 不得无条件抛错。

它必须能够：

1. 加载 canonical schemaVersion 2 JSON；
2. 构建唯一 `ConfigRegistry`；
3. 校验新配置哈希 `a35691f9`；
4. 将结果交给上层。

### 4.2 R0视觉保护

旧 Battle 尚未接入 v2 UI，因此仍允许显示“视觉接入待R1”的内部保护画面，但必须通过明确的阶段保护组件或入口状态实现，不得伪装成配置加载失败。

保护画面标题改为：

> CP0-R0规则验证完成

说明文字：

> 新核心循环将在CP0-R1接入可玩界面

不得显示“配置加载失败”，除非真实配置确实损坏。

本次只允许为实现正确保护边界做最小入口调整，不得提前开发 R1 UI。

## 5. 测试要求

现有 R001～R024、RS01～RS05 必须全部继续通过。

追加架构测试 A001～A008：

| 编号 | 验证内容 |
| --- | --- |
| A001 | Domain 只存在一个 PotModel |
| A002 | Domain 只存在一个 RecipeResolver |
| A003 | Domain 只存在一个 StarCalculator |
| A004 | 不存在 R0PotModel/R0RecipeResolver/R0StarCalculator |
| A005 | 只存在一个 ConfigRegistry，R0ConfigRegistry 已删除 |
| A006 | 编译源码中不存在同义 R0GameplayConfig/R0RecipeConfig 等并行类型 |
| A007 | CocosJsonConfigLoader 可成功加载 schemaVersion 2 和哈希 a35691f9 |
| A008 | R0保护画面不走“配置加载失败”异常路径 |

继续执行：

```bash
npm test
npm run test:unit
npm run test:scenarios
npm run test:r0
npm run typecheck
```

并重新执行 Cocos Creator 3.8.8 Web Mobile 构建冒烟。

## 6. Cocos 构建证据修正

当前报告显示 `actualExitCode: 36`，虽然日志存在 `Build Assets success` 和 `build Task Finished`，但不能只凭“没有failure marker”直接标记PASS。

新报告必须同时记录：

- Cocos 实际退出码；
- 构建完成标记；
- 构建产物目录存在；
- `index.html` 或等价入口文件存在；
- 构建产物关键文件数量；
- 冒烟截图确实由本次构建产物启动后获取；
- 如果把退出码36视为Cocos/Electron正常退出，说明判定依据和额外成功条件。

若上述构建产物检查不成立，必须判定FAIL，不得包装成PASS。

## 7. 报告与Git提交

建议分两次提交：

1. 架构修正实现提交；
2. 验证报告归档提交。

报告必须明确记录：

- 原 R0 提交：`bce05a6a67a35e212f011e99194ad4523fea444e`；
- A1 实现提交完整 SHA；
- A1 报告归档提交完整 SHA；
- R001～R024；
- A001～A008；
- RS01～RS05；
- 五条命令逐项退出码；
- 新配置哈希；
- Cocos 构建产物证据；
- 390×844 新保护画面截图；
- 单一规则类和单一配置注册表扫描结果；
- 推送结果和工作区状态。

建议提交信息：

```text
refactor: consolidate CP0-R0 canonical v2 rules
docs: finalize CP0-R0 A1 verification
```

## 8. 明确禁止

本次不得：

- 开始 CP0-R1；
- 修改正式 Battle 布局；
- 接入90秒HUD和六投料槽表现；
- 接入多锅运行画面；
- 制作或播放 GOOD/GREAT/UNBELIEVABLE 音频；
- 制作料理研究地图；
- 新增料理、食材、锅具、剧情、商业化或 TapTap SDK；
- 恢复旧 CP0-D。

## 9. 停止条件

完成修正、提交、推送和报告后立即停止，只返回：

1. A1 实现与报告提交 SHA；
2. 单一 canonical 类清单；
3. 已删除并行类和文件清单；
4. R001～R024、A001～A008、RS01～RS05结果；
5. 五条命令结果；
6. Cocos构建产物和退出码说明；
7. 新390×844保护画面；
8. 报告路径；
9. 推送结果；
10. 工作区是否干净。

不得开始CP0-R1，等待人工验收。
