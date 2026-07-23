# Cooking Match Lab Development Handoff Manifest

> 项目：《料理消消研究所》  
> 交接包版本：v0.2  
> 当前授权：仅整理资料；将本包放入真实 Cocos Creator 空工程后，Codex 也只允许执行 CP0-A。  
> 完整性结论：本清单所列 11 个文件已全部放入交接包。

## 1. 使用方式

将 `Cooking-Match-Lab-Handoff/` 内的全部内容复制到真实 Cocos Creator 3.8 LTS 空工程根目录，使 `docs/`、`assets/`、`HANDOFF-MANIFEST.md` 和 `CODEX-START-CP0A.md` 位于工程根目录。

本包不是 Cocos 工程，不包含也不伪造 `.scene`、`.prefab`、项目配置、脚本或构建文件。空工程必须由项目负责人使用真实 Cocos Creator 创建或同步。

资料复制完成后：

1. 逐项核对本清单；
2. 确认实际 Cocos Creator 3.8.x 精确版本；
3. 在 CP0-A 修改前建立空工程 Git 基线提交；
4. 只把根目录 `CODEX-START-CP0A.md` 作为当前执行指令交给 Codex；
5. Codex 完成三张390×844运行截图和一段录屏后必须停止。

## 2. 文件清单

| 路径 | 用途 | 内容版本 | 状态 |
| --- | --- | --- | --- |
| `CODEX-START-CP0A.md` | 当前唯一 Codex 执行指令，锁定 CP0-A 范围和停止条件 | v0.2 | 齐全 |
| `HANDOFF-MANIFEST.md` | 交接包用途、文件清单、优先级和完整性核对 | v0.2 | 齐全 |
| `docs/00-project/Project-Baseline-v1.md` | 产品立项、定位、玩法方向、技术与阶段基线 | 包内命名 v1；正文保留已确认源版 v0.1 | 齐全 |
| `docs/01-visual/G1B-Visual-Direction-v1.md` | G1-B“果冻玩具厨房”四页面视觉方向与落地边界 | 包内命名 v1；正文保留已确认源版 v0.1 | 齐全 |
| `docs/02-gameplay/Core-Gameplay-Rules-v1.1.md` | 已冻结的连线、投料、开火、配方、续锅与星级规则 | v1.1 | 齐全 |
| `docs/03-content/G2-MVP-Content-v0.2.md` | 6种食材、6道料理、3个订单、配方数值和固定测试场景 | v0.2 | 齐全 |
| `docs/04-handoff/G3-Development-Handoff-v0.2.md` | 首个核心原型架构、布局、状态机、素材、测试和 CP0-A 任务边界 | v0.2 | 齐全 |
| `assets/game/art/references/G1B-01-Battle.png` | G1-B核心对局与锅同屏视觉参考 | 390×844 原图 | 齐全 |
| `assets/game/art/references/G1B-02-Ingredient-Flight.png` | 食材连线、离格、飞入锅中的视觉参考 | 390×844 原图 | 齐全 |
| `assets/game/art/references/G1B-03-Dish-Reveal.png` | 普通料理揭晓的构图与奖励反馈参考 | 390×844 原图 | 齐全 |
| `assets/game/art/references/G1B-04-Collection.png` | 菜谱图鉴的收藏感参考；CP0-A不实现图鉴页面 | 390×844 原图 | 齐全 |

## 3. 文档解释优先级

如果资料之间出现冲突，Codex 必须按以下顺序判断，并停止报告冲突，不得擅自改规则：

1. `docs/02-gameplay/Core-Gameplay-Rules-v1.1.md`：玩法真值；
2. `docs/03-content/G2-MVP-Content-v0.2.md`：食材、料理、订单、数值和固定场景真值；
3. `docs/01-visual/G1B-Visual-Direction-v1.md` 与四张参考图：视觉方向真值；
4. `docs/04-handoff/G3-Development-Handoff-v0.2.md`：工程结构、交互时序和验收真值；
5. `CODEX-START-CP0A.md`：当前授权范围和停止条件真值。

## 4. 当前明确不包含

- Cocos Creator 工程文件；
- `.scene`、`.prefab`、TypeScript、JavaScript或其他代码；
- `node_modules`、Library缓存、Temp缓存、构建产物；
- 广告、支付、TapTap SDK或发行配置；
- CP0-B、CP0-C、CP0-D 的执行任务；
- 未确认的新玩法、食材、料理、人物、剧情、活动或锅具；
- 临时色块、Emoji、网页组件或伪造运行截图。

## 5. 当前唯一开发门禁

Codex 只允许执行 CP0-A。CP0-A 完成三张真实390×844运行截图与10～20秒无剪辑录屏后，必须停止并等待项目负责人确认。未得到明确确认，不得开始 CP0-B。

