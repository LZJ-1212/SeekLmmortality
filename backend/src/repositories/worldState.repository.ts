import type { PrismaClient, Prisma } from '@prisma/client';
import { parseSceneContext, type SceneContext } from '../services/situation.service';
import { parsePendingScene, type PendingScene } from '../services/sceneMemory.service';

/**
 * world_state 读写。情境字段用原生 SQL，避免 Prisma Client 未 generate
 * 时 update 因 Unknown argument `scene_context` 把整次回合打成 500。
 */
export class WorldStateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findBySaveId(saveId: string) {
    return this.prisma.world_state.findUnique({ where: { save_id: saveId } });
  }

  /**
   * persistable=false：库里还没有该列，或查询失败。此时不要把 scene 写进事务，以免整回合 500。
   */
  async readSceneContext(saveId: string): Promise<{ context: SceneContext; persistable: boolean }> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ scene_context: string | null }>>`
        SELECT scene_context FROM world_state WHERE save_id = ${saveId}
      `;
      return { context: parseSceneContext(rows[0]?.scene_context), persistable: true };
    } catch (error) {
      console.error('read scene_context failed (column missing or client stale):', error);
      return { context: 'none', persistable: false };
    }
  }

  clockUpdate(
    saveId: string,
    data: { current_year: number; current_season: string; pending_months: number },
  ): Prisma.PrismaPromise<unknown> {
    return this.prisma.world_state.update({
      where: { save_id: saveId },
      data,
    });
  }

  sceneContextUpdate(saveId: string, scene: SceneContext): Prisma.PrismaPromise<number> {
    return this.prisma.$executeRaw`
      UPDATE world_state SET scene_context = ${scene} WHERE save_id = ${saveId}
    `;
  }

  /**
   * A6 短记忆读：近事摘要 + 未收束场景。列缺失或查询失败时降级（digest=''/pending='none'），
   * 绝不把整次回合打成 500。
   */
  async readSceneMemory(saveId: string): Promise<{ digest: string; pending: PendingScene; persistable: boolean }> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ last_narrative_digest: string | null; pending_scene: string | null }>>`
        SELECT last_narrative_digest, pending_scene FROM world_state WHERE save_id = ${saveId}
      `;
      return {
        digest: rows[0]?.last_narrative_digest ?? '',
        pending: parsePendingScene(rows[0]?.pending_scene),
        persistable: true,
      };
    } catch (error) {
      console.error('read scene memory failed (columns missing or client stale):', error);
      return { digest: '', pending: 'none', persistable: false };
    }
  }

  /**
   * A6 短记忆写：仅在本回合成功（将返回 200）时调用。调用方须在 persistable 为真时再 push。
   */
  sceneMemoryUpdate(
    saveId: string,
    data: { digest: string; pending: PendingScene },
  ): Prisma.PrismaPromise<number> {
    return this.prisma.$executeRaw`
      UPDATE world_state SET last_narrative_digest = ${data.digest}, pending_scene = ${data.pending} WHERE save_id = ${saveId}
    `;
  }
}
