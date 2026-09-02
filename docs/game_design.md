# 《问道长生》游戏设计与天道法则白皮书 (Game Design & Heavenly Dao Rules)

## 一、 核心架构原则：代码为主，AI 为辅
- **架构分离**：本游戏采用 Node.js + Express (后端) 与 React + Tailwind v3 (前端) 架构[cite: 1, 2]。
- **防作弊铁律**：严禁将数值结算权交由 LLM。玩家的气血、灵力、修为、寿元、功德、业力等状态必须由 Node.js 后端进行硬核计算，得出具体数值增减后，通过 `forcedOutcome` 强行注入系统提示词，限制 AI 只能依据既定结果生成剧情。
- **玩家自由度**：允许任意口吻试探世界；不允许一句话宣布胜负、境界或神兵。三圈边界见 [player_agency.md](./player_agency.md)。宣称「捡神器反杀」的骰子见 [plausibility.md](./plausibility.md)（`miracle.service.ts` 已接线）。
- **时间流逝法则**：由 Node.js 换算，细则与加深词表见 [player_state.md](./player_state.md) 第 5.4 节。微行按场扣时辰、满 3 时辰换日段、满 12 时辰过一日；历练/交手 1 月；闭关按年换月。一句「好的」不得翻日。寿元耗尽（年龄 > 寿元上限）则强制坐化、锁死行动。交手当口不得闭关/逛坊市，见 [situation.md](./situation.md)。
- **叙事模型**：结算永不交给模型。默认 `ai.ts` 的 `deepseek-chat`（或日后等价 Flash）、`json_object`、**关闭思考**。换 V4 Pro / 打开思考只改善文笔与接戏，费 token、延迟高，**不挡阶段 B、不能当细/粗或气血裁判**。详见 [architecture.md](./architecture.md) 第 2 节末。

## 二、 前端 UI 与排版铁律 (React + Tailwind 宣纸古典风)

电脑 / 手机分栏、色板见 **[ui.md](./ui.md)**（现状）。整体界面设计待办 **I19**。此处只留不可破的短铁律：

- **大面板**：`bg-paper` + 主题边框（`border-jade` 等）。禁止新内联马卡龙色。
- **禁 emoji**：剧情、系统日志、AI 叙事严禁 emoji。音量可用克制 SVG。详见 [audio_system.md](./audio_system.md) 决议第 20 条。
- **色板**：以 `frontend/tailwind.config.js` 为准（宣纸 `#FBF8F1`、青玉 `#6FA698`、朱砂气血 `#C05F55`、修为 `#A87E2E`、寿元 `#5C8C6E` 等）。
- **选项**：列在面板内，带 `〔机缘〕` `〔风险〕` `〔平和〕` 等标签。
- **指令**：常驻汉字指令（现 12 键，无坊市/对话菜单）。行为见 [command_ui.md](./command_ui.md)，代码见 [command_ui_architecture.md](./command_ui_architecture.md)。禁止再叠已删除的桌面「快捷」色块。窄屏底栏见 [mobile.md](./mobile.md)（I11 L1 已落地）。

## 三、 世界观与残酷修仙法则
- **真实死亡与境界压制**：修仙界弱肉强食。玩家遭遇高出一个大境界的敌人时，后端强制减伤 60%，玩家伤害变为 40%[cite: 1, 3]。高出两个大境界直接秒杀[cite: 3]。AI 不得放水，玩家执意送死必须判定陨落[cite: 3]。
- **功德与业力**：行善积功德，杀人夺宝积业力[cite: 3]。业力过高将招致更强天罚，功德可用于抵御雷劫[cite: 3]。
- **灵根与六维**：初始六维（资质、悟性、神识、遁速、道心、仙缘）总和约 60 点，单项 1～15。
  - **10 = 公式基准**（资质系数 = 资质÷10 → 1.0；洞府灵气系数同样以 10 为 1.0）。创角平均每维约 10，即凡间炼气修士的**中位**：不是废柴，也不是宗门天才。
  - **1** 极差，**15** 天资上限。命格会加减，故开局常见 8～12，属正常。
  - 灵根分为金木水火土及变异，决定修炼速度与功法契合度。完整招式见 [combat_build.md](./combat_build.md)（S20）。

