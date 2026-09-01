import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

/** 人际关系数据访问层（Repository）。职责单一：只负责与 player_relationships 表的读写。 */
export class RelationshipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAllBySave(saveId: string) {
    return this.prisma.player_relationships.findMany({ where: { save_id: saveId } });
  }

  findByName(saveId: string, npcName: string) {
    return this.prisma.player_relationships.findFirst({ where: { save_id: saveId, npc_name: npcName } });
  }

  create(data: {
    saveId: string;
    npcName: string;
    relationType: string;
    affinity: number;
    npcRealmMajor: string;
    npcBirthYear: number;
    npcMaxLifespan: number;
  }) {
    return this.prisma.player_relationships.create({
      data: {
        id: crypto.randomUUID(),
        save_id: data.saveId,
        npc_name: data.npcName,
        relation_type: data.relationType,
        affinity: data.affinity,
        npc_realm_major: data.npcRealmMajor,
        npc_birth_year: data.npcBirthYear,
        npc_max_lifespan: data.npcMaxLifespan,
        is_deceased: false,
      },
    });
  }

  updateAffinity(id: string, affinity: number, relationType?: string) {
    return this.prisma.player_relationships.update({
      where: { id },
      data: relationType ? { affinity, relation_type: relationType } : { affinity },
    });
  }

  markDeceased(id: string) {
    return this.prisma.player_relationships.update({ where: { id }, data: { is_deceased: true } });
  }
}
