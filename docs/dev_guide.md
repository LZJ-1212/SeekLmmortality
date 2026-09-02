# 双人开发指南

给一起改《问道长生》的人看：怎么开环境、怎么分分支、先改什么、什么绝对不能做。本机点开游戏的逐步命令见 [runbook.md](./runbook.md)，本文件不重复抄。规格总目 [README.md](./README.md)。排期权威 [roadmap.md](./roadmap.md)。

仓库：`https://github.com/LZJ-1212/SeekLmmortality`

---

## 1. 这是什么项目

修仙文字冒险。气血、境界、胜负、物品由 **Node 后端硬算**；DeepSeek 只写叙事和选项。前端 React + Vite（端口 **5174**），后端 Express + Prisma 5 + MySQL `wendaocs`（端口 **3000**）。对玩家文案用中文；代码标识符用英文（`getCave`，不要 `getDongfu`）。

---

## 2. 第一天必读（按这个顺序）

1. [runbook.md](./runbook.md)：装 XAMPP MySQL、`.env`、`prisma generate` / `db push`、前后端启动。
2. [roadmap.md](./roadmap.md)：阶段 **A→F**。当前主线是 **阶段 B（补已有雏形）**。B 没收束，不要开工法 / 心魔 / 灵兽。
3. [architecture.md](./architecture.md)：路由 → Service → Repository。
4. [player_agency.md](./player_agency.md)：叙事可以胡写；数值零主权。
5. Cursor 规则：`.cursor/rules/project.mdc` 与 `.cursor/rules/项目编码规范与潜规则.mdc`（打开本仓库后会自动带上）。

Windows PowerShell 旧版不要用 bash 的 `&&`。后端入口是 `backend` 下 `npm run dev`（`tsx watch server.ts`），没有 `index.js`。

---

## 3. 分支怎么分

**不要两人同时在 `main` 上直接推。** `main` 只收已经谈拢、测过的合并。

| 分支 | 谁用 |
|------|------|
| `main` | 稳定线；发 PR 合进来 |
| `Loading_line` | 朋友的工作分支（远端已有） |
| `lzj` | 仓库主人这边的工作分支 |

### 你（主人）本地开自己的分支

在仓库根目录（当前若有未提交改动，会跟着切过去，不会丢）：

```
git fetch origin
git checkout main
git pull origin main
git checkout -b lzj
git push -u origin lzj
```

### 朋友第一次

```
git clone https://github.com/LZJ-1212/SeekLmmortality.git
cd SeekLmmortality
git checkout Loading_line
```

若本地还没有该分支：`git fetch origin` 然后 `git checkout Loading_line`。

### 日常同步（两边都要养成习惯）

开工前把 `main` 上别人已合并的提交拉进自己的分支：

```
git fetch origin
git checkout 你的分支
git merge origin/main
```

冲突先谈再改，不要 `git push --force` 到 `main`。也不要改 `git config`。

两人**不要长期改同一批文件**。动手前在聊天里认领 [roadmap.md](./roadmap.md) 的一行（例如你做 I21 加深，朋友做成册 I22），认领了再写代码。

合进 `main`：在 GitHub 开 Pull Request，base 选 `main`，head 选 `lzj` 或 `Loading_line`。标题说清为什么。

---

## 4. 环境与密钥

每人自己的电脑一份 `backend/.env`，**永远不要提交**。也不要提交 `frontend/.env.local`、`.cursor/mcp.json`。

最少需要：

```
DATABASE_URL="mysql://root:@localhost:3306/wendaocs"
DEEPSEEK_API_KEY="sk-你自己的或商量共用的密钥"
PORT=3000
```

给熟人穿透试玩时才会用到 `PLAY_ACCESS_TOKEN`、`PLAY_CORS_ORIGIN`、`VITE_API_BASE`，见 [hosting.md](./hosting.md)。口令和隧道 URL 写在本机 env 里，不要写进文档或 commit。

DeepSeek Key 会烧钱。没有 Key 时：后端仍能起、`npm test` 能跑；创角/行动叙事会失败。不要把 Key 打进前端 Vite 环境。

Prisma **锁定 5**。不要加 `prisma.config.ts`（那是 Prisma 7）。`npx prisma generate` 若 EPERM：先停 `tsx watch`。

---

## 5. 怎么改代码（铁律摘要）

分层：

```
src/routes/*（薄）→ src/services/*（规则 + 可注入骰子）→ src/repositories/*（Prisma）
```

- 新玩法：先对 `docs/*.md`，再纯函数 Service，再挂 `action.service.ts` 拦截器，最后才改 UI。禁止先让模型「演」出数值。
- 随机数必须可注入 `rollFn`（单测里 `() => 0` / `() => 0.99`），禁止拦截器里写死 `Math.random()` 无法测。
- Prisma 只用 `backend/src/db/prisma.ts` 单例。
- 未知地名 / 命格 / 物品名：忽略或默认，不要 throw 把整回合打成 500。
- 前端：函数组件 + Hooks；样式用主题类（`bg-paper`、`border-jade` 等）；剧情和日志禁止 emoji。
- 改配方、地区、命格、功法名：同步 [content_catalog.md](./content_catalog.md)。改境界门槛：同步 [realms.md](./realms.md) 第 5.2 节。

测什么：

- 后端：与 Service 同目录 `*.service.test.ts`，`cd backend` 后 `npm test`。
- 前端改 UI 后：`cd frontend` 后 `npm run build`。

---

## 6. 现在该做什么

看 [roadmap.md](./roadmap.md) 阶段 B 表。已经成册的：**I20 岁月**、**I21 境界**（加深代码未落地）。下一刀通常是 I21 加深（[realms_architecture.md](./realms_architecture.md)）或成册 **I22** `combat.md`。

不要跳到阶段 C～F 去「更修仙」。进度感觉见 [project_status.md](./project_status.md)。

---

## 7. 常见踩坑

| 现象 | 先查 |
|------|------|
| 端口不是 5174 / 3000 | 前后端必须一起改；Vite `strictPort` |
| 创角「沟通天道失败」 | 后端没起、Key 空、或手机页打到了 `localhost`（要用 `VITE_API_BASE`） |
| `prisma generate` EPERM | 停掉 `tsx watch` |
| 行动「天机反噬」 | 看后端终端真实报错；自定义物品消耗已按名处理，其它 throw 仍会 500 |
| 两人改同一文件合不进去 | 事先认领 roadmap 行 |

本机故障逐步说明仍以 [runbook.md](./runbook.md) 为准。
