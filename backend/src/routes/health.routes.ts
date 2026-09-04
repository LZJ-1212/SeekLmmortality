import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/prisma';
import { wakeUpHeaven } from '../../ai';
import { getGameVersion } from '../gameVersion';
import { requirePlayToken } from '../gateway';

/**
 * 修订：2026-09-05 01:39 +08 lzj — /api/ping 返回 version
 * 健康检查路由：数据库连通性 + AI 灵魂连通性。
 * /ping 无需令牌（探活），/ai-ping 需要令牌（会真实调一次 DeepSeek）。
 */
const router = Router();

/** 测试路由：探查天地灵气（数据库连接测试） */
router.get('/ping', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'success',
      message: '天地之桥已打通！天道系统（数据库）连接成功。',
      version: getGameVersion(),
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    res.status(500).json({
      status: 'error',
      message: '灵气涣散，数据库连接失败，请检查 XAMPP 是否开启。',
    });
  }
});

/** AI 灵魂测试路由 */
router.get('/ai-ping', requirePlayToken, async (_req: Request, res: Response) => {
  try {
    const heavenlyVoice = await wakeUpHeaven();
    res.json({
      status: 'success',
      message: heavenlyVoice,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '天道失联，请检查 .env 中的 DEEPSEEK_API_KEY 是否正确配置。',
    });
  }
});

export default router;