## 四、 核心数值计算公式
- **修炼速度公式**：月修为增长 = 10 × 资质系数 × 灵根系数 × 功法系数 × 灵气系数 × 心境系数 × 天赋系数[cite: 3]。
  - 资质系数 = 资质 ÷ 10（基准 10 → 1.0）。
  - 灵根系数：伪灵根 0.6 / 杂灵根 0.8 / 真灵根 1.0 / 地灵根 1.2 / 天灵根 1.5。
  - 功法系数：暂无功法系统，固定为 1.0（占位）。规格见 [combat_build.md](./combat_build.md)。
  - 灵气系数 = 洞府灵气浓度 ÷ 10（基准 10 → 1.0）。
  - 心境系数 = 0.5 + 道心 × 0.05。
  - 天赋系数 = 逆天改命天赋乘数 × 命格乘数（先天体质 / 先天天赋 / 出身 / 道途），基准 1.0。
- **境界突破机制**：
  - 小境界：修为达标直接突破[cite: 1, 3]。
  - 大境界：分为人道、地道、天道[cite: 3]。必须经过 Node.js 掷骰子计算基础成功率与道心加成[cite: 1]。成功则寿元大涨、气血回满；失败则扣除雷劫伤害与修为[cite: 1, 3]。

## 五、 十二大核心系统规划
1. 核心状态机（气血、灵力、寿元、时间）— 成册 [player_state.md](./player_state.md)（**I20 / B1**）
2. 境界突破与雷劫（含强制拦截器）— **I21** `realms.md`
3. 时间与岁月流逝 — 并入 [player_state.md](./player_state.md)
4. 战斗与境界压制 — **I22** `combat.md`（招式库仍见 [combat_build.md](./combat_build.md) / S20）
5. 功德业力法则 — **I23** `karma.md`
6. 修仙百艺与洞府 — **I15** / **I17**
7. 经济与坊市交易 — **I24** `market.md`
8. 宗门势力运转 — **I14**
9. 人际与情缘双修 — **I16**
10. 探索与随机奇遇 — **I25** `exploration.md`（示意图 **I13**）
11. 逆天改命体系 — **I26** `talents.md`
12. 轮回与读档机制 — **I27** `reincarnation.md`

创角命格与开场剧情成册 — **I28** `character.md`。

成册写完前，细则以 `backend/src/services/*.ts` 为准；本白皮书只锁铁律与修炼公式。待办编号见 [roadmap.md](./roadmap.md)。

规划中（规格已写，代码未写）：功法、大事记全表、灵兽、大势、结局，以及心魔、毒誓、师徒、凡人亲缘、丹毒、地理、名声、情报、伪装、灵脉。**S36 自由度规范已写**；宣称奇迹骰（A5）已接线。S21 安全网关最小集已实现。目录见 [README.md](./README.md)；**开工顺序**见 [roadmap.md](./roadmap.md)（先补现有雏形阶段 B，再开新系统 C～F）。进度见 [project_status.md](./project_status.md)。

## 六、 声音系统（规格先行）
- 声音系统是独立子系统：只负责通道混音、配乐切换、旁白/天道/NPC 语音播放，不负责撰写剧情或计算数值。
- 已确认决议、RVC 可行性、后端代理与回本说明见 [audio_system.md](./audio_system.md)；代码架构见 [audio_architecture.md](./audio_architecture.md)。
- 第一期人声可延后；允许先做创角/局内 BGM 与少量 SFX，混音器架构仍适用。人声、RVC 见后续期。
- 剧情正文仍禁止 emoji；音量控件可用克制图形（优先 SVG）。

## 七、 项目工作记录与其它文档
- 完成度、测试、工时、上线：见 [project_status.md](./project_status.md)。
- **工作顺序：** [roadmap.md](./roadmap.md)。
- 自由度：[player_agency.md](./player_agency.md)。UI：[ui.md](./ui.md)。启动： [runbook.md](./runbook.md)。接口：[api.md](./api.md)。内容表：[content_catalog.md](./content_catalog.md)。架构：[architecture.md](./architecture.md)。