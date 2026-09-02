# 局内指令（技术架构）

依据 [command_ui.md](./command_ui.md)。布局见 [ui.md](./ui.md)。

---

## 1. 文件

| 路径 | 职责 |
|------|------|
| `CommandMenu.tsx` | `COMMANDS` 12 键；`ALWAYS_ENABLED`（含地图/技艺/读档/存档） |
| `MainGame.tsx` | 分发、`COMMAND_ACTION_TEXT`（仅修炼/突破/悟道）、日志与选项 `localStorage`；拉玩家走 `fetchPlayerPayload` |
| `InfoModal.tsx` | 只读层，含地图、技艺 |
| `catalogDisplay.ts` | 地名坐标、百艺开局未习、天玄历文案 |
| `rootElements.ts` | 灵根元素名与状态卡色块（创角页与状态卡共用） |
| `RegionMap.tsx` | 地图 SVG 示意图 |
| `LoadModal.tsx` | 快照 HTTP |
| `App.tsx` | 「存档」→ 列表（卸载 MainGame；日志已先写入本机） |

---

## 2. 分发

```
cmd
  ├─ 面板 且宽屏 → return
  ├─ INFO_COMMANDS（面板/背包/洞府/宗门/情缘/地图/技艺）→ InfoModal
  ├─ 读档 → LoadModal
  ├─ 存档 → onExitToList()
  └─ 修炼/突破/悟道 → handleAction(固定句)
```

---

## 3. 日志持久化

- 键：`sl_action_logs_${playerId}`
- 进局 `useState` 先读本机；之后每次 `logs` 变化写回（截断 400 条）
- 开场剧情：仅当本机还没有 `player`/`narrative` 条目时写入，避免冲掉历史
- 读档成功：`setLogs(prev => [...prev, 时光倒流])`，禁止换成单行

刷新或「存档」再进：同一 `playerId` 读回日志。

---

## 3.1 选项持久化

- 键：`sl_action_options_${playerId}`
- 进局先读本机；每次 `actionOptions` 变化写回
- 禁止在回列表/读档时无条件 `setActionOptions(开局三键)`
- 快照不存选项：读档保留本机最后一组

---

## 4. 地图 / 技艺 / 历法

- 地图：`RegionMap` SVG + `CATALOG_REGIONS` 坐标，地名与 `exploration.service.ts` 一致。精细图 **I12** 未做。
- 技艺：`listCraftRanks()` 开局 `learned: false`，显示「未习」。
- 天玄历：`GET /api/player/:id` 附带 `current_year`、`current_season`（来自 `world_state`）。

---

## 5. 不要做的

- 地图指令改 `current_location` 或调模型。
- 把坊市/对话加回菜单（除非改规格）。
- 读档成功后 `setLogs([单行])`。
