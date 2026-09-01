import type { PrismaClient } from '@prisma/client';

/** 存档数据访问层（Repository）。职责单一：只负责列出 saves 及其一对一玩家行。 */
export class SaveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** 按最后更新时间倒序列出全部存档，附带玩家行供列表展示姓名/境界 */
  listAll() {
    return this.prisma.saves.findMany({
      include: { players: true },
      orderBy: { updated_at: 'desc' },
    });
  }
}
