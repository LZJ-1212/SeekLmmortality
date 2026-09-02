# 《问道长生》文档目录

修订：2026-09-02 21:37 +08 lzj — 目录增加署名规范入口

规格先行。实现代码以仓库为准；本目录说明「读哪份文档」。项目管理见 [project_status.md](./project_status.md)。

## 总览与运行

| 文档 | 内容 |
|------|------|
| [game_design.md](./game_design.md) | 天道法则、UI 短铁律、十二系统（视觉总则见 ui.md） |
| [project_status.md](./project_status.md) | 完成度、测试、成本、L1、上线判断 |
| [roadmap.md](./roadmap.md) | **工作顺序（A→F）**：A 安全+行动环；**B 补现有雏形（当前主线）**；C～F 才开新系统 |
| [dev_guide.md](./dev_guide.md) | **双人开发**：分支约定、认领排期、密钥、铁律摘要（启动命令仍见 runbook） |
| [attribution.md](./attribution.md) | **修订署名**：改代码/文档必须写作者与北京时间 |
| [runbook.md](./runbook.md) | 本机启动（XAMPP、前后端、常见故障） |
| [hosting.md](./hosting.md) | I06 功能规格（L1 穿透、暴露面、朋友须知） |
| [hosting_architecture.md](./hosting_architecture.md) | I06 架构（双 Origin 隧道、API 基址、NSSM 保活） |
| [ui.md](./ui.md) | **电脑 / 手机 UI 设计**：宣纸气质、断点、书房 vs 掌中分栏 |
| [command_ui.md](./command_ui.md) | 局内 12 指令功能：只读地图/技艺、三条行动、日志与选项本机保存 |
| [command_ui_architecture.md](./command_ui_architecture.md) | 指令技术：`handleCommand`、固定句、接口、灰键缺口 |
| [mobile.md](./mobile.md) | I11 功能规格（窄屏底栏、键盘；L1 布局已落地） |
| [mobile_architecture.md](./mobile_architecture.md) | I11 改哪些组件、dvh、安全区 |
| [player_agency.md](./player_agency.md) | **S36 自由度规范**：叙事自由、数值主权为零；三圈边界 |
| [player_state.md](./player_state.md) | **I20 / B1 成册**：气血修为寿元、时间档、死亡锁；加深词表已封口 |
| [player_state_architecture.md](./player_state_architecture.md) | I20 加深落点：四列、纯函数、不采信模型月数 |
| [realms.md](./realms.md) | **I21 / B2 成册**：境界链、雷劫骰、功德/道心；加深（耗时/终局键）未落地 |
| [realms_architecture.md](./realms_architecture.md) | I21 加深落点：`isTerminal`、`clockKind`、不搬压制公式 |
| [situation.md](./situation.md) | 情境锁：交手中禁止闭关/坊市等（不调 AI） |
| [plausibility.md](./plausibility.md) | S36 层 3：宣称奇迹何时掷仙缘骰；气运改不了秒杀（A5 已落地） |
| [architecture.md](./architecture.md) | 仓库分层与行动数据流 |
| [api.md](./api.md) | 已实现 HTTP 接口 |
| [content_catalog.md](./content_catalog.md) | 已实现的地区、配方、天赋等表 |

## 声音（规格已确认，代码未写）

| 文档 | 内容 |
|------|------|
| [audio_system.md](./audio_system.md) | 实体、决议、RVC/代理答疑 |
| [audio_architecture.md](./audio_architecture.md) | 前端模块、事件、方法签名 |

## 规划中的玩法（规格已写；S21 最小集已实现，其余代码未写）

| 文档 | 系统 |
|------|------|
| [combat_build.md](./combat_build.md) | S20 功法与神通构筑 |
| [intent_gateway.md](./intent_gateway.md) | S21 功能规格（最小集已实现：口令、日限、长度、黑名单） |
| [intent_gateway_architecture.md](./intent_gateway_architecture.md) | S21 最小集架构（与代码对齐；层 E/F 未做） |
| [chronicle.md](./chronicle.md) | S22 长效记忆；**A6 薄做已提前**（短记忆 / 未收束场景） |
| [beasts.md](./beasts.md) | S23 灵兽与傀儡 |
| [world_sim.md](./world_sim.md) | S24 天下大势与传闻 |
| [endings.md](./endings.md) | S25 多结局与成仙图鉴 |
| [heart_demon.md](./heart_demon.md) | S26 心魔与走火 |
| [oaths.md](./oaths.md) | S27 毒誓因果与禁术 |
| [mentorship.md](./mentorship.md) | S28 师徒与衣钵 |
| [mortal_kin.md](./mortal_kin.md) | S29 凡人亲缘 |
| [alchemy_toxin.md](./alchemy_toxin.md) | S30 丹毒药力与灵食 |
| [geography.md](./geography.md) | S31 地理赶路与关隘 |
| [reputation.md](./reputation.md) | S32 江湖名声与城中律法 |
| [intelligence.md](./intelligence.md) | S33 情报与天机 |
| [disguise.md](./disguise.md) | S34 伪装境界与神识 |
| [spirit_veins.md](./spirit_veins.md) | S35 灵脉洞府争夺 |
| [player_agency.md](./player_agency.md) · [plausibility.md](./plausibility.md) | S36：自由度总则已写；情境锁、宣称奇迹骰均已落地 |

已实现的十二系统：**铁律与公式摘要**见 [game_design.md](./game_design.md)；**成册与加深（阶段 B）**见 [roadmap.md](./roadmap.md) **B1–B16 / I13–I18、I20–I28**（未成册前以代码为准，禁止只改一边）。排期以 [roadmap.md](./roadmap.md) 为准，不以本表行序为准。阶段 B 未收束前不要按本表去开工法/心魔/灵兽。

**代码已有、独立规格未成册** 见 [project_status.md](./project_status.md) 第 13 节：洞府/宗门/技艺/情缘/地图/物品 **I13–I18**；战斗/功德/坊市/探索/逆天改命/轮回/创角开场 **I22–I28**（**I20** [player_state.md](./player_state.md)、**I21** [realms.md](./realms.md) 已成册；I21 加深见架构文）。整体界面 **I19**。
