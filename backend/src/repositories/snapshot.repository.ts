import type { PrismaClient, players, world_state } from '@prisma/client';
import crypto from 'crypto';

/** 存档快照数据访问层（Repository）。职责单一：只负责与 save_snapshot 表的读写。 */
export class SnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(saveId: string, label: string | null, player: players, worldState: world_state | null) {
    return this.prisma.save_snapshot.create({
      data: {
        id: crypto.randomUUID(),
        save_id: saveId,
        label,
        player_snapshot: player as unknown as object,
        world_state_snapshot: (worldState as unknown as object) ?? undefined,
      },
    });
  }

  /** 按时间戳倒序列出某存档的全部快照（供读档列表展示） */
  listBySave(saveId: string) {
    return this.prisma.save_snapshot.findMany({
      where: { save_id: saveId },
      orderBy: { created_at: 'desc' },
    });
  }

  findById(snapshotId: string) {
    return this.prisma.save_snapshot.findUnique({ where: { id: snapshotId } });
  }

  /** 只保留某存档最近 N 条快照，多出来的旧快照直接删除，避免无限增长 */
  async pruneOlderThanLatest(saveId: string, keepCount: number): Promise<void> {
    const all = await this.prisma.save_snapshot.findMany({
      where: { save_id: saveId },
      orderBy: { created_at: 'desc' },
      select: { id: true },
      skip: keepCount,
    });
    if (all.length === 0) return;
    await this.prisma.save_snapshot.deleteMany({ where: { id: { in: all.map((s) => s.id) } } });
  }
}
