import type { PrismaClient } from '@prisma/client';

/**
 * 日配额数据访问层。职责单一：按 playerId + 日期原子自增并读回计数。
 * 用 MySQL 原生 upsert 保证并发下计数不丢；读回交给上层判断是否超限。
 */
export class QuotaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async incrementAndRead(playerId: string, day: string): Promise<number> {
    await this.prisma.$executeRaw`
      INSERT INTO action_daily_quotas (player_id, day, \`count\`)
      VALUES (${playerId}, ${day}, 1)
      ON DUPLICATE KEY UPDATE \`count\` = \`count\` + 1
    `;

    const row = await this.prisma.action_daily_quotas.findFirst({
      where: { player_id: playerId, day },
    });
    return row?.count ?? 0;
  }
}
