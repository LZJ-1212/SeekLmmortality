# I06 托管代码与部署架构

依据 [hosting.md](./hosting.md) 的 **L1 最小集**。前端 API 基址 **已落地**（`apiBase.ts`）；隧道与 NSSM 仍须真机。不含云厂商账号与真实域名。

现有 S21 网关、Prisma、Express **不改职责**；I06 只改「谁从哪进、进程谁拉起、前端 API 基址从哪读」。

---

## 0. 本架构拍板（与规格对齐处）

| 项 | 决议 |
|----|------|
| L1 默认拓扑 | **拓扑 B（双 Origin + 隧道）**。不强制先买 VPS、不强制 Nginx。 |
| L1 备选拓扑 | 拓扑 A（单 Origin 反代）留给已有 Nginx/Caddy 或以后上云。 |
| 前端 API 基址 | **已抽** `frontend/src/apiBase.ts`。禁止再在组件里写死 `http://localhost:3000`。未设 `VITE_API_BASE` 时缺省本机 3000。 |
| 环境变量（前端） | `VITE_API_BASE`：空或未设 → `http://localhost:3000`；L1 设为 API 的公网 Origin（无尾斜杠）。**不要**把口令放进 `VITE_*`。 |
| 环境变量（后端） | L1 必配 `PLAY_ACCESS_TOKEN`；`PLAY_CORS_ORIGIN` = 前端公网 Origin；`PORT=3000`；`DATABASE_URL` 仍指本机 MySQL。 |
| MySQL | 只绑 `127.0.0.1:3306`。隧道映射列表**不准出现 3306**。 |
| 公网映射 | 只映射前端端口（默认 5173）与后端端口（默认 3000）。 |
| 隧道产品 | **不锁厂商**（Cloudflare Tunnel / cpolar / ngrok 等）。契约只有：两条公网 URL、HTTPS 更好、能关隧道。 |
| 进程保活 L1 | Windows：**NSSM**（或等价服务包装）各包一层后端与前端；MySQL 用 XAMPP 的 Windows 服务。禁止把「Cursor 里开着的终端」当保活。 |
| L1 前端形态 | 允许继续 `vite` 开发服务器（少一次 build）。不把 Docker 当 L1 门槛。 |
| 明确不做 | Kubernetes、GitHub Actions 自动部署、把 Key 写入隧道 Dashboard 截图进仓库。 |

---

## 1. 拓扑

### 拓扑 B（L1 默认）：双隧道

```
朋友浏览器
  ├─ 页面：  https://front.example.tld  → 隧道 → 127.0.0.1:5173
  └─ API：   https://api.example.tld    → 隧道 → 127.0.0.1:3000
服主机
  ├─ mysqld          127.0.0.1:3306
  ├─ Express         0.0.0.0:3000   （仅本机或仅隧道入口可到）
  └─ Vite            0.0.0.0:5173
```

后端：`PLAY_CORS_ORIGIN=https://front.example.tld`（与地址栏完全一致，含 https、无路径）。  
前端构建/启动环境：`VITE_API_BASE=https://api.example.tld`。  
创角/局内请求带的令牌值 = 后端 `PLAY_ACCESS_TOKEN`（在**存档列表**页填写，不是创角页）。

### 拓扑 A（备选）：单 Origin

```
朋友浏览器  https://play.example.tld
                ├─ /        → 127.0.0.1:5173
                └─ /api     → 127.0.0.1:3000
```

此时 `VITE_API_BASE` 为空字符串，请求走相对路径 `/api/...`（与页面同源）。`PLAY_CORS_ORIGIN` 仍设为该公网 Origin。L1 不强制先做本拓扑。

---

## 2. 前端 API 基址（已落地）

组件禁止再硬编码 `http://localhost:3000`。统一：

```
frontend/src/
└── apiBase.ts          # getApiBase(): string
└── playToken.ts        # apiFetch 附 X-Play-Token
```

约定：

