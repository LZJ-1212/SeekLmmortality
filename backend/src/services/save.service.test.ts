/** 修订：2026-09-05 01:11 +08 lzj — 列表按口令仓转交 repository */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveService } from './save.service';
import type { SaveRepository } from '../repositories/save.repository';

function createMockRepo(): SaveRepository {
  return {
    listForOwner: vi.fn(),
    deleteById: vi.fn(),
    deleteAll: vi.fn(),
  } as unknown as SaveRepository;
}

describe('SaveService.listSaves（存档列表摘要，免手抄 UUID）', () => {
  let repo: SaveRepository;
  let service: SaveService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new SaveService({} as any, repo);
  });

  it('正常路径：把 saves + 玩家行整理成摘要，按原顺序返回', async () => {
    (repo.listForOwner as any).mockResolvedValue([
      {
        id: 'save-1',
        save_name: '云逸的修仙录',
        is_game_over: false,
        updated_at: new Date('2026-09-01T10:00:00Z'),
        players: { id: 'p-1', name: '云逸', realm_major: '炼气', realm_minor: '初期' },
      },
    ]);

    const result = await service.listSaves();
    expect(repo.listForOwner).toHaveBeenCalledWith(null);

    expect(result).toEqual([
      {
        saveId: 'save-1',
        saveName: '云逸的修仙录',
        playerId: 'p-1',
        playerName: '云逸',
        realmMajor: '炼气',
        realmMinor: '初期',
        isGameOver: false,
        updatedAt: new Date('2026-09-01T10:00:00Z'),
      },
    ]);
  });

  it('边界：空列表返回空数组，不抛异常', async () => {
    (repo.listForOwner as any).mockResolvedValue([]);
    expect(await service.listSaves()).toEqual([]);
  });

  it('失败/拒绝：玩家行缺失的脏存档兜底为无名氏，playerId 为 null', async () => {
    (repo.listForOwner as any).mockResolvedValue([
      {
        id: 'save-x',
        save_name: '幽灵存档',
        is_game_over: true,
        updated_at: new Date('2026-09-01T10:00:00Z'),
        players: null,
      },
    ]);

    const result = await service.listSaves();
    expect(result[0]).toMatchObject({
      playerId: null,
      playerName: '无名氏',
      realmMajor: '',
      realmMinor: '',
      isGameOver: true,
    });
  });

  it('正常路径：传入仓哈希时转交 listForOwner', async () => {
    (repo.listForOwner as any).mockResolvedValue([]);
    await service.listSaves('hash-a');
    expect(repo.listForOwner).toHaveBeenCalledWith('hash-a');
  });
});

describe('SaveService.deleteSave / deleteAllSaves（删除存档）', () => {
  let repo: SaveRepository;
  let service: SaveService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new SaveService({} as any, repo);
  });

  it('正常路径：删除存在的存档，deleted 为 true', async () => {
    (repo.deleteById as any).mockResolvedValue(true);
    expect(await service.deleteSave('save-1')).toEqual({ deleted: true });
    expect(repo.deleteById).toHaveBeenCalledWith('save-1', null);
  });

  it('边界：删除不存在的存档，deleted 为 false 而不抛异常', async () => {
    (repo.deleteById as any).mockResolvedValue(false);
    expect(await service.deleteSave('ghost')).toEqual({ deleted: false });
  });

  it('正常路径：删除全部，返回删除数量', async () => {
    (repo.deleteAll as any).mockResolvedValue(3);
    expect(await service.deleteAllSaves()).toEqual({ deleted: 3 });
  });

  it('边界：无存档可删时删除数量为 0', async () => {
    (repo.deleteAll as any).mockResolvedValue(0);
    expect(await service.deleteAllSaves()).toEqual({ deleted: 0 });
  });
});
