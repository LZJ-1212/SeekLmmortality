import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/prisma';
import { InventoryService } from '../services/inventory.service';
import { isSaveVisibleToOwner } from '../services/saveAccess.service';

/** 修订：2026-09-05 01:11 +08 lzj — 背包按口令仓校验存档 */

const router = Router();
const inventoryService = new InventoryService(prisma);

/** 校验路径参数存在，避免下游拿到 undefined 导致查询条件失真 */
function requireParam(res: Response, value: string | undefined, paramName: string): value is string {
  if (!value) {
    res.status(400).json({ status: 'error', message: `缺少路径参数：${paramName}` });
    return false;
  }
  return true;
}

/** [查] GET /api/inventory/:saveId 获取某存档的完整背包 */
router.get('/:saveId', async (req: Request, res: Response) => {
  const { saveId } = req.params;
  if (!requireParam(res, saveId, 'saveId')) return;
  if (!(await isSaveVisibleToOwner(prisma, saveId, req.saveOwnerHash ?? null))) {
    return res.status(404).json({ status: 'error', message: '该存档已不存在。' });
  }
  try {
    const items = await inventoryService.getInventory(saveId);
    res.json({ status: 'success', data: items });
  } catch (error) {
    console.error('查询背包失败:', error);
    res.status(500).json({ status: 'error', message: '天机紊乱，背包查询失败。' });
  }
});

/** [增] POST /api/inventory/:saveId/items 获得一件物品（body: { name, quantity, category?, rarity?, description?, effects? }） */
router.post('/:saveId/items', async (req: Request, res: Response) => {
  const { saveId } = req.params;
  if (!requireParam(res, saveId, 'saveId')) return;
  if (!(await isSaveVisibleToOwner(prisma, saveId, req.saveOwnerHash ?? null))) {
    return res.status(404).json({ status: 'error', message: '该存档已不存在。' });
  }
  try {
    const { name, quantity, category, rarity, description, effects } = req.body;
    const entry = await inventoryService.addItem(saveId, {
      name,
      change: quantity,
      category,
      rarity,
      description,
      effects,
    });
    res.json({ status: 'success', data: entry });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || '添加物品失败' });
  }
});

/** [删] DELETE /api/inventory/:saveId/items/by-name 按名称消耗指定数量（body: { name, quantity }） */
router.delete('/:saveId/items/by-name', async (req: Request, res: Response) => {
  const { saveId } = req.params;
  if (!requireParam(res, saveId, 'saveId')) return;
  if (!(await isSaveVisibleToOwner(prisma, saveId, req.saveOwnerHash ?? null))) {
    return res.status(404).json({ status: 'error', message: '该存档已不存在。' });
  }
  try {
    const { name, quantity } = req.body;
    await inventoryService.removeItemByName(saveId, name, quantity);
    res.json({ status: 'success', message: `已消耗 ${name} x${quantity}` });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || '消耗物品失败' });
  }
});

/** [改] PATCH /api/inventory/entries/:entryId 更新单条背包条目（数量 / 装备状态） */
router.patch('/entries/:entryId', async (req: Request, res: Response) => {
  const { entryId } = req.params;
  if (!requireParam(res, entryId, 'entryId')) return;
  try {
    const entry = await prisma.player_inventory.findUnique({ where: { id: entryId }, select: { save_id: true } });
    if (!entry || !(await isSaveVisibleToOwner(prisma, entry.save_id, req.saveOwnerHash ?? null))) {
      return res.status(404).json({ status: 'error', message: '该存档已不存在。' });
    }
    const { quantity, isEquipped } = req.body;

    if (quantity !== undefined) {
      await inventoryService.setQuantity(entryId, quantity);
    }
    if (isEquipped !== undefined) {
      await inventoryService.setEquipped(entryId, !!isEquipped);
    }
    res.json({ status: 'success', message: '背包条目已更新' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || '更新背包条目失败' });
  }
});

/** [删] DELETE /api/inventory/entries/:entryId 直接丢弃某条背包物品（不论字典物品还是自定义物品） */
router.delete('/entries/:entryId', async (req: Request, res: Response) => {
  const { entryId } = req.params;
  if (!requireParam(res, entryId, 'entryId')) return;
  try {
    const entry = await prisma.player_inventory.findUnique({ where: { id: entryId }, select: { save_id: true } });
    if (!entry || !(await isSaveVisibleToOwner(prisma, entry.save_id, req.saveOwnerHash ?? null))) {
      return res.status(404).json({ status: 'error', message: '该存档已不存在。' });
    }
    await inventoryService.deleteEntry(entryId);
    res.json({ status: 'success', message: '物品已丢弃' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || '丢弃物品失败' });
  }
});

export default router;