- `getApiBase()` 读 `import.meta.env.VITE_API_BASE`，去掉尾 `/`；未设则 `http://localhost:3000`。
- 拓扑 A：`VITE_API_BASE` 设为 `''`，`apiFetch('/api/...')` 走相对路径。
- **禁止**新增第二套 `fetch` 基址。库存档 UI（I05）也必须用 `getApiBase()`。
- Vite 环境变量只有启动时注入：改 `.env` 后要重启 `npm run dev`。L1 用 `frontend/.env.local`（已 gitignore 的 `.env*` 规则须确认 `!.env.example` 仍在；**不要**提交含真实域名的 `.env.local`）。

仓库已有 `frontend/.env.example`（只写注释，不要填真实域名）：

```
# VITE_API_BASE=          本机留空即 localhost:3000；L1 填 API 公网 Origin
```

---

## 3. 后端改动

L1 **可以零改 Express 路由**，只配环境变量。若 CORS 精确匹配失败（带/不带 www、http vs https），先改隧道 URL 与 `PLAY_CORS_ORIGIN`，不要改成 `origin: true` 对全世界放开。

可选（非最小集）：健康检查仍用 `GET /api/ping`（不口令），供你自己探活；不要把 ping URL 当「公开监控面板」群发。

---

## 4. 进程与保活

| 进程 | L1 保活 |
|------|---------|
| MySQL（XAMPP） | 安装为 Windows 服务，开机启动 |
| `backend`：`npm run dev` 或 `npx tsx watch server.ts` | NSSM 服务，失败重启；工作目录为 `backend/`，环境变量从系统或 NSSM 面板注入（含 `DATABASE_URL`、`DEEPSEEK_API_KEY`、`PLAY_ACCESS_TOKEN`、`PLAY_CORS_ORIGIN`） |
| `frontend`：`npm run dev -- --host` | 须 `--host` 否则隧道打到 5173 可能只听 localhost。NSSM 同上，工作目录 `frontend/`，注入 `VITE_API_BASE` |
| 隧道客户端 | 厂商自带开机启动即可 |

NSSM 的可执行文件路径、本机目录 **不写进 Git**。架构只规定「用服务包装，不用 Cursor 终端」。

崩溃策略：服务异常退出后自动重启，间隔 ≥ 5s，避免 Key 与端口打满。不要求集群。

---

## 5. 环境变量清单（L1）

**后端 `backend/.env`（不入库）**

| 名 | L1 |
|----|-----|
| `DATABASE_URL` | 本机 MySQL |
| `DEEPSEEK_API_KEY` | 必填才能叙事 |
| `PORT` | 默认 3000 |
| `PLAY_ACCESS_TOKEN` | **公网必填** |
| `PLAY_CORS_ORIGIN` | 拓扑 B：前端公网 Origin |
| `ACTION_DAILY_LIMIT` | 可选，默认 60 |

**前端 `frontend/.env.local`（不入库）**

| 名 | L1 |
|----|-----|
| `VITE_API_BASE` | 拓扑 B：API 公网 Origin；本机开发不设 |

---

## 6. 开工顺序（剩下的是真机）

1. ~~落地 `apiBase.ts`~~ **已做**。本机不设 `VITE_API_BASE` 时打 localhost:3000。  
2. 给朋友玩：配口令与 CORS，设 `VITE_API_BASE` 为 API 公网 Origin，开隧道；用第二台设备或无痕验证。  
3. 再包 NSSM；先手动能玩再保活。  

禁止未改基址就只开前端隧道：朋友请求会打到他们自己的 3000。

---

## 7. 测试清单（最小集）

| 测什么 | 方式 |
|--------|------|
| 未设 `VITE_API_BASE` 时基址为本机 3000 | 纯函数或读 env 的单测（若抽纯函数） |
| 设了基址时 `apiFetch` 拼对 URL 且仍带令牌头 | 同上 |
| 前端 `npm run build` | 必做 |
| 真隧道 | **手工**；不写进 CI |

不测厂商 SDK。不测 NSSM。

---

## 8. 明确不做（本架构）

- 把穿透 token 写进 `mcp.json` 或 README  
- 映射 3306  
- 为 I06 新建 Express 部署专用仓库  
- 用 GitHub Pages / 纯静态托管  
- 在网关里为「本机 IP」开后门绕过口令  

操作备忘（开机点哪里）实现后补进 [runbook.md](./runbook.md) 新节，**仍不写真实 URL**。接口契约见 [api.md](./api.md)。
