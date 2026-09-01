import type { PrismaClient, players, world_state, save_snapshot } from '@prisma/client';
import { SnapshotRepository } from '../repositories/snapshot.repository';

/** 每个存档最多保留的快照数量，超出的旧快照会被自动清理，避免无限增长 */
export const MAX_SNAPSHOTS_PER_SAVE = 30;

/** 从快照 JSON 里剥离出不可被覆盖的身份字段（id/save_id），只保留真正需要还原的数据字段 */
export function stripIdentityFields<T extends Record<string, any>>(snapshot: T): Omit<T, 'id' | 'save_id'> {
  const { id, save_id, ...rest } = snapshot;
  return rest;
}

/**
 * 常规读档：基于时间戳的数据库快照回滚。
 * 每次玩家行动落定后拍一张快照（players + world_state 的完整副本），
 * 读档时挑一张历史快照，把这两张表原样覆盖回去，相当于把时间拨回到那一刻。
 */
export class SnapshotService {
  private readonly repo: SnapshotRepository;

  constructor(private readonly prisma: PrismaClient, repo?: SnapshotRepository) {
    this.repo = repo ?? new SnapshotRepository(prisma);
  }

  /** 拍摄一张快照并自动清理超出保留上限的旧快照 */
  async captureSnapshot(saveId: string, label: string | null, player: players, worldState: world_state | null): Promise<save_snapshot> {
    const snapshot = await this.repo.create(saveId, label, player, worldState);
    await this.repo.pruneOlderThanLatest(saveId, MAX_SNAPSHOTS_PER_SAVE);
    return snapshot;
  }

  /** 列出某存档全部可回滚的历史快照（按时间戳倒序，供读档列表展示） */
  async listSnapshots(saveId: string): Promise<save_snapshot[]> {
    return this.repo.listBySave(saveId);
  }

  /**
   * 读档回滚：把 players / world_state 两张表还原成快照拍摄时刻的样子。
   * @throws Error 当快照不存在，或快照并不属于这个存档时（防止跨存档误回滚）
   */
  async rollbackToSnapshot(saveId: string, snapshotId: string): Promise<players> {
    const snapshot = await this.repo.findById(snapshotId);
    if (!snapshot || snapshot.save_id !== saveId) {
      throw new Error('找不到这个存档下对应的时间戳快照，无法回滚');
    }

    const playerData = stripIdentityFields(snapshot.player_snapshot as Record<string, any>);
    const restoredPlayer = await this.prisma.players.update({
      where: { save_id: saveId },
      data: playerData,
    });

    if (snapshot.world_state_snapshot) {
      const worldStateData = stripIdentityFields(snapshot.world_state_snapshot as Record<string, any>);
      await this.prisma.world_state.update({
        where: { save_id: saveId },
        data: worldStateData,
      });
    }

    return restoredPlayer;
  }
}
