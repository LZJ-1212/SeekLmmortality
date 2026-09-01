import type { PrismaClient, player_cave } from '@prisma/client';
import { CaveRepository } from '../repositories/cave.repository';
import { getRegionBaseSpiritualDensity } from './cultivationFormula.service';

/**
 * 洞府须开辟或宗门赐府后才有记录。禁止把「当前所在地」懒建成洞府。
 */

export function detectEstablishCaveIntent(actionText: string): boolean {
  const t = (actionText ?? '').replace(/\s+/g, '');
  if (!t) return false;
  if (t.includes('开辟洞府') || t.includes('开辟洞天') || t.includes('开府安家')) return true;
  if (t.includes('开辟') && t.includes('洞府')) return true;
  return false;
}

export function detectGrantCaveIntent(actionText: string): boolean {
  const t = (actionText ?? '').replace(/\s+/g, '');
  if (!t.includes('洞府')) return false;
  return t.includes('赐') || t.includes('赏赐');
}

/** 无洞府时借地打坐：只用地区灵气的六成，客栈/野外不等于洞府。 */
export const WILD_SECLUSION_DENSITY_RATIO = 0.6;

export function resolveSeclusionSpiritualDensity(
  cave: { spiritual_density: number } | null,
  currentLocation: string,
): { density: number; source: 'cave' | 'wild' } {
  if (cave) {
    return { density: cave.spiritual_density, source: 'cave' };
  }
  const region = getRegionBaseSpiritualDensity(currentLocation);
  return {
    density: Math.max(1, Math.round(region * WILD_SECLUSION_DENSITY_RATIO)),
    source: 'wild',
  };
}

export class CaveService {
  private readonly repo: CaveRepository;

  constructor(prisma: PrismaClient, repo?: CaveRepository) {
    this.repo = repo ?? new CaveRepository(prisma);
  }

  getCave(saveId: string): Promise<player_cave | null> {
    return this.repo.findBySaveId(saveId);
  }

  /**
   * 在当前地点开辟洞府。已有则失败，不覆盖。
   */
  async establishCave(
    saveId: string,
    locationName: string,
  ): Promise<{ ok: true; cave: player_cave } | { ok: false; reason: 'already_has_cave'; cave: player_cave }> {
    const existing = await this.repo.findBySaveId(saveId);
    if (existing) return { ok: false, reason: 'already_has_cave', cave: existing };
    const baseDensity = getRegionBaseSpiritualDensity(locationName);
    const cave = await this.repo.create(saveId, locationName, baseDensity);
    return { ok: true, cave };
  }
}
