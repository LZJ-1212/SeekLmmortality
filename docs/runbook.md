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

Vite 默认 **http://localhost:5173**。创角请求打到 `http://localhost:3000`（写死在组件里）。若改后端端口，须同步改前端 `fetch` 地址。

## 5. 测试

```
cd backend
npm test
```

前端：`npm run build` 做类型检查 + 打包。

## 6. 给朋友玩（L1，你的电脑当服）

1. 本机先能完成本手册 2–4 步。
2. **先做** [intent_gateway.md](./intent_gateway.md) 的口令与日限（未做前不要做端口映射）。
3. 用内网穿透（带访问密码）或 VPS 反代到 `5173` 与 `3000`；不要只映射 3000 且无口令。
4. 朋友只需浏览器打开你给的前端 URL。
5. 你关机 = 他们玩不了。云主机可避免这一点（见 [project_status.md](./project_status.md) L1）。

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
