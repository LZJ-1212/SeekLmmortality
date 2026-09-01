import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotService, stripIdentityFields, MAX_SNAPSHOTS_PER_SAVE } from './snapshot.service';
import type { SnapshotRepository } from '../repositories/snapshot.repository';

describe('stripIdentityFields（回滚时剥离不可覆盖的身份字段）', () => {
  it('正常路径：应去掉 id 与 save_id，保留其余字段', () => {
    const result = stripIdentityFields({ id: 'x', save_id: 'y', hp: 50, mp: 80 });
    expect(result).toEqual({ hp: 50, mp: 80 });
    expect('id' in result).toBe(false);
    expect('save_id' in result).toBe(false);
  });
});

function createMockRepo(): SnapshotRepository {
  return {
    create: vi.fn(),
    listBySave: vi.fn(),
    findById: vi.fn(),
    pruneOlderThanLatest: vi.fn(),
  } as unknown as SnapshotRepository;
}

describe('SnapshotService.captureSnapshot（拍摄快照并自动清理旧快照）', () => {
  it('正常路径：应创建快照后调用一次清理，且清理保留数量与常量一致', async () => {
    const repo = createMockRepo();
    (repo.create as any).mockResolvedValue({ id: 'snap-1' });
    const service = new SnapshotService({} as any, repo);

    await service.captureSnapshot('save-1', '闭关十年', { hp: 100 } as any, { current_year: 400 } as any);

    expect(repo.create).toHaveBeenCalledWith('save-1', '闭关十年', { hp: 100 }, { current_year: 400 });
    expect(repo.pruneOlderThanLatest).toHaveBeenCalledWith('save-1', MAX_SNAPSHOTS_PER_SAVE);
  });
});

describe('SnapshotService.rollbackToSnapshot（读档回滚）', () => {
  let repo: SnapshotRepository;
  let prisma: any;
  let service: SnapshotService;

  beforeEach(() => {
    repo = createMockRepo();
    prisma = {
      players: { update: vi.fn().mockResolvedValue({ id: 'p1', hp: 100 }) },
      world_state: { update: vi.fn().mockResolvedValue({ save_id: 'save-1', current_year: 400 }) },
    };
    service = new SnapshotService(prisma, repo);
  });

  it('异常路径：快照不存在时应抛出异常', async () => {
    (repo.findById as any).mockResolvedValue(null);
    await expect(service.rollbackToSnapshot('save-1', 'snap-x')).rejects.toThrow('找不到');
  });

  it('异常路径：快照存在但不属于这个存档时应抛出异常（防止跨存档误回滚）', async () => {
    (repo.findById as any).mockResolvedValue({ id: 'snap-1', save_id: 'save-OTHER', player_snapshot: {} });
    await expect(service.rollbackToSnapshot('save-1', 'snap-1')).rejects.toThrow('找不到');
  });

  it('正常路径：应用玩家快照数据覆盖回 players 表，且不包含身份字段', async () => {
    (repo.findById as any).mockResolvedValue({
      id: 'snap-1',
      save_id: 'save-1',
      player_snapshot: { id: 'p1', save_id: 'save-1', hp: 80, cultivation: 500 },
      world_state_snapshot: null,
    });

    await service.rollbackToSnapshot('save-1', 'snap-1');

    expect(prisma.players.update).toHaveBeenCalledWith({
      where: { save_id: 'save-1' },
      data: { hp: 80, cultivation: 500 },
    });
    expect(prisma.world_state.update).not.toHaveBeenCalled();
  });

  it('正常路径：world_state 快照存在时也应一并还原', async () => {
    (repo.findById as any).mockResolvedValue({
      id: 'snap-1',
      save_id: 'save-1',
      player_snapshot: { id: 'p1', save_id: 'save-1', hp: 80 },
      world_state_snapshot: { save_id: 'save-1', current_year: 390, current_season: '夏' },
    });

    await service.rollbackToSnapshot('save-1', 'snap-1');

    expect(prisma.world_state.update).toHaveBeenCalledWith({
      where: { save_id: 'save-1' },
      data: { current_year: 390, current_season: '夏' },
    });
  });
});
