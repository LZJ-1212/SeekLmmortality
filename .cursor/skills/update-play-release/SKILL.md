---
name: update-play-release
description: >-
  Bumps VERSION and deploys the current lzj branch to the friend play worktree
  (SeekLmmortality-play / play-live, ports 3000 and 5174). Use when the user
  says 更新, 发版, 升版本, 给朋友更新, or wants the live play copy to match latest.
---

# 把朋友游玩升到最新

权威步骤：`docs/runbook.md` 第 7.3 节。规格不替代口令与 CORS。

修订：2026-09-05 01:48 +08 lzj — 创建：说「更新」才 bump VERSION 并 merge 游玩目录

**只有用户明确说「更新 / 发版 / 升版本 / 给朋友更新」时才执行本 skill。** 改代码、本机 5175、开隧道走 `start-local-dev`，不要在那些话里 bump 版本或停 3000。

## 约束

- Windows PowerShell：不要用 bash 的 `&&`。
- 游玩目录：`../SeekLmmortality-play`，分支 `play-live`。隧道继续打 **5174 / 3000**，**不要**为发版重启 cloudflared（URL 会变）。
- 不要提交 `.env`、口令、Key、真实隧道。不要把口令写进回复。
- 不要对实验库 `wendaocs_dev` 做游玩目录的 `db push`。游玩库是 `wendaocs`。
- Prisma generate 前先停**游玩目录**后端，避免 EPERM。

## 流程

1. **改版本号。** 读仓库根 `VERSION`（`x.y.z`）。默认 **补丁 +1**（`0.2.0` → `0.2.1`）。用户说大更新 / 新玩法再加 **y**。只写数字一行，不要注释。
2. **让 git 带上这版。** `VERSION` 以及本次要发给朋友的代码必须在 `lzj` 上。未提交则按仓库惯例提交（中文说明写进文件修订行；commit message 英文 `chore: bump play version to x.y.z`，若还有功能改动用 feat/fix 概括），再 `git push origin lzj`。用户若明确不要 commit，停下说明：不进 git 则游玩目录 merge 不到。
3. **停游玩进程**（不要停隧道）：结束占用 **3000** 且 cwd 为 play worktree（或误跑在本仓库的 `tsx watch`）的后端；结束 **5174** 的 Vite。本仓库的 **3001 / 5175** 不要动。
4. **同步代码。**

```
cd ../SeekLmmortality-play
git merge lzj
```

冲突先停下来告诉主人。`package-lock` 有变则在 `backend`、`frontend` 各 `npm install`。
5. **库。** `backend`：`npx prisma generate`。仅当 `schema.prisma` 相对上一游玩版本有改时 `npx prisma db push`（连的是该目录 `.env` 的 `wendaocs`）。
6. **再开游玩。**

```
cd backend
npm run play
```

```
cd frontend
npm run play
```

等到「监听端口: 3000」和 Vite `5174`。
7. **验收。** `http://localhost:3000/api/ping` 的 `version` 等于刚 bump 的号。告诉主人新版本号、朋友无需换链接（隧道没关的话）。

## 不要做

- 把「更新」理解成本机 `dev:update`（那是 5175 实验服）。
- 重启 quick tunnel。
- force push、改 git config、提交 `.env`。
