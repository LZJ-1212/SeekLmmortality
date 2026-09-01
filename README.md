# 问道长生（SeekLmmortality）

浏览器里的文字修仙：自然语言输入行动，**气血、修为、寿元、战斗与雷劫由后端硬算**，大模型只负责把既定结果写成剧情。生死有命，天道无常。

当前是可在本机完整体验的原型（创角、十二系统主路径、宣纸风 UI），不是上架商店的成品。声音、功法构筑、账号与公网鉴权仍在规格阶段。

## 和常见「AI 套皮修仙」的差别

- **防作弊**：突破、越境秒杀、闭关修为、坊市计价等走 Node 拦截器，再把 `forcedOutcome` 注入提示词；模型不能改你的数值。
- **全自由输入**：快捷指令与自然语言并存；意图分类与注入过滤见规划文档，**代码尚未上线**。
- **存档在 MySQL**：玩家、世界时钟、背包、宗门、人际关系、快照均落库。

## 技术栈

| 层 | 实现 |
|----|------|
| 前端 | `frontend/` · React 19 + Vite + Tailwind CSS v3 |
| 后端 | `backend/` · Express + TypeScript + Prisma 5 |
| 数据库 | 本地 MySQL（XAMPP 3306，库名 `wendaocs`） |
| 叙事 | DeepSeek（OpenAI 兼容接口）；密钥只放 `backend/.env` |

许可证：[MIT](./LICENSE)。本仓库 **不含** API Key；请勿把 `.env` 提交上来，也请勿对来路不明的服务器压测。

## 本机运行

需要：Windows、[XAMPP](https://www.apachefriends.org/) 的 MySQL、Node.js 22。逐步说明与排障见 [docs/runbook.md](./docs/runbook.md)。

1. 启动 MySQL，创建库 `wendaocs`（utf8mb4）。
2. 在 `backend/` 建立 `.env`（不要提交 Git）：

```
DATABASE_URL="mysql://root:@localhost:3306/wendaocs"
DEEPSEEK_API_KEY="sk-你的密钥"
PORT=3000
```

3. 初始化并启动后端：

```
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

4. 另开终端启动前端：`cd frontend && npm install && npm run dev`  
   浏览器打开 **http://localhost:5173**（接口默认打 `http://localhost:3000`）。

5. 后端测试：`cd backend && npm test`

**不要**把 3000 端口裸映射到公网：`/api/action` 目前无鉴权，别人能用你的 DeepSeek 额度。给朋友试玩前先做 [意图与安全网关](./docs/intent_gateway.md) 的最小集，并用带密码的穿透或反代。

## 仓库结构

```
frontend/     创角与主界面
backend/      天道服务器、Prisma、Vitest
docs/         设计规格与运行手册
.cursor/      协作规则与 MCP 示例（真机 mcp.json 已忽略）
```

## 文档

总目：[docs/README.md](./docs/README.md)

| 想看什么 | 打开 |
|----------|------|
| 天道法则与 UI 铁律 | [docs/game_design.md](./docs/game_design.md) |
| 完成度、测试、上线判断 | [docs/project_status.md](./docs/project_status.md) |
| HTTP 接口 | [docs/api.md](./docs/api.md) |
| 地区 / 配方 / 命格表 | [docs/content_catalog.md](./docs/content_catalog.md) |

规划中（有规格、无实现）：功法神通、安检网关、大事记、灵兽、天下大势、多结局；声音系统规格已确认。

## 现状与边界

- 玩法主路径可跑；前端几乎无自动化测试；无正式 E2E。
- 无账号、无支付、无限流；适合作者自玩或少数熟人，不适合把你的 Key 开放给陌生人。
- 剧情与系统日志不使用 emoji；界面配色以宣纸 / 青玉主题为准。

议题与合作欢迎开 Issue。自己架设时请自备数据库与模型密钥。
