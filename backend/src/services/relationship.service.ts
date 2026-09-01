import type { PrismaClient, player_relationships } from '@prisma/client';
import { RelationshipRepository } from '../repositories/relationship.repository';
import {
  getMaxLifespanForRealm,
  calculateBirthYear,
  isNpcLifespanExhausted,
  clampAffinityDelta,
  buildDeceasedFriendNotice,
} from './npc.service';

export interface NewRelationshipInput {
  npcName: string;
  relationType: string;
  affinityDelta: number;
  npcRealmMajor: string;
  npcAgeYears: number;
}

/**
 * 人际关系业务逻辑层（Service）。负责：记录新关系、更新好感度、检测旧友寿元耗尽。
 * 具体数据库读写全部委托给 RelationshipRepository。
 */
export class RelationshipService {
  private readonly repo: RelationshipRepository;

  constructor(prisma: PrismaClient, repo?: RelationshipRepository) {
    this.repo = repo ?? new RelationshipRepository(prisma);
  }

  async getAll(saveId: string): Promise<player_relationships[]> {
    return this.repo.findAllBySave(saveId);
  }

  async findByName(saveId: string, npcName: string): Promise<player_relationships | null> {
    return this.repo.findByName(saveId, npcName);
  }

  /** 首次记录一段新的人际关系；NPC 的寿元上限由其境界换算，出生年份由当前世界年份与 NPC 年龄推算 */
  async recordNewRelationship(saveId: string, input: NewRelationshipInput, currentWorldYear: number): Promise<player_relationships> {
    return this.repo.create({
      saveId,
      npcName: input.npcName,
      relationType: input.relationType,
      affinity: Math.max(0, clampAffinityDelta(input.affinityDelta)),
      npcRealmMajor: input.npcRealmMajor,
      npcBirthYear: calculateBirthYear(currentWorldYear, input.npcAgeYears),
      npcMaxLifespan: getMaxLifespanForRealm(input.npcRealmMajor),
    });
  }

  /** 更新既有关系的好感度（增量会被夹紧），可选同时更新关系类型（如从"熟人"变为"挚友"） */
  async applyAffinityDelta(relationship: player_relationships, delta: number, relationType?: string): Promise<player_relationships> {
    const newAffinity = Math.max(0, (relationship.affinity ?? 0) + clampAffinityDelta(delta));
    return this.repo.updateAffinity(relationship.id, newAffinity, relationType);
  }

  /**
   * 检测所有"尚未被判定为已故"的关系里，是否有旧友寿元耗尽；命中的会被立即标记为已故
   * （避免下次再重复推送同一份讯息），并返回对应的传音符讯息文案列表。
   */
  async checkForDeceasedFriends(saveId: string, currentWorldYear: number): Promise<string[]> {
    const relationships = await this.repo.findAllBySave(saveId);
    const notices: string[] = [];

    for (const rel of relationships) {
      if (rel.is_deceased) continue;
      if (rel.npc_birth_year == null || rel.npc_max_lifespan == null) continue;
      if (isNpcLifespanExhausted(currentWorldYear, rel.npc_birth_year, rel.npc_max_lifespan)) {
        await this.repo.markDeceased(rel.id);
        notices.push(buildDeceasedFriendNotice(rel.npc_name, rel.relation_type));
      }
    }
    return notices;
  }
}
