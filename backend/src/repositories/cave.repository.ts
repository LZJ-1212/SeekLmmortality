import type { PrismaClient } from '@prisma/client';

/**
 * 洞府数据访问层（Repository）。职责单一：只负责与 player_cave 表的读写。
 */
export class CaveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findBySaveId(saveId: string) {
    return this.prisma.player_cave.findUnique({ where: { save_id: saveId } });
  }

  /** 新建一座默认洞府（等级 1，灵气浓度按出身地区给定的基础值） */
  create(saveId: string, locationName: string, spiritualDensity: number) {
    return this.prisma.player_cave.create({
      data: {
        save_id: saveId,
        level: 1,
        spiritual_density: spiritualDensity,
        location_name: locationName,
      },
    });
  }

  updateSpiritualDensityAndLevel(saveId: string, spiritualDensity: number, level: number) {
    return this.prisma.player_cave.update({
      where: { save_id: saveId },
      data: { spiritual_density: spiritualDensity, level },
    });
  }
}
