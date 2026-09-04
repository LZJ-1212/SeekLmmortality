---
name: start-local-dev
description: >-
  Starts SeekLmmortality for play, including L1 friend access (MySQL, backend :3000,
  frontend :5174 --host, PLAY_ACCESS_TOKEN, dual Cloudflare tunnels, CORS and VITE_API_BASE).
  Use when the user asks to 启动, 开机, 给朋友玩, 开隧道, cloudflared, --host, or bring up servers.
---

# 启动《问道长生》（含给朋友玩）

权威步骤：`docs/runbook.md` 第 2–4 节（本机）+ **第 6 节（L1 双隧道）**。规格铁律：`docs/hosting.md`。

修订：2026-09-05 01:25 +08 lzj — 多口令时每人私发一条

用户说「启动」= 按第 6 节把朋友也能打开的那套拉起来，不是只开本机 Vite。仅当用户明确说「只本机、不开隧道」时跳过 3 节以后。

## 约束

- Windows PowerShell：不要用 bash 的 `&&`。
- 后端：`backend` 下 `npm run dev`（`tsx watch server.ts`）。Vite 固定 **5174**。API **3000**。MySQL **3306** / `wendaocs`。**禁止**把 3306 映射公网。
- **未配置 `PLAY_ACCESS_TOKEN`：禁止开隧道、禁止端口映射。** 只检查键是否存在，**不要**把口令、`DEEPSEEK_API_KEY`、真实隧道 URL 写进 Git、README、skill、或公开回复。私聊稿只打在给主人的对话里。
- 改 `.env` / `.env.local` 后必须重启对应进程（dotenv / Vite 只在启动时读）。
- 已有 `tsx watch` / `vite` / `cloudflared` 占着端口则先复用或先停再开，不要抢端口再起一份。

## 1. 本机底座

1. 确认 `127.0.0.1:3306` 通（XAMPP 只开 MySQL）。
2. `backend/.env` 有 `DATABASE_URL`、`DEEPSEEK_API_KEY`、**`PLAY_ACCESS_TOKEN`**。多个朋友互不可见时用逗号多口令。缺口令则停下告诉主人去配，不要继续。
3. 后端：`cd backend` → `npm run dev`，等到「天道服务器已启动，正监听端口: 3000」。
4. 自检：`http://localhost:3000/api/ping`。不要默认打 `/api/ai-ping`。

## 2. 前端必须 `--host`

`vite.config.ts` 已 `host: true`。直接：

```
cd frontend
npm run dev
```

等到 `Local: http://localhost:5174/` 且出现 Network 地址。若被改回只听 localhost，再用 `npm run dev -- --host`。不加 host 时，本机 cloudflared 打 localhost 仍可能通，但按手册必须 host。

## 3. 双隧道（拓扑 B）

本机 `cloudflared`（scoop：`cloudflared.exe`）。两个终端：

```
cloudflared tunnel --url http://localhost:5174 --no-autoupdate
```

```
cloudflared tunnel --url http://localhost:3000 --no-autoupdate
```

各打出 `https://….trycloudflare.com`：

- 5174 = 前端 Origin（朋友地址栏）
- 3000 = API Origin（`VITE_API_BASE`）

quick tunnel **每次重启 URL 都变**，必须重做第 4–5 节并重发链接。3306 不要进隧道。

## 4. 写配置（gitignore，勿 git add）

`backend/.env`（与地址栏完全一致：`https://`、无尾斜杠、无路径）：

```
PLAY_CORS_ORIGIN=https://<前端隧道>
```

`frontend/.env.local`：

```
VITE_API_BASE=https://<API隧道>
```

本机 `http://localhost:5174` 仍应能玩（CORS 始终放行本机）。

## 5. 重启前后端

1. 停后端，再 `npm run dev`
2. 停前端，再 `npm run dev -- --host`

启动日志 `injected env` 应能读到口令与 CORS。

## 6. 验收与私发

- 本机：`5174` 能进存档；`3000/api/ping` 通。
- 无痕窗口打开**前端公网 URL** → 存档页填**自己那一条**口令 → 创角或进档 → 一条行动。换另一口令应看不见上一仓的档。
- 朋友 F12：`/api/action` 的 Host 必须是 **API 隧道**，不是朋友电脑的 localhost。
- 私发草稿（每人一条口令，从 `.env` 逗号列表拆开；agent 不要在仓库里写出）：

```
游戏地址：<前端隧道>
口令：（只发这一位的口令）
打开网页 → 填口令 → 新开仙途 / 进已有存档。
链接勿外传；我关机你就玩不了。
```

## 故障（先对这个再猜代码）

| 现象 | 处理 |
|------|------|
| 401 / 未授令牌 | 口令不一致，或后端没在设口令后重启 |
| 前端隧道 403 | 未 `--host`；或 `allowedHosts` 未放行该后缀 |
| 请求打到 localhost:3000 | 未设 `VITE_API_BASE` 或前端没重启 |
| CORS | `PLAY_CORS_ORIGIN` 必须等于地址栏 Origin |
| ping 失败 | MySQL / `DATABASE_URL` |
| Prisma EPERM | 先停 `tsx watch` 再 `generate` |

## 不要做

- 提交 `.env`、`.env.local`、口令、Key、真实隧道域名。
- 未配口令就开隧道。
- 把 3000 裸映射当「上线」。
- 为启动去灌 Prisma 7 / 乱 `migrate`。
