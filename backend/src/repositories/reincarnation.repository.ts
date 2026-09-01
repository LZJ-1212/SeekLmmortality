import type { PrismaClient } from '@prisma/client';

/** 轮回数据访问层（Repository）。职责单一：只负责查询/标记 saves.in_samsara_pool。 */
export class ReincarnationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** 查询轮回池中全部候选（尚未被抽中转世的、已陨落的存档），附带其角色数据供后续资格过滤 */
  findLegacyPoolCandidates() {
    return this.prisma.saves.findMany({
      where: { in_samsara_pool: true },
      include: { players: true },
    });
  }

  /** 把一个存档标记为进入轮回池（角色陨落时调用） */
  markAsLegacy(saveId: string) {
    return this.prisma.saves.update({ where: { id: saveId }, data: { in_samsara_pool: true } });
  }

  /** 把一个存档从轮回池中移除（已经被下一世抽中并授予遗泽后调用，防止重复转世） */
  consumeLegacy(saveId: string) {
    return this.prisma.saves.update({ where: { id: saveId }, data: { in_samsara_pool: false } });
  }
}
