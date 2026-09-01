import type { PrismaClient } from '@prisma/client';

/** 存档数据访问层（Repository）。职责单一：只负责对 saves 的查询与删除。 */
export class SaveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** 按最后更新时间倒序列出全部存档，附带玩家行供列表展示姓名/境界 */
  listAll() {
    return this.prisma.saves.findMany({
      include: { players: true },
      orderBy: { updated_at: 'desc' },
    });
  }

  /**
   * 删除单个存档。
   * saves 上各子表（players/world_state/player_cave/player_sect/player_inventory/
   * player_relationships/save_snapshot）都设了 onDelete: Cascade，删 saves 即级联清理；
   * 只有 action_daily_quotas 无外键，需按 player_id 手动清。
   * @returns 存档是否存在过（存在并删除返回 true；不存在返回 false）
   */
  async deleteById(saveId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const save = await tx.saves.findUnique({
        where: { id: saveId },
        include: { players: true },
      });
      if (!save) return false;
      if (save.players?.id) {
        await tx.action_daily_quotas.deleteMany({ where: { player_id: save.players.id } });
      }
      await tx.saves.delete({ where: { id: saveId } });
      return true;
    });
  }

  /** 删除全部存档，返回删除的行数。同样先清掉所有关联玩家的每日配额。 */
  async deleteAll(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const saves = await tx.saves.findMany({ include: { players: true } });
      const playerIds = saves
        .map((s) => s.players?.id)
        .filter((x): x is string => Boolean(x));
      if (playerIds.length > 0) {
        await tx.action_daily_quotas.deleteMany({ where: { player_id: { in: playerIds } } });
      }
      const res = await tx.saves.deleteMany({});
      return res.count;
    });
  }
}
