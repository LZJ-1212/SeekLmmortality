import type { PrismaClient } from '@prisma/client';
import { SaveRepository } from '../repositories/save.repository';

/** 存档列表单条摘要：前端展示用，绝不返回任何密钥/敏感字段。 */
export interface SaveSummary {
  saveId: string;
  saveName: string;
  playerId: string | null;
  playerName: string;
  realmMajor: string;
  realmMinor: string;
  isGameOver: boolean;
  updatedAt: Date;
}

/**
 * 存档列表业务逻辑层（Service）。
 * 负责把 saves 行 + 一对一 players 行整理成前端可直接展示的摘要，
 * 对「存档存在但玩家行缺失」的历史脏数据做兜底，不抛异常。
 */
export class SaveService {
  private readonly repo: SaveRepository;

  constructor(prisma: PrismaClient, repo?: SaveRepository) {
    this.repo = repo ?? new SaveRepository(prisma);
  }

  async listSaves(): Promise<SaveSummary[]> {
    const rows = await this.repo.listAll();
    return rows.map((s) => ({
      saveId: s.id,
      saveName: s.save_name,
      playerId: s.players?.id ?? null,
      playerName: s.players?.name ?? '无名氏',
      realmMajor: s.players?.realm_major ?? '',
      realmMinor: s.players?.realm_minor ?? '',
      isGameOver: s.is_game_over ?? false,
      updatedAt: s.updated_at,
    }));
  }

  /** 删除单个存档；返回该存档是否存在过（存在并删除 true，不存在 false） */
  async deleteSave(saveId: string): Promise<{ deleted: boolean }> {
    const deleted = await this.repo.deleteById(saveId);
    return { deleted };
  }

  /** 删除全部存档；返回实际删除的存档数量 */
  async deleteAllSaves(): Promise<{ deleted: number }> {
    const deleted = await this.repo.deleteAll();
    return { deleted };
  }
}
