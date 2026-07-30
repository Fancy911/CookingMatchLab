# CP0-B 测试报告

- 总状态：**PASS**
- Cocos Creator：`3.8.8`
- Node：`v22.22.2`
- Git 基线：`cba34c9920be44cb546653635c8a4dab60c5aa14`
- 配置 schemaVersion：`1`
- 稳定 configHash：`8737fa94`
- 固定场景补盘：逐列固定队列，不使用 PRNG
- 普通确定性 RNG：`xorshift32-v1`
- 洗牌算法：`fisher-yates-xorshift32-v1`

## 单元测试（U01～U24）

| 编号 | 验证意图 | 结果 | 耗时 | 首个差异 |
| --- | --- | --- | ---: | --- |
| U01 | 八方向相邻合法；四方向模式下斜线非法 | PASS | 0.51 ms | — |
| U02 | 少于3连取消且所有状态不变 | PASS | 0.839 ms | — |
| U03 | 路径不可重复；返回倒数第二格只撤销最后格 | PASS | 0.209 ms | — |
| U04 | 普通食材1格等于1入锅单位 | PASS | 0.099 ms | — |
| U05 | 灵感食材连接占1格、入锅等于2单位 | PASS | 0.082 ms | — |
| U06 | 5、7、9长连阈值从配置读取 | PASS | 0.281 ms | — |
| U07 | 7连先完成当前投料，再在补盘生成灵感 | PASS | 0.41 ms | — |
| U08 | 灵感位于路径终点列的第一个新补格 | PASS | 0.177 ms | — |
| U09 | 掉落保持同列原有相对顺序 | PASS | 0.174 ms | — |
| U10 | 补盘不自动消除、不自动入锅 | PASS | 0.326 ms | — |
| U11 | 死盘免费洗牌，不改变步数和锅 | PASS | 0.68 ms | — |
| U12 | 一次合法连线只占一个投料位 | PASS | 0.042 ms | — |
| U13 | 至少两次投料才能开火；第三次后不自动开火 | PASS | 0.093 ms | — |
| U14 | 投料顺序不同但最终输入相同，生成同一道料理 | PASS | 0.05 ms | — |
| U15 | G2冲突表C01～C12全部通过 | PASS | 0.093 ms | — |
| U16 | 0～12全量整数枚举无两道明确配方同时命中 | PASS | 1200.401 ms | — |
| U17 | 五道明确料理理想路径均为3星 | PASS | 0.221 ms | — |
| U18 | 暖锅杂烩总分最高70，因此最多二星 | PASS | 0.039 ms | — |
| U19 | 星级计算不读取当前订单目标身份 | PASS | 0.047 ms | — |
| U20 | 非目标有剩余步数时只清锅并保留棋盘、特殊格、步数和队列 | PASS | 0.6 ms | — |
| U21 | 非目标且剩余0步时进入订单未完成 | PASS | 0.048 ms | — |
| U22 | 订单失败不回滚首次发现和历史最高星级 | PASS | 0.094 ms | — |
| U23 | 配置缺字段、非法食材或固定队列耗尽时明确失败 | PASS | 1.949 ms | — |
| U24 | 同一配置、seed和操作序列生成相同快照hash | PASS | 2.066 ms | — |

## 场景测试（S01～S09）

| 编号 | 验证意图 | 结果 | 耗时 | 首个差异 |
| --- | --- | --- | ---: | --- |
| S01 | O1番茄5连＋鸡蛋4连生成番茄炒蛋，剩5步 | PASS | 2.616 ms | — |
| S02 | O2_STANDARD生成香葱土豆饼，剩5步 | PASS | 2.046 ms | — |
| S03 | O2_BLACK第一锅生成黏糊番茄薯团，剩5步 | PASS | 3.596 ms | — |
| S04 | O2_BLACK清锅后继续生成订单目标，剩2步 | PASS | 3.064 ms | — |
| S05 | O3_STANDARD生成田园菌菇汤，剩5步 | PASS | 1.279 ms | — |
| S06 | O3_INSPIRATION灵感固定在r2c4，后续3格加入4单位 | PASS | 2.534 ms | — |
| S07 | O3_INSPIRATION第一锅生成星辉菌菇蛋盅，剩5步 | PASS | 2.327 ms | — |
| S08 | O3_INSPIRATION清锅后继续生成订单目标，剩2步 | PASS | 2.374 ms | — |
| S09 | O3_INSPIRATION重跑提示不重复，料理不变且篡改expected必失败 | PASS | 16.371 ms | — |

## 固定场景确定性运行摘要

| 场景 | 结果 | 首个差异 | 料理序列 | 最终剩余步数 | boardHash | snapshotHash |
| --- | --- | --- | --- | ---: | --- | --- |
| O1_TUTORIAL_001 | PASS | — | RCP_TOMATO_EGG | 5 | `4171fbe4` | `cf0280c2` |
| O2_STANDARD | PASS | — | RCP_SCALLION_POTATO_CAKE | 5 | `c0afe88c` | `2a2a4535` |
| O2_BLACK | PASS | — | RCP_CHARRED_TOMATO_POTATO_BALL → RCP_SCALLION_POTATO_CAKE | 2 | `2b8f4ea0` | `d898fb37` |
| O3_STANDARD | PASS | — | RCP_GARDEN_MUSHROOM_SOUP | 5 | `82d6825a` | `12c7e561` |
| O3_INSPIRATION | PASS | — | RCP_STAR_MUSHROOM_EGG_CUP → RCP_GARDEN_MUSHROOM_SOUP | 2 | `8b7d800c` | `dc95cf0d` |

每个动作的 `status`、`firstDifference`、前后步数、锅中单位、投料位、处理标签、队列位置、棋盘 hash 和快照 hash 均保存在同目录 JSON 报告的 `scenarioRuns[].actions` 中；面向人的坐标已转换为 `r1c1` 格式。只有全部动作与 `expectedFinalResult` 一致，场景和总报告才会标记为 PASS。

## 静态审计

- CP0-B 规则层导入 `cc`：无
- 玩法代码直接调用 `Math.random()`：无
- 相对 CP0-A 基线，既有场景/Prefab/美术非授权变更：无
- C1 阶段授权新增素材：assets/resources/game/art/dishes/dish_warm_hotpot_mix.png, assets/resources/game/art/dishes/dish_warm_hotpot_mix.png.meta
- Cocos 冒烟截图：`reports/cp0-b/CP0B-01-Battle-Smoke-390x844.png`，390×844 PNG，PASS

## 按阶段计划延后（不计为 CP0-B 失败）

- 香葱棋盘/锅中/提示素材
- 番茄炒蛋之外的5道料理成品素材
- 灵感、特色、珍稀与黑暗揭晓演出素材
- 完整粒子、音效与背景音乐

## 首个差异

无。
