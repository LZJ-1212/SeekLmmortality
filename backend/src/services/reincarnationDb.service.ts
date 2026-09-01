import type { PrismaClient } from '@prisma/client';
import { ReincarnationRepository } from '../repositories/reincarnation.repository';
import { pickRandomLegacy, type LegacyCandidate } from './reincarnation.service';

/**
 * 轮回业务逻辑层（Service，含数据库读写）。
 * 与 reincarnation.service.ts（纯函数：资格判定、遗泽掷骰）配合使用：
 * 这里只负责"从数据库里查出轮回池候选、随机抽一个、以及标记/消耗轮回状态"。
 */
export class ReincarnationDbService {
  private readonly repo: ReincarnationRepository;

  constructor(prisma: PrismaClient, repo?: ReincarnationRepository) {
    this.repo = repo ?? new ReincarnationRepository(prisma);
  }

  /** 从轮回池里随机抽取一个有资格的前世角色；池子为空或全部不合格时返回 null */
  async pickLegacyCandidate(): Promise<LegacyCandidate | null> {
    const rows = await this.repo.findLegacyPoolCandidates();
    const candidates: LegacyCandidate[] = rows
      .filter((r) => !!r.players)
      .map((r) => ({
        saveId: r.id,
        realmMajor: r.players!.realm_major,
        attributes: {
          aptitude: r.players!.aptitude ?? 10,
          comprehension: r.players!.comprehension ?? 10,
          divine_sense: r.players!.divine_sense ?? 10,
          speed: r.players!.speed ?? 10,
          dao_heart: r.players!.dao_heart ?? 10,
          fortune: r.players!.fortune ?? 10,
        },
      }));
    return pickRandomLegacy(candidates);
  }

  async markAsLegacy(saveId: string) {
    return this.repo.markAsLegacy(saveId);
  }

  async consumeLegacy(saveId: string) {
    return this.repo.consumeLegacy(saveId);
  }
}
