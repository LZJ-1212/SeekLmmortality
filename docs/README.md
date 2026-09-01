# 《问道长生》文档目录

规格先行。实现代码以仓库为准；本目录说明「读哪份文档」。项目管理见 [project_status.md](./project_status.md)。

## 总览与运行

| 文档 | 内容 |
|------|------|
| [game_design.md](./game_design.md) | 天道法则、UI 短铁律、十二系统（视觉总则见 ui.md） |
| [project_status.md](./project_status.md) | 完成度、测试、成本、L1、上线判断 |
| [roadmap.md](./roadmap.md) | **工作顺序（A→E）**、五柱、不要做的 |
| [runbook.md](./runbook.md) | 本机启动（XAMPP、前后端、常见故障） |
| [hosting.md](./hosting.md) | I06 功能规格（L1 穿透、暴露面、朋友须知） |
| [hosting_architecture.md](./hosting_architecture.md) | I06 架构（双 Origin 隧道、API 基址、NSSM 保活） |
| [ui.md](./ui.md) | **电脑 / 手机 UI 设计**：宣纸气质、断点、书房 vs 掌中分栏 |
| [command_ui.md](./command_ui.md) | 局内 14 指令语义；≥1024 常驻面板 + 指令在下 |
| [mobile.md](./mobile.md) | I11 功能规格（窄屏底栏、键盘；布局代码未做） |
| [mobile_architecture.md](./mobile_architecture.md) | I11 改哪些组件、dvh、安全区 |
| [player_agency.md](./player_agency.md) | **S36 自由度规范**：叙事自由、数值主权为零；三圈边界 |
| [situation.md](./situation.md) | 情境锁：交手中禁止闭关/坊市等（不调 AI） |
| [plausibility.md](./plausibility.md) | S36 层 3：宣称奇迹何时掷仙缘骰；气运改不了秒杀（代码 A5） |
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
| [chronicle.md](./chronicle.md) | S22 长效记忆与大事记 |
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
| [player_agency.md](./player_agency.md) · [plausibility.md](./plausibility.md) | S36：自由度总则已写；情境锁已落地；宣称奇迹骰 **A5** 未接线 |

已实现的十二系统细节以 `game_design.md` + `backend/src/services/*.ts` 为准，不另复制一份以免双源。排期以 [roadmap.md](./roadmap.md) 为准，不以本表行序为准。
