import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaveService } from './cave.service';
import type { CaveRepository } from '../repositories/cave.repository';

function createMockRepo(): CaveRepository {
  return {
    findBySaveId: vi.fn(),
    create: vi.fn(),
    updateSpiritualDensityAndLevel: vi.fn(),
  } as unknown as CaveRepository;
}

describe('CaveService.getOrCreateCave（洞府懒加载兜底，保证旧存档也能正常获取洞府数据）', () => {
  let repo: CaveRepository;
  let service: CaveService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new CaveService({} as any, repo);
  });

  it('正常路径：存档已有洞府记录时应直接返回，不重复创建', async () => {
    const existingCave = { save_id: 'save-1', level: 2, spiritual_density: 30, location_name: '天机峰' };
    (repo.findBySaveId as any).mockResolvedValue(existingCave);

    const result = await service.getOrCreateCave('save-1', '青岳·天机坊市');

    expect(result).toEqual(existingCave);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('核心场景：旧存档没有洞府记录时，应按当前所在地区的基础灵气浓度懒加载创建', async () => {
    (repo.findBySaveId as any).mockResolvedValue(null);
    (repo.create as any).mockResolvedValue({ save_id: 'save-1', level: 1, spiritual_density: 40, location_name: '天机峰' });

    const result = await service.getOrCreateCave('save-1', '天机峰');

    expect(repo.create).toHaveBeenCalledWith('save-1', '天机峰', 40); // 天机峰基础灵气浓度 40
    expect(result.spiritual_density).toBe(40);
  });

  it('边界情况：所在地区未收录时，应使用默认基础灵气浓度创建洞府', async () => {
    (repo.findBySaveId as any).mockResolvedValue(null);
    (repo.create as any).mockResolvedValue({ save_id: 'save-1', level: 1, spiritual_density: 10, location_name: '荒郊野外' });

    await service.getOrCreateCave('save-1', '荒郊野外');

    expect(repo.create).toHaveBeenCalledWith('save-1', '荒郊野外', 10);
  });
});
