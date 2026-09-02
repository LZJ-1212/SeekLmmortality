import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/prisma';
import { requirePlayToken } from '../gateway';
import { SaveService } from '../services/save.service';
import { SnapshotService } from '../services/snapshot.service';

/**
 * 存档路由：/api/saves。
 * 存档列表、删除（单个/全部）、时间戳快照列表与回滚。
 */
const router = Router();
const saveService = new SaveService(prisma);
const snapshotService = new SnapshotService(prisma);

/** 从路径参数里安全取出 saveId；非法（非字符串/缺省）返回 undefined，由调用方决定如何响应 */
function requireSaveId(req: Request, res: Response): string | null {
  const { saveId } = req.params;
  if (typeof saveId !== 'string') {
    res.status(400).json({ status: 'error', message: '缺少路径参数：saveId' });
    return null;
  }
  return saveId;
}

/** 存档列表：列出全部存档（免手抄 UUID）；薄做只读列表，不做快照回滚 UI */
router.get('/', requirePlayToken, async (_req: Request, res: Response) => {
  try {
    const saves = await saveService.listSaves();
    res.json({ status: 'success', data: saves });
  } catch (error) {
    console.error('查询存档列表失败:', error);
    res.status(500).json({ status: 'error', message: '天机紊乱，无法读取存档列表。' });
  }
});

/** 删除全部存档（级联清理关联表与每日配额） */
router.delete('/', requirePlayToken, async (_req: Request, res: Response) => {
  try {
    const { deleted } = await saveService.deleteAllSaves();
    res.json({ status: 'success', data: { deleted } });
  } catch (error) {
    console.error('清空存档失败:', error);
    res.status(500).json({ status: 'error', message: '天机紊乱，清空存档失败。' });
  }
});

/** 删除单个存档 */
router.delete('/:saveId', requirePlayToken, async (req: Request, res: Response) => {
  const saveId = requireSaveId(req, res);
  if (saveId === null) return;
  try {
    const { deleted } = await saveService.deleteSave(saveId);
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: '该存档已不存在。' });
    }
    res.json({ status: 'success', data: { deleted: true } });
  } catch (error) {
    console.error('删除存档失败:', error);
    res.status(500).json({ status: 'error', message: '天机紊乱，删除存档失败。' });
  }
});

/** 常规读档：列出某存档全部可回滚的时间戳快照 */
router.get('/:saveId/snapshots', requirePlayToken, async (req: Request, res: Response) => {
  const saveId = requireSaveId(req, res);
  if (saveId === null) return;
  try {
    const snapshots = await snapshotService.listSnapshots(saveId);
    res.json({
      status: 'success',
      data: snapshots.map((s) => ({ id: s.id, createdAt: s.created_at, label: s.label })),
    });
  } catch (error) {
    console.error('查询存档快照失败:', error);
    res.status(500).json({ status: 'error', message: '天道探查失败，无法读取存档快照列表。' });
  }
});

/** 常规读档：把存档回滚到某个时间戳快照 */
router.post('/:saveId/rollback', requirePlayToken, async (req: Request, res: Response) => {
  const saveId = requireSaveId(req, res);
  if (saveId === null) return;
  try {
    const { snapshotId } = req.body;
    if (!snapshotId) {
      return res.status(400).json({ status: 'error', message: '缺少要回滚到的快照 id' });
    }
    const restoredPlayer = await snapshotService.rollbackToSnapshot(saveId, snapshotId);
    // 读档回滚可能会让存档从"已终结"状态复活（例如回滚到死亡之前），需要同步解除死亡锁
    await prisma.saves.update({ where: { id: saveId }, data: { is_game_over: false } });
    res.json({ status: 'success', message: '时光倒流，存档已回滚至选定的时间点。', data: { player: restoredPlayer } });
  } catch (error) {
    console.error('存档回滚失败:', error);
    const message = error instanceof Error ? error.message : '存档回滚失败';
    res.status(400).json({ status: 'error', message });
  }
});

export default router;
