import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaveService, detectEstablishCaveIntent, detectGrantCaveIntent, resolveSeclusionSpiritualDensity } from './cave.service';
import { getRegionBaseSpiritualDensity } from './cultivationFormula.service';
import type { CaveRepository } from '../repositories/cave.repository';

function createMockRepo(): CaveRepository {
  return {
    findBySaveId: vi.fn(),
    create: vi.fn(),
    updateSpiritualDensityAndLevel: vi.fn(),
  } as unknown as CaveRepository;
}

describe('detectEstablishCaveIntent（开辟洞府）', () => {
  it('正常路径：开辟洞府应识别', () => {
    expect(detectEstablishCaveIntent('在青岳开辟洞府一处')).toBe(true);
  });

  it('失败/拒绝：只说逛坊市不是开辟', () => {
    expect(detectEstablishCaveIntent('前往坊市买丹')).toBe(false);
  });

  it('边界：宗门赐府不是自行开辟句', () => {
    expect(detectEstablishCaveIntent('宗门赐下一座洞府')).toBe(false);
    expect(detectGrantCaveIntent('宗门赐下一座洞府')).toBe(true);
  });
});

describe('resolveSeclusionSpiritualDensity（闭关灵气：有府用府，无府借地打折）', () => {
  it('正常路径：有洞府用府内浓度', () => {
    expect(resolveSeclusionSpiritualDensity({ spiritual_density: 40 }, '青岳·天机坊市')).toEqual({
      density: 40,
      source: 'cave',
    });
  });

  it('边界：无洞府不把所在地当府，灵气按地区六成', () => {
    const result = resolveSeclusionSpiritualDensity(null, '青岳·天机坊市');
    expect(result.source).toBe('wild');
    expect(result.density).toBe(Math.max(1, Math.round(getRegionBaseSpiritualDensity('青岳·天机坊市') * 0.6)));
  });
});

describe('CaveService.getCave / establishCave', () => {
  let repo: CaveRepository;
  let service: CaveService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new CaveService({} as any, repo);
  });

  it('正常路径：已有洞府则 getCave 返回记录', async () => {
    const existingCave = { save_id: 'save-1', level: 2, spiritual_density: 30, location_name: '天机峰' };
    (repo.findBySaveId as any).mockResolvedValue(existingCave);
    await expect(service.getCave('save-1')).resolves.toEqual(existingCave);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('边界：无洞府则 getCave 为 null，不创建', async () => {
    (repo.findBySaveId as any).mockResolvedValue(null);
    await expect(service.getCave('save-1')).resolves.toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('正常路径：无洞府时开辟应创建', async () => {
    (repo.findBySaveId as any).mockResolvedValue(null);
    (repo.create as any).mockResolvedValue({ save_id: 'save-1', level: 1, spiritual_density: 40, location_name: '天机峰' });
    const result = await service.establishCave('save-1', '天机峰');
    expect(result.ok).toBe(true);
    expect(repo.create).toHaveBeenCalledWith('save-1', '天机峰', 40);
  });

  it('失败/拒绝：已有洞府再开辟不得覆盖', async () => {
    const existingCave = { save_id: 'save-1', level: 2, spiritual_density: 30, location_name: '天机峰' };
    (repo.findBySaveId as any).mockResolvedValue(existingCave);
    const result = await service.establishCave('save-1', '黑风岭');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_has_cave');
    expect(repo.create).not.toHaveBeenCalled();
  });
});
