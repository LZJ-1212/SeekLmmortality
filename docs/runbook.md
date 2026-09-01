# 本机运行手册（Runbook）

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

Vite 默认 **http://localhost:5173**。创角/行动请求打到 `http://localhost:3000`（基址由 `frontend/src/apiBase.ts` 读取 `VITE_API_BASE`，未设则缺省本机 3000）。若改后端端口，须设 `VITE_API_BASE` 或改 `apiBase.ts` 缺省值。

## 5. 测试

```
cd backend
npm test
```

前端：`npm run build` 做类型检查 + 打包。

## 6. 给朋友玩（L1，你的电脑当服）

规格与拓扑见 [hosting.md](./hosting.md)、[hosting_architecture.md](./hosting_architecture.md)。L1 默认**拓扑 B（双隧道）**。

1. 本机先能完成本手册 2–4 步（自己通一遍创角 + 一步行动）。
2. **配口令**：`backend/.env` 写 `PLAY_ACCESS_TOKEN=你的秘密口令`。未配口令**禁止**做端口映射。
3. 前端监听所有网卡：`cd frontend; npm run dev -- --host`（必须带 `--host`，否则隧道打不到 5173）。
4. 开两条内网穿透隧道（ngrok / cpolar / cloudflared 任一，免费档即可）：
   - `ngrok http 5173` → 前端公网 Origin，例如 `https://front.example.tld`
   - `ngrok http 3000` → API 公网 Origin，例如 `https://api.example.tld`
5. **后端配 CORS**：`backend/.env` 加 `PLAY_CORS_ORIGIN=https://front.example.tld`（与地址栏完全一致，含 https、无路径）。
6. **前端配 API 基址**：新建 `frontend/.env.local`（已 gitignore，勿提交），写 `VITE_API_BASE=https://api.example.tld`（无尾斜杠）。
7. 改完 `.env` 后**重启前后端**（Vite 环境变量只在启动时注入）。
8. 私发朋友：前端 URL、口令、「链接勿外传、我关机就停」。

验证：朋友浏览器 F12 网络面板里 `/api/action` 的 Host 应是 `api.example.tld`，而不是他自己的 `localhost`。

**拓扑 A（备选，单 Origin 反代）**：若已有 Nginx/Caddy 把 `/` 转 5173、`/api` 转 3000，则 `VITE_API_BASE` 设为空字符串（走相对路径 `/api`），`PLAY_CORS_ORIGIN` 设为该公网 Origin 即可。

**保活（可选）**：L1 不强制；要「关机后还能被拉起」用 NSSM 包一层后端/前端，MySQL 用 XAMPP 的 Windows 服务。做不到就在朋友须知里写明「需服主手动 `npm run dev`」。

## 7. 常见故障

| 现象 | 处理 |
|------|------|
| ping 失败 | MySQL 没开，或 `.env` 库名不是 `wendaocs` |
| 创角失败 | 后端没开；或 CORS（本机 5173→3000 已开 cors） |
| 踏入仙途无反应 | 看浏览器 F12 网络；后端 console |
| DeepSeek 失败 | Key 错、欠费、或没配 `.env` |
| Prisma unlink EPERM | 停 `npm run dev` 再 generate |

## 8. 不要做的事

- 把 `.env` 提交 GitHub
- 把 `DEEPSEEK_API_KEY` 写进前端
- 用 GitHub Pages 托管本游戏（没有 Express 与 MySQL）
