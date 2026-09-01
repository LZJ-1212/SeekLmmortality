# 《问道长生》文档目录

规格先行。实现代码以仓库为准；本目录说明「读哪份文档」。项目管理见 [project_status.md](./project_status.md)。

## 总览与运行

| 文档 | 内容 |
|------|------|
| [game_design.md](./game_design.md) | 天道法则、UI 铁律、修炼公式、十二系统 |
| [project_status.md](./project_status.md) | 完成度、测试、成本、L1、上线判断 |
| [runbook.md](./runbook.md) | 本机启动（XAMPP、前后端、常见故障） |
| [architecture.md](./architecture.md) | 仓库分层与行动数据流 |
| [api.md](./api.md) | 已实现 HTTP 接口 |
| [content_catalog.md](./content_catalog.md) | 已实现的地区、配方、天赋等表 |

## 声音（规格已确认，代码未写）

| 文档 | 内容 |
|------|------|
| [audio_system.md](./audio_system.md) | 实体、决议、RVC/代理答疑 |
| [audio_architecture.md](./audio_architecture.md) | 前端模块、事件、方法签名 |

## 规划中的玩法（规格已写，代码未写）

| 文档 | 系统 |
|------|------|
| [combat_build.md](./combat_build.md) | S20 功法与神通构筑 |
| [intent_gateway.md](./intent_gateway.md) | S21 意图识别与安全网关（含 L1 口令日限） |
| [chronicle.md](./chronicle.md) | S22 长效记忆与大事记 |
| [beasts.md](./beasts.md) | S23 灵兽与傀儡 |
| [world_sim.md](./world_sim.md) | S24 天下大势与传闻 |
| [endings.md](./endings.md) | S25 多结局与成仙图鉴 |

已实现的十二系统细节以 `game_design.md` + `backend/src/services/*.ts` 为准，不另复制一份以免双源。
