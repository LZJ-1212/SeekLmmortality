import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/prisma';
import { requirePlayToken, assertCreatePlayerBody } from '../gateway';
import { CharacterCreationService } from '../services/characterCreation.service';
import { InventoryService } from '../services/inventory.service';
import { CaveService } from '../services/cave.service';
import { SectService } from '../services/sect.service';
import { RelationshipService } from '../services/relationship.service';
import { WorldStateRepository } from '../repositories/worldState.repository';
import { getLifespanStatus } from '../services/playerState.service';
import { isPlayerVisibleToOwner } from '../services/saveAccess.service';

/**
 * 修订：2026-09-05 01:11 +08 lzj — 创角落仓哈希；读档按口令仓隔离
 * 玩家路由：创角（/api/create-player）与状态探查（/api/player/:id）。
 * 业务逻辑在 Service 层；此处只做 HTTP 入参解析、网关校验与响应组装。
 */
const router = Router();

const characterCreationService = new CharacterCreationService(prisma);
const inventoryService = new InventoryService(prisma);
const caveService = new CaveService(prisma);
const sectService = new SectService(prisma);
const relationshipService = new RelationshipService(prisma);
const worldStateRepo = new WorldStateRepository(prisma);

/** 创角系统：完全体降临 */
router.post('/create-player', requirePlayToken, async (req: Request, res: Response) => {
  // S21：创角字段长度校验（超长/非法直接 400，不写库、不调开场 LLM）
  const check = assertCreatePlayerBody(req.body);
  if (!check.ok) {
    return res.status(400).json({ status: 'error', message: check.message });
  }

  const result = await characterCreationService.create(req.body, req.saveOwnerHash ?? null);
  if (!result.ok) {
    return res.status(500).json({ status: 'error', message: result.message });
  }
  res.json({
    status: 'success',
    message: result.message,
    data: result.data,
  });
});

/** 天道探查：获取修士真实状态 */
router.get('/player/:id', requirePlayToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const playerId = typeof id === 'string' ? id : undefined;
  if (!playerId) {
    return res.status(400).json({ status: 'error', message: '缺少路径参数：id' });
  }

  try {
    const player = await prisma.players.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return res.status(404).json({ status: 'error', message: '查无此人，该修士恐已陨落。' });
    }
    if (!(await isPlayerVisibleToOwner(prisma, playerId, req.saveOwnerHash ?? null))) {
      return res.status(404).json({ status: 'error', message: '查无此人，该修士恐已陨落。' });
    }

    const inventoryData = await inventoryService.getInventory(player.save_id);
    const lifespanStatus = getLifespanStatus(player.age ?? 16, player.max_lifespan ?? 100);
    const cave = await caveService.getCave(player.save_id);
    const sect = await sectService.getSect(player.save_id);
    const relationships = await relationshipService.getAll(player.save_id);
    const worldState = await worldStateRepo.findBySaveId(player.save_id);
    const beatClock = await worldStateRepo.readBeatClock(player.save_id);

    res.json({
      status: 'success',
      data: {
        ...player,
        inventory: inventoryData,
        lifespanStatus,
        cave,
        sect,
        relationships,
        current_year: worldState?.current_year ?? 387,
        current_season: worldState?.current_season ?? '春',
        day_phase: beatClock.phase,
      },
    });
  } catch (error) {
    console.error('天道探查失败:', error);
    res.status(500).json({ status: 'error', message: '天道探查失败' });
  }
});

export default router;
