import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/prisma';
import { requirePlayToken } from '../gateway';
import { addRealmTalent } from '../services/talent.service';

/**
 * 逆天改命路由：/api/talents/choose。
 * 确认玩家从三选一里选中的天赋，写入 talents JSON。
 */
const router = Router();

router.post('/talents/choose', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const { playerId, talentId } = req.body;
    if (!talentId) {
      return res.status(400).json({ status: 'error', message: '缺少要选择的天赋 id' });
    }
    const player = await prisma.players.findUnique({ where: { id: playerId } });
    if (!player) return res.status(404).json({ status: 'error', message: '修士不存在' });

    let updatedTalentsJson: string;
    try {
      updatedTalentsJson = addRealmTalent(player.talents, talentId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '天赋选择失败';
      return res.status(400).json({ status: 'error', message });
    }

    const updatedPlayer = await prisma.players.update({
      where: { id: playerId },
      data: { talents: updatedTalentsJson },
    });

    res.json({ status: 'success', message: '天道垂青，逆天改命已成！', data: { player: updatedPlayer } });
  } catch (error) {
    console.error('天赋选择接口报错:', error);
    res.status(500).json({ status: 'error', message: '天机紊乱，天赋选择失败。' });
  }
});

export default router;
