import { describe, it, expect, vi } from 'vitest';
import { ReincarnationDbService } from './reincarnationDb.service';
import type { ReincarnationRepository } from '../repositories/reincarnation.repository';

function createMockRepo(): ReincarnationRepository {
  return {
    findLegacyPoolCandidates: vi.fn(),
    markAsLegacy: vi.fn(),
    consumeLegacy: vi.fn(),
  } as unknown as ReincarnationRepository;
}

describe('ReincarnationDbService.pickLegacyCandidate（从轮回池随机抽取合格的前世角色）', () => {
  it('正常路径：应从数据库候选中筛出合格者并抽取一个', async () => {
    const repo = createMockRepo();
    (repo.findLegacyPoolCandidates as any).mockResolvedValue([
      { id: 'save-1', players: { realm_major: '筑基', aptitude: 12, comprehension: 10, divine_sense: 10, speed: 10, dao_heart: 10, fortune: 10 } },
    ]);
    const service = new ReincarnationDbService({} as any, repo);

    const result = await service.pickLegacyCandidate();

    expect(result?.saveId).toBe('save-1');
    expect(result?.attributes.aptitude).toBe(12);
  });

  it('正常路径：境界不合格（炼气期）的候选应被过滤，最终返回 null', async () => {
    const repo = createMockRepo();
    (repo.findLegacyPoolCandidates as any).mockResolvedValue([
      { id: 'save-1', players: { realm_major: '炼气', aptitude: 10, comprehension: 10, divine_sense: 10, speed: 10, dao_heart: 10, fortune: 10 } },
    ]);
    const service = new ReincarnationDbService({} as any, repo);

    expect(await service.pickLegacyCandidate()).toBeNull();
  });

  it('边界情况：缺失关联的 players 数据（脏数据）应被安全过滤，不抛出异常', async () => {
    const repo = createMockRepo();
    (repo.findLegacyPoolCandidates as any).mockResolvedValue([{ id: 'save-1', players: null }]);
    const service = new ReincarnationDbService({} as any, repo);

    expect(await service.pickLegacyCandidate()).toBeNull();
  });

  it('边界情况：轮回池为空时应返回 null', async () => {
    const repo = createMockRepo();
    (repo.findLegacyPoolCandidates as any).mockResolvedValue([]);
    const service = new ReincarnationDbService({} as any, repo);

    expect(await service.pickLegacyCandidate()).toBeNull();
  });
});

describe('ReincarnationDbService 标记/消耗轮回状态', () => {
  it('markAsLegacy 应调用仓库对应方法', async () => {
    const repo = createMockRepo();
    const service = new ReincarnationDbService({} as any, repo);
    await service.markAsLegacy('save-1');
    expect(repo.markAsLegacy).toHaveBeenCalledWith('save-1');
  });

  it('consumeLegacy 应调用仓库对应方法', async () => {
    const repo = createMockRepo();
    const service = new ReincarnationDbService({} as any, repo);
    await service.consumeLegacy('save-1');
    expect(repo.consumeLegacy).toHaveBeenCalledWith('save-1');
  });
});
