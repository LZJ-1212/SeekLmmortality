---
name: start-local-dev
description: >-
  Starts SeekLmmortality for play or for local coding. Play: sibling worktree
  SeekLmmortality-play, backend npm run play (:3000, no watch), frontend npm run play
  (:5174), PLAY_ACCESS_TOKEN, dual Cloudflare tunnels. Local coding: this repo
  npm run dev:update (3001 / 5175 / wendaocs_dev). Use when the user asks to 启动,
  开机, 给朋友玩, 开隧道, 改代码, 本机实验, cloudflared, or --host.
  Do not use when the user says 更新 or 发版 (that is update-play-release).
---

# 启动《问道长生》（游玩 / 更新分开）

权威步骤：`docs/runbook.md` 第 2–4 节 + **第 6 节（隧道）** + **第 7 节（游玩 vs 更新）**。规格：`docs/hosting.md`。

修订：2026-09-05 01:25 +08 lzj — 多口令时每人私发一条
修订：2026-09-05 01:31 +08 lzj — 游玩用旁路 worktree，更新用 3001/5175
修订：2026-09-05 01:39 +08 lzj — 发版改 VERSION 再 merge 游玩目录
修订：2026-09-05 01:48 +08 lzj — 「更新」改走 update-play-release skill

## 先分清用户要哪套

| 用户说法 | 用哪套 |
|----------|--------|
| 启动、开机、给朋友玩、开隧道 | **游玩**：`../SeekLmmortality-play`，端口 **3000 / 5174**，库 `wendaocs`，后端 **`npm run play`（无 watch）** |
| 只本机、不开隧道、改代码、本机实验 | **实验**：当前 Cursor 仓库，**3001 / 5175**，库 `wendaocs_dev`，`npm run dev:update` |
| 更新、发版、升版本、给朋友更新 | **不要走本节**。读并执行 `.cursor/skills/update-play-release/SKILL.md` |

**禁止**在 Cursor 这份目录对 3000 开 `tsx watch`：一存盘朋友的后端会重启。Prisma generate 只对**当前目录**的 `node_modules` 动手，两套目录互不抢 DLL。

## 约束

- Windows PowerShell：不要用 bash 的 `&&`。
- MySQL **3306**。**禁止**映射公网。
- **未配置 `PLAY_ACCESS_TOKEN`：禁止开隧道、禁止端口映射。** 不要把口令、`DEEPSEEK_API_KEY`、真实隧道 URL 写进 Git、README、skill、或公开回复。
- 改 `.env` 后必须重启对应进程。
- 已有进程占着目标端口则先复用或先停再开。

## A. 给朋友玩（worktree）

若还没有旁路目录：

```
git worktree add -b play-live ../SeekLmmortality-play lzj
```

拷贝 `backend/.env` 与 `frontend/.env.local`（勿 git add）。在 worktree 里 `backend` / `frontend` 各 `npm install`。后端 `npx prisma generate`（库仍是 `wendaocs`，不要对实验库 push）。

1. MySQL 3306 通。
2. worktree `backend`：`npm run play`，等到监听 **3000**。
3. worktree `frontend`：`npm run play`，等到 **5174** 且 `--host`。
4. 双隧道仍打 5174 与 3000（步骤同手册第 6.4–6.6）。未配口令则停下。

## B. 本机改代码（本仓库，不是给朋友发版）

1. `backend/.env.update` 存在（从 `.env.update.example` 复制），`PORT=3001`，库 `wendaocs_dev`。库不存在则建。
2. `cd backend` → `npm run dev:update`，等到 **3001**。
3. `cd frontend` → `npm run dev:update`，等到 **5175**。
4. 本机打开 `http://localhost:5175`。不要动 3000/5174 上的游玩进程。
5. 自检 `http://localhost:3001/api/ping`。不要默认打 `/api/ai-ping`。

把代码发给朋友：用户说「更新」时走 `update-play-release`（bump `VERSION`、merge `play-live`、重启 `npm run play`）。本节不要 bump 版本、不要停 3000。

## 故障

| 现象 | 处理 |
|------|------|
| 401 | 口令不一致，或游玩后端没在改口令后重启 |
| 改代码朋友掉线 | 误在游玩目录 watch，或误对 `wendaocs` db push |
| 5175 打到朋友的档 | 前端不是 5175，或 apiBase 未更新 |
| Prisma EPERM | 停**这一份**目录的后端再 generate |
| CORS | 游玩 `PLAY_CORS_ORIGIN` 等于朋友地址栏 |

## 不要做

- 提交 `.env`、`.env.local`、`.env.update`、口令、Key、真实隧道域名。
- 未配口令就开隧道。
- 把 3000 裸映射当「上线」。
- 为启动去灌 Prisma 7 / 乱 `migrate`。
- 在更新服对 `wendaocs`（游玩库）做 `db push`。
