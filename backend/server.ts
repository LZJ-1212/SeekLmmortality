import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { requirePlayToken, isAllowedCorsOrigin } from './src/gateway';
import healthRoutes from './src/routes/health.routes';
import playerRoutes from './src/routes/player.routes';
import actionRoutes from './src/routes/action.routes';
import talentsRoutes from './src/routes/talents.routes';
import savesRoutes from './src/routes/saves.routes';
import inventoryRoutes from './src/routes/inventory.routes';

/**
 * 天道服务器入口：只做「组装 + 挂载 + 启动」，不含任何业务逻辑。
 * - 业务逻辑在 src/services/*
 * - 路由适配在 src/routes/*
 * - 安全网关在 src/gateway/*
 */

// 加载 .env 环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置：允许跨域请求和解析 JSON
// S21 / I06：配了 PLAY_CORS_ORIGIN 则只放行该（逗号分隔）列表 + 本机开发端口（5174/5173），避免隧道配置把 localhost 创角卡死
const playCorsOrigin = process.env.PLAY_CORS_ORIGIN;
if (playCorsOrigin) {
  app.use(
    cors({
      origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        if (!origin || isAllowedCorsOrigin(origin, playCorsOrigin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
} else {
  app.use(cors());
}
app.use(express.json());

// 路由挂载
app.use('/api', healthRoutes);       // GET /api/ping, GET /api/ai-ping
app.use('/api', playerRoutes);       // POST /api/create-player, GET /api/player/:id
app.use('/api', actionRoutes);       // POST /api/action
app.use('/api', talentsRoutes);      // POST /api/talents/choose
app.use('/api/saves', savesRoutes);  // 存档列表 / 删除 / 快照 / 回滚
app.use('/api/inventory', requirePlayToken, inventoryRoutes); // 背包 CRUD

// 启动服务器
app.listen(PORT, () => {
  console.log(`天道服务器已启动，正监听端口: ${PORT}`);
});
