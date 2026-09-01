# HTTP 接口（已实现）

与代码同步日期：2026-09-02。实现以 `backend/server.ts` 与 `backend/src/routes/inventory.routes.ts` 为准。本文件只描述契约，不写实现。

- 基址：本机 `http://localhost:3000`（`PORT` 可改，前端默认仍打 3000）。
- 通用成功：`{ status: "success", ... }`；失败：`{ status: "error", message: string }`。
- 前端默认：Vite `http://localhost:5173`；请求基址见 `frontend/src/apiBase.ts`（`VITE_API_BASE`，未设则本机 3000）。
- **口令：** 已配 `PLAY_ACCESS_TOKEN` 时，**穿透流量**须带 `X-Play-Token`，否则 401；浏览器直连本机可不验。未配口令则不校验（禁止此时做公网映射，见 [hosting.md](./hosting.md)）。`POST /api/action` 另有每日 60 次配额，超限 429。规格见 [intent_gateway.md](./intent_gateway.md)。

---

## 健康检查

### `GET /api/ping`

探测进程与数据库。成功则返回可达信息（含库是否通）。不消耗 DeepSeek。

### `GET /api/ai-ping`

探测 DeepSeek。消耗额度。仅排障时用。

---

## 创角与读档状态

### `POST /api/create-player`

Body（JSON）：

| 字段 | 说明 |
|------|------|
| `name` | 道号 |
| `gender` | 性别 |
| `attributes` | 六维：`aptitude` `comprehension` `divine_sense` `speed` `dao_heart` `fortune`（缺省按 10） |
| `roots` | 灵根元素数组，如 `["水","木"]`；长度决定品质（1 天灵根 … ≥4 杂灵根） |
| `origin` | 出身（须落在命格表，见 [content_catalog.md](./content_catalog.md)） |
| `daoPursuit` | 道途 |
| `constitution` | 先天体质 |
| `talents` | 先天天赋名称数组 |

成功 `data`：`playerId`、`saveId`、`opening`（`paragraphs` + `options`）、`legacyBlessing`（无遗泽则为 `null`）。

数值由后端按命格折算；AI 只写开场叙事。字段超长（如尊名超过 16 字、缺灵根）→ **400**，不写库、不调开场模型。已配置口令时须带头。不占日限。

### `GET /api/player/:id`

`:id` 为 `playerId`。返回该修士行（Prisma 原始字段，含 JSON 字符串列）。404：「查无此人」。

---

## 行动（主循环）

### `POST /api/action`

Body：`{ playerId, action }`。`action` 为自然语言或快捷指令文本。

前置（S21 网关，先于拦截器）：

- 已配置 `PLAY_ACCESS_TOKEN` 且头不匹配 → **401**「天机有封，须持令牌。」
- `action` 空 / 超 200 码位 / 非法控制符 → **400**
- 命中注入黑名单 → **400**「此言大逆天道，天机不予推演。」
- 修士不存在 → **404**（不占日限）
- 存档已 `is_game_over` 或气血/寿元判定死亡 → **403**，不再调 AI（不占日限）
- 当日行动次数超限 → **429**「今日推演次数已尽，明日再来。」

其后：拦截器链（突破、时间、战斗、功德、百艺、坊市、宗门、人际、探索、闭关公式等）先硬算，再把 `forcedOutcome` 交给 DeepSeek。

成功 `data` 主要字段：

| 字段 | 说明 |
|------|------|
| `narrative` | AI 剧情 |
| `options` | 下一选项 |
| `monthsPassed` | 本回合流逝月数 |
| `isDead` / `deathReason` | 是否本回合终结 |
| `enteredSamsaraPool` | 是否进入轮回池 |
| `lifespanStatus` | 大限预警 |
| `combat` | 有战时：敌人名、胜负、境界差、伤势 |
| `talentChoices` | 大境成功后的三选一；否则 `null` |
| `karmaRetribution` | 天罚是否触发 |
| `crafting` | 百艺结算 |
| `seclusionCultivationGain` | 闭关修为增量 |
| `cave` | 洞府 |
| `shopTransaction` / `auction` | 坊市/拍卖 |
| `sect` / `sectPromotion` / `sectBetrayed` | 宗门 |
| `dualCultivation` | 双修 |
| `deceasedFriendNotices` | 旧友坐化 |
| `exploration` / `regionDanger` | 奇遇与越境惩罚 |
| `player` | 更新后的修士行 |

死亡锁之后该接口拒绝一切行动。上一回合若为交手（`world_state.scene_context=combat`），本回合输入闭关/坊市/拍卖/炼器炼丹/双修 → **400**，不调模型、不占日限，见 [situation.md](./situation.md)。宣称「捡神器反杀」**不**走 400，待 **A5** 封闭骰写入 `forcedOutcome`，见 [plausibility.md](./plausibility.md)；自由度总则 [player_agency.md](./player_agency.md)。读档回滚见下方快照接口。

---

## 逆天改命

### `POST /api/talents/choose`

Body：`{ playerId, talentId }`。`talentId` 必须是上一回合 `talentChoices` 中的 id。写入 `players.talents` JSON。400：非法 id。

---

## 存档列表与读档

### `GET /api/saves`

列出全部存档摘要（按更新时间倒序），供存档列表页免手抄 `playerId`。须口令，不占日限。

返回 `data`：`{ saveId, saveName, playerId, playerName, realmMajor, realmMinor, isGameOver, updatedAt }[]`。`playerId` 为 `null` 表示该存档玩家行缺失（脏数据，前端应禁用进入）。

### `DELETE /api/saves`

清空全部存档。级联删除 `players` / `world_state` / `player_cave` / `player_sect` / `player_inventory` / `player_relationships` / `save_snapshot`，并清理对应 `action_daily_quotas`。返回 `data.deleted`（删除数量）。**不可逆。**

### `DELETE /api/saves/:saveId`

删除单个存档，级联同上。404：存档不存在。**不可逆。**

### `GET /api/saves/:saveId/snapshots`

返回 `{ id, createdAt, label }[]`。

### `POST /api/saves/:saveId/rollback`

Body：`{ snapshotId }`。回滚玩家态并把 `is_game_over` 置回 `false`（允许从死前快照复活）。

---

## 背包

挂载前缀 `/api/inventory`。

| 方法 | 路径 | Body / 说明 |
|------|------|-------------|
| GET | `/:saveId` | 完整背包 |
| POST | `/:saveId/items` | `name`, `quantity`；可选 `category` `rarity` `description` `effects` |
| DELETE | `/:saveId/items/by-name` | `name`, `quantity` |
| PATCH | `/entries/:entryId` | `quantity?`, `isEquipped?` |
| DELETE | `/entries/:entryId` | 丢弃该条目 |

局内获得/消耗物品主要由 `/api/action` 拦截器调用 Service，不必手调这些接口。

---

## CORS

后端已开 CORS，供本机 5173 调用 3000。上线须收紧来源，见 L1 与 [intent_gateway.md](./intent_gateway.md)。
