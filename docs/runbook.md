# 本机运行手册（Runbook）

修订：2026-09-05 01:25 +08 lzj — 多口令逗号分隔，好友存档互不可见
修订：2026-09-05 01:22 +08 lzj — 服主用本机 5174 看全部存档
修订：2026-09-05 01:31 +08 lzj — 游玩 worktree 与更新服 3001/5175 分开
修订：2026-09-05 01:39 +08 lzj — 发版改 VERSION，merge 进 play-live

面向：你自己开发，以及 L1 时告诉朋友「电脑上怎么开」（朋友若连的是你的穿透地址，则只需浏览器，不必装 XAMPP）。

## 1. 依赖

- Windows 10/11
- [XAMPP](https://www.apachefriends.org/)：只需 **MySQL**（端口 3306）。Apache 不是本游戏必需。
- Node.js 22（仓库曾在 v22 下测过）
- 本仓库路径自便；后端读 `backend/.env`

## 2. 数据库

1. 打开 XAMPP Control Panel，Start **MySQL**。
2. 用 phpMyAdmin 或命令行创建库：`wendaocs`（utf8mb4）。
3. `backend/.env` 示例（**不要提交 Git**）：

```
DATABASE_URL="mysql://root:@localhost:3306/wendaocs"
DEEPSEEK_API_KEY="sk-你的密钥"
PORT=3000
```

无密码的 XAMPP 默认用户是 `root`、密码为空，与上面一致。

4. 在 `backend` 目录：

```
npx prisma generate
npx prisma db push
```

若 `query_engine-windows.dll.node` 报 EPERM：先停掉 `tsx watch` 再 generate。

## 3. 启动后端

```
cd backend
npm install
npm run dev
```

看到「天道服务器已启动，正监听端口: 3000」。自检：浏览器打开 `http://localhost:3000/api/ping`。

AI 自检（耗 Key）：`http://localhost:3000/api/ai-ping`。

## 4. 启动前端

另开终端：

```
cd frontend
npm install
npm run dev
```

给朋友试玩时必须加 `--host`（让隧道打到 5174），见第 6 节：

```
npm run dev -- --host
```

Vite 固定 **http://localhost:5174**（`strictPort`，被占用则启动失败而不是换端口）。创角/行动请求打到 `http://localhost:3000`（基址由 `frontend/src/apiBase.ts` 读取 `VITE_API_BASE`，未设则缺省本机 3000）。若改后端端口，须设 `VITE_API_BASE` 或改 `apiBase.ts` 缺省值。

## 5. 测试

```
cd backend
npm test
```

前端：`npm run build` 做类型检查 + 打包。

## 6. 给朋友玩（L1，你的电脑当服）

规格与拓扑见 [hosting.md](./hosting.md)、[hosting_architecture.md](./hosting_architecture.md)。L1 默认 **拓扑 B（双隧道）**。下面按「从零到朋友能创角」写，仓库里**只写占位域名**，真实隧道 URL 和口令不要提交 Git。

**先搞清楚在跑什么。** 朋友玩的是**你电脑上的游戏**。必须同时有：

| 东西 | 作用 | 端口 |
|------|------|------|
| MySQL（XAMPP） | 存档 | 3306，**只留本机，禁止映射公网** |
| 后端 `npm run dev` | 规则 + AI | 3000 |
| 前端 `npm run dev -- --host` | 网页 | 5174 |
| 两条隧道 | 把 5174 / 3000 接到公网 | 无 |

你关机、关终端、隧道进程退出 → 朋友立刻玩不了。未配 `PLAY_ACCESS_TOKEN` **禁止**开隧道。改代码请用第 7 节的更新服，不要在这份目录对 3000 开 `tsx watch`。

### 6.1 本机先自己能玩

完成本手册第 2–4 节，本机 `http://localhost:5174` 能创角并走出一步行动。

### 6.2 配游玩口令

`backend/.env` 增加（值自己定，不要写进仓库、不要发群）。**多个朋友要互看不见存档时，用逗号写多个口令**（口令本身不要含逗号），每人私发一条不同的：

```
PLAY_ACCESS_TOKEN=口令甲,口令乙,口令丙
```

只写一个口令时，持该口令的人仍共用一个存档仓。dotenv 只在进程启动时读一次：改完必须重启后端。

创角时把所用口令的哈希写入存档。公网列表/行动/读档只看见该仓。服主看全部：浏览器打开 `http://localhost:5174`，令牌留空（本机页会打本机 3000，不走隧道）。改口令前已经开好的旧档（哈希为空）公网不会列出，须用新口令再开仙途。

### 6.3 启动前端（必须 `--host`）

另开终端：

```
cd frontend
npm run dev -- --host
```

不加 `--host` 时 Vite 只听 localhost，隧道打 5174 会失败。看到 `Local: http://localhost:5174/` 即可。

### 6.4 开两条 Cloudflare quick tunnel

本机已装 `cloudflared`（scoop：`scoop install cloudflared`）。再开两个终端：

```
cloudflared tunnel --url http://localhost:5174 --no-autoupdate
```

```
cloudflared tunnel --url http://localhost:3000 --no-autoupdate
```

各会打印一行 `https://….trycloudflare.com`：

- 5174 那条 = **前端 Origin**（朋友地址栏打开的网址）
- 3000 那条 = **API Origin**（朋友看不到，但浏览器请求必须打到这里）

每次重启 `cloudflared`，这两条 URL **都会变**，必须重做 6.5–6.6。

（也可用 ngrok / cpolar，契约相同：两条公网 URL，分别转到 5174 与 3000。）

### 6.5 把两条 URL 写进配置

`backend/.env`（与地址栏完全一致：含 `https://`、无尾斜杠、无路径）：

```
PLAY_CORS_ORIGIN=https://front.example.tld
```

新建 `frontend/.env.local`（已 gitignore，勿提交）：

```
VITE_API_BASE=https://api.example.tld
```

把占位符换成 6.4 拿到的真实隧道。Vite 只在启动时注入环境变量。

### 6.6 重启前后端

改完 `.env` / `.env.local` 后：

1. 后端终端 `Ctrl+C`，再 `npm run dev`
2. 前端终端 `Ctrl+C`，再 `npm run dev -- --host`

后端启动日志里 `injected env` 的数量应包含口令与 CORS（本机开发未配口令时会少两项）。

前端 `vite.config.ts` 已放行 `.trycloudflare.com`；若换别的隧道域名出现 403，把该后缀加进 `server.allowedHosts`。

### 6.7 发给朋友（私发）

从 `backend/.env` 复制**该朋友自己的那一条**口令（不要把整串逗号列表发给同一个人）。私聊发送：

```
游戏地址：https://front.example.tld
口令：（只发这一位道友的口令）

打开网页 → 填口令 → 新开仙途 / 进已有存档。
链接勿外传；我关机你就玩不了。各持一口令，看不见别人的仙途。
```

**禁止**把 `DEEPSEEK_API_KEY`、本机路径、真实隧道 URL 写进公开 README 或群公告。

### 6.8 朋友怎么操作

只需浏览器，不必装 Node / MySQL：

1. 打开前端 URL（先到存档列表）
2. **在存档页填写与服主相同的口令**（写入 sessionStorage；创角页不再填）
3. 点「新开仙途」或进入已有存档
4. 进局后左侧指令：面板・修炼・突破・悟道・洞府・地图・背包・宗门・技艺・情缘・存档・读档（**手机竖屏尚未适配**；规格见 [command_ui.md](./command_ui.md)）

### 6.9 你自己先当朋友测一遍

用**无痕窗口**打开前端公网 URL，走完「存档页填口令 → 创角 → 一条行动」。

对照：

- 创角成功、行动有叙事 → 通了
- 401 / 「未授令牌」→ 口令与 `PLAY_ACCESS_TOKEN` 不一致，或后端没重启
- 页面打不开 / 前端隧道 403 → `--host`、隧道是否指向 5174、`allowedHosts`
- CORS 报错、请求打到朋友自己的 localhost → `PLAY_CORS_ORIGIN` 与地址栏不一致，或 `VITE_API_BASE` 没设 / 前端没重启
- F12 网络里 `/api/action` 的 Host 应是 **API 隧道域名**，不是朋友电脑的 `localhost`

### 6.10 拓扑 A 与保活（可选）

**拓扑 A（单 Origin 反代）**：Nginx/Caddy 把 `/` 转 5174、`/api` 转 3000。此时 `VITE_API_BASE` 设为空字符串（相对路径 `/api`），`PLAY_CORS_ORIGIN` 仍等于该公网 Origin。

**保活**：L1 不强制。要开机自启用 NSSM 包后端/前端，MySQL 用 XAMPP 的 Windows 服务；隧道客户端用厂商自带开机项。做不到就在朋友须知写「需服主手动开」。固定域名（named tunnel）需自有域名托管到 Cloudflare，与 quick tunnel 不是同一套配置。

## 7. 游玩与更新分开

朋友走 **3000 / 5174** 和隧道。你改代码走 **另一份目录 + 3001 / 5175 + 库 `wendaocs_dev`**。这样存盘、HMR、`tsx watch`、`prisma generate` 都碰不到正在玩的那一套。

### 7.1 游玩目录（旁路 worktree）

在仓库的**上一级**另放一份，不要和 Cursor 正在改的这份混用：

```
git worktree add -b play-live ../SeekLmmortality-play lzj
```

（本仓库已经占着分支 `lzj`，游玩目录用分支 `play-live`，避免抢同一分支。）

只在这份里给朋友开服。后端 **不要** `tsx watch`：

```
cd ../SeekLmmortality-play/backend
npm run play
```

```
cd ../SeekLmmortality-play/frontend
npm run play
```

隧道仍打 **5174** 与 **3000**。`.env` / `.env.local` 从你现在这份拷过去（勿提交）。口令、CORS、Key 与现在相同；库名仍是 `wendaocs`。

### 7.2 更新（本仓库）

复制 `backend/.env.update.example` 为 `backend/.env.update`，库名 `wendaocs_dev`（XAMPP 里建一次即可）。然后：

```
cd backend
npm run dev:update
```

```
cd frontend
npm run dev:update
```

浏览器打开 `http://localhost:5175`。本机 5175 会打 **3001**，用实验库，看不见朋友正在玩的档，也不会改他们的表。

### 7.3 什么时候才把更新同步给朋友

平时改 Cursor 这份（5175）**不会**改他们的存档。但若朋友的隧道仍打在这份仓库的 `tsx watch` 上，你一存盘他们会跟着重启。迁到 `SeekLmmortality-play` 并用 `npm run play` 之后才真正隔离。

要让他们升到最新：

1. 发版前改仓库根目录 `VERSION`（如 `0.2.0` → `0.3.0`），提交到 `lzj`。
2. 停游玩目录的后端（短暂停服）。
3. 在 `SeekLmmortality-play` 执行 `git merge lzj`。
4. 按需 `npm install`；该目录 `npx prisma generate`；若改了表再 `db push`（动的是 `wendaocs`）。
5. 再开后端、前端的 `npm run play`。隧道没关就不用重发链接。
6. 存档页应显示新的「版本 x.y.z」。若出现「界面 A · 天道 B」，把游玩目录的前后端都重启。

**不要**在 Cursor 这份仓库里对 3000 开 `tsx watch`，否则一存盘朋友的后端会重启。

## 8. 常见故障

| 现象 | 处理 |
|------|------|
| ping 失败 | MySQL 没开，或 `.env` 库名不是 `wendaocs` |
| 创角失败 | 后端没开；口令错（401）；或 CORS（公网须 `PLAY_CORS_ORIGIN` 等于前端 Origin） |
| 踏入仙途无反应 | 看浏览器 F12 网络；后端 console |
| DeepSeek 失败 | Key 错、欠费、或没配 `.env` |
| Prisma unlink EPERM | 停**正在 generate 的那份目录**里的后端；游玩目录与更新目录分开则互不抢 DLL |
| 前端隧道 403 | Vite `allowedHosts`；quick tunnel 已放行 `.trycloudflare.com` |
| 朋友请求打到他自己的 localhost | 未设 `VITE_API_BASE` 或前端没重启 |
| 隧道一重启朋友打不开 | quick tunnel URL 变了，重做第 6.5–6.6 节并重发链接 |

## 9. 不要做的事

- 把 `.env`、`.env.local`、真实口令、真实隧道域名提交 GitHub
- 把 `DEEPSEEK_API_KEY` 写进前端
- 未配 `PLAY_ACCESS_TOKEN` 就做端口映射 / 开隧道
- 把 3306、phpMyAdmin、XAMPP 暴露公网
- 用 GitHub Pages 托管本游戏（没有 Express 与 MySQL）
