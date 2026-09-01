# 技术架构（已实现部分）

给后来改代码的人看「东西在哪、原则是什么」。声音未实现部分见 [audio_architecture.md](./audio_architecture.md)。接口清单见 [api.md](./api.md)。

---

## 1. 仓库布局

| 路径 | 职责 |
|------|------|
| `frontend/` | React + Vite + Tailwind v3；宣纸 UI；`apiBase.ts` + `apiFetch` 附口令头 |
| `backend/` | Express + TypeScript；Prisma 5；拦截器 + Service |
| `backend/prisma/` | 数据模型；MySQL 库名 `wendaocs` |
| `docs/` | 规格与运行说明 |
| `.cursor/rules/project.mdc` | 协作红线（密钥、AI 不结算、禁剧情 emoji） |

密钥只在 `backend/.env`，已 gitignore。

---

## 2. 运行时数据流

1. 玩家在浏览器提交行动文本。
2. `POST /api/action` 先过 S21（口令、净化、黑名单、死亡锁），再 **情境锁**（可能 400，**不占日限**），再日限，再其余拦截器。
3. 多个 **纯函数 Service** 根据关键词与状态硬算，拼 `forcedOutcome`。（宣称奇迹骰为 **A5**，见 [player_agency.md](./player_agency.md)，未接线。）
4. `ai.ts` 以 json_object 调 DeepSeek，只生成 `narrative` 与选项。
5. 后端再写库（气血、时间、背包等），战斗公式覆盖胜负，把结果与 `player` 行返回前端。
6. 前端追加日志、渲染选项与状态卡。

AI 返回的数值增量若与拦截器冲突，以拦截器为准（现有代码路径）。

---

## 3. 后端分层

- **路由**：`server.ts` 主循环偏胖，是历史形态；背包已拆 `inventory.routes.ts`。新系统优先 Service + 薄路由。
- **S21 网关（最小集已实现）：** `backend/src/gateway/`；口令中间件、行动净化、注入黑名单、创角字段上限、`action_daily_quotas` 日限。规格见 [intent_gateway.md](./intent_gateway.md)，目录与顺序见 [intent_gateway_architecture.md](./intent_gateway_architecture.md)。层 E/F 意图分类未做。
- **情境锁：** `situation.service.ts`，规格 [situation.md](./situation.md)。
- **Service**：无 Express 对象；可注入 `rollFn` 做单测。宣称奇迹见 [plausibility.md](./plausibility.md)（A5 未接）。
- **Prisma**：MySQL；JSON 列存灵根、命格、天赋列表等。


---

## 4. 前端要点

- 主界面：`MainGame.tsx`、`StatusCard.tsx`、`CommandMenu.tsx`。视觉与断点见 [ui.md](./ui.md)。指令分发见 [command_ui_architecture.md](./command_ui_architecture.md)。
- 创角：命格选项须与 [content_catalog.md](./content_catalog.md) 一致。
- 无全局状态库；存档 id 在列表页选择。声音：规格有，代码无。
- 玩家自由度：叙事自由、数值由拦截器锁死，见 [player_agency.md](./player_agency.md)。

---

## 5. 测试

- 后端：Vitest，与 `*.service.ts` 同目录 `*.test.ts`。
- 前端：无单测；`npm run build` 作门槛。
- 新纯函数必须带正常路径、边界、失败路径测试（项目惯例）。

---

## 6. 不要做的架构事

- 前端算战斗或修为。
- 把 `DEEPSEEK_API_KEY` 打进 Vite 环境给浏览器。
- 用 GitHub Pages 当完整游戏。
- 第一期在浏览器跑 RVC（见声音规格）。
