/**
 * 修订：2026-09-05 01:11 +08 lzj — 按 owner_token_hash 列/删存档
 */
import type { PrismaClient } from '@prisma/client';

/** 存档数据访问层（Repository）。职责单一：只负责对 saves 的查询与删除。 */
export class SaveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * ownerHash 为 null：列出全部（本机服主）。
   * 否则只列该口令仓；旧档 hash 为空的公网不可见。
   */
  listForOwner(ownerHash: string | null) {
    return this.prisma.saves.findMany({
      where: ownerHash ? { owner_token_hash: ownerHash } : undefined,
      include: { players: true },
      orderBy: { updated_at: 'desc' },
    });
  }

  /**
   * 删除单个存档。
   * saves 上各子表（players/world_state/player_cave/player_sect/player_inventory/
   * player_relationships/save_snapshot）都设了 onDelete: Cascade，删 saves 即级联清理；
   * 只有 action_daily_quotas 无外键，需按 player_id 手动清。
   * ownerHash 非空时只删自己仓内的档。
   */
  async deleteById(saveId: string, ownerHash: string | null): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const save = await tx.saves.findUnique({
        where: { id: saveId },
        include: { players: true },
      });
      if (!save) return false;
      if (ownerHash && save.owner_token_hash !== ownerHash) return false;
      if (save.players?.id) {
        await tx.action_daily_quotas.deleteMany({ where: { player_id: save.players.id } });
      }
      await tx.saves.delete({ where: { id: saveId } });
      return true;
    });
  }

  /** 删除可见范围内的存档。本机无口令则清空全部。 */
  async deleteAll(ownerHash: string | null): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const saves = await tx.saves.findMany({
        where: ownerHash ? { owner_token_hash: ownerHash } : undefined,
        include: { players: true },
      });
      const playerIds = saves
        .map((s) => s.players?.id)
        .filter((x): x is string => Boolean(x));
      if (playerIds.length > 0) {
        await tx.action_daily_quotas.deleteMany({ where: { player_id: { in: playerIds } } });
      }
      const res = await tx.saves.deleteMany({
        where: ownerHash ? { owner_token_hash: ownerHash } : undefined,
      });
      return res.count;
    });
  }
}
