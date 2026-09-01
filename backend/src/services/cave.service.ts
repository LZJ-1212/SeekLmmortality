import type { PrismaClient, player_cave } from '@prisma/client';
import { CaveRepository } from '../repositories/cave.repository';
import { getRegionBaseSpiritualDensity } from './cultivationFormula.service';

/**
 * 洞府业务逻辑层（Service）。
 * 负责：确保每个存档都有洞府（懒加载兜底旧存档），洞府等级与灵气浓度的查询。
 * 洞府升级/阵法系统等更复杂的经营玩法留作后续扩展点，这里先把"洞府决定闭关收益"的核心闭环打通。
 */
export class CaveService {
  private readonly repo: CaveRepository;

  constructor(prisma: PrismaClient, repo?: CaveRepository) {
    this.repo = repo ?? new CaveRepository(prisma);
  }

  /**
   * 获取玩家洞府；如果这个存档还没有洞府记录（例如洞府系统上线前就已存在的旧存档），
   * 就按玩家当前所在地区的基础灵气浓度懒加载创建一座默认洞府，保证系统向后兼容。
   */
  async getOrCreateCave(saveId: string, currentLocation: string): Promise<player_cave> {
    const existing = await this.repo.findBySaveId(saveId);
    if (existing) return existing;

    const baseDensity = getRegionBaseSpiritualDensity(currentLocation);
    return this.repo.create(saveId, currentLocation, baseDensity);
  }
}
