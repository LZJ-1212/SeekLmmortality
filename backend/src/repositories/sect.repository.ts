import type { PrismaClient } from '@prisma/client';

/** 宗门数据访问层（Repository）。职责单一：只负责与 player_sect 表的读写。 */
export class SectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findBySaveId(saveId: string) {
    return this.prisma.player_sect.findUnique({ where: { save_id: saveId } });
  }

  /** 首次加入宗门：创建默认档案（试炼弟子，声望 0） */
  create(saveId: string, sectName: string) {
    return this.prisma.player_sect.create({
      data: { save_id: saveId, sect_name: sectName, rank: '试炼弟子', reputation: 0, is_traitor: false },
    });
  }

  /** 更新声望与职位（正常的晋升路径） */
  updateReputationAndRank(saveId: string, reputation: number, rank: string) {
    return this.prisma.player_sect.update({
      where: { save_id: saveId },
      data: { reputation, rank },
    });
  }

  /** 叛宗：打上永久标记，职位归零为叛徒，声望清零 */
  markAsTraitor(saveId: string, traitorRankLabel: string) {
    return this.prisma.player_sect.update({
      where: { save_id: saveId },
      data: { is_traitor: true, rank: traitorRankLabel, reputation: 0 },
    });
  }
}
