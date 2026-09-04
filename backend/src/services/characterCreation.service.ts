/** 修订：2026-09-05 01:11 +08 lzj — 创角落口令仓哈希 */
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { ReincarnationDbService } from './reincarnationDb.service';
import { resolveLegacyBlessing, type LegacyBlessingResult } from './reincarnation.service';
import { aggregateBuildEffects, type SixAttributeKey, type CharacterBuild } from './characterBuild.service';
import { buildOpeningNarrative, type OpeningResult } from './opening.service';

/**
 * 创角业务逻辑层（Service）。
 * 负责把玩家创角提交的「姓名 / 性别 / 六维 / 灵根 / 出身 / 道途 / 体质 / 先天天赋」
 * 落成一份完整的存档：saves + world_state + players 三张表 + 命格折算 + 轮回遗泽 + 开场剧情。
 * 具体数据库读写仍委托给 prisma，Service 本身不再耦合 HTTP 的 Request/Response。
 */

/** 创角请求体的业务输入（已通过 gateway 的 assertCreatePlayerBody 校验） */
export interface CreatePlayerInput {
  name?: string;
  gender?: string;
  attributes?: Partial<Record<SixAttributeKey, number>>;
  roots?: string[];
  origin?: string;
  daoPursuit?: string;
  constitution?: string;
  talents?: string[];
}

/** 创角成功时返回给前端的数据载荷 */
export interface CreatePlayerSuccessData {
  playerId: string;
  saveId: string;
  opening: OpeningResult;
  legacyBlessing: { type: string; narrativeText: string } | null;
}

/** 创角结果：成功携带提示语与数据；失败仅携带提示语（HTTP 状态码由路由层决定） */
export type CreatePlayerResult =
  | { ok: true; message: string; data: CreatePlayerSuccessData }
  | { ok: false; message: string };

const SIX_ATTRIBUTE_DEFAULT = 10;
const STARTING_AGE = 16;
const STARTING_BASE_MAX_HP = 100;
const STARTING_BASE_MAX_LIFESPAN = 100;
const STARTING_MP = 100;

export class CharacterCreationService {
  private readonly inventoryService: InventoryService;
  private readonly reincarnationService: ReincarnationDbService;

  constructor(private readonly prisma: PrismaClient) {
    this.inventoryService = new InventoryService(prisma);
    this.reincarnationService = new ReincarnationDbService(prisma);
  }

  /** 依据灵根数量推算灵根品质（1=天灵根，2=地灵根，3=真灵根，≥4=杂灵根） */
  private resolveRootQuality(rootCount: number): string {
    if (rootCount === 1) return '天灵根';
    if (rootCount === 2) return '地灵根';
    if (rootCount === 3) return '真灵根';
    return '伪灵根';
  }

  /** 把创角命格（出身/道途/体质/天赋）+ 轮回遗泽折算成最终六维 */
  private buildFinalAttributes(
    attributes: Partial<Record<SixAttributeKey, number>> | undefined,
    attributeBonus: Partial<Record<SixAttributeKey, number>>,
    legacyBlessing: LegacyBlessingResult,
  ): Record<SixAttributeKey, number> {
    const finalAttributes: Record<SixAttributeKey, number> = {
      aptitude: attributes?.aptitude ?? SIX_ATTRIBUTE_DEFAULT,
      comprehension: attributes?.comprehension ?? SIX_ATTRIBUTE_DEFAULT,
      divine_sense: attributes?.divine_sense ?? SIX_ATTRIBUTE_DEFAULT,
      speed: attributes?.speed ?? SIX_ATTRIBUTE_DEFAULT,
      dao_heart: attributes?.dao_heart ?? SIX_ATTRIBUTE_DEFAULT,
      fortune: attributes?.fortune ?? SIX_ATTRIBUTE_DEFAULT,
    };

    for (const [key, bonus] of Object.entries(attributeBonus)) {
      const k = key as SixAttributeKey;
      finalAttributes[k] = Math.min(20, Math.max(1, finalAttributes[k] + (bonus ?? 0)));
    }

    if (legacyBlessing.type === 'attribute_boost' && legacyBlessing.attributeKey) {
      const k = legacyBlessing.attributeKey;
      finalAttributes[k] = Math.min(20, Math.max(1, finalAttributes[k] + (legacyBlessing.attributeBonus ?? 0)));
    }

    return finalAttributes;
  }

  async create(input: CreatePlayerInput, ownerTokenHash: string | null = null): Promise<CreatePlayerResult> {
    try {
      const {
        name, gender, attributes, roots,
        origin, daoPursuit, constitution, talents,
      } = input;

      const saveId = crypto.randomUUID();
      const playerId = crypto.randomUUID();

      const rootsArray = roots ?? [];
      const rootQuality = this.resolveRootQuality(rootsArray.length);
      const spiritualRootsData = { quality: rootQuality, elements: rootsArray };

      // 【轮回与读档机制】：死亡并非终结——随机检索轮回池里的前世角色，可能触发前世遗泽
      const legacyCandidate = await this.reincarnationService.pickLegacyCandidate();
      const legacyBlessing = legacyCandidate
        ? resolveLegacyBlessing(legacyCandidate.attributes)
        : ({ type: 'none' as const, narrativeText: '' } satisfies LegacyBlessingResult);

      // 将出身、体质、道途、天赋统一打包进 talents JSON 字段（先构建，供命格效果计算使用）
      const talentsData: CharacterBuild = {
        ...(origin !== undefined ? { origin } : {}),
        ...(daoPursuit !== undefined ? { daoPursuit } : {}),
        ...(constitution !== undefined ? { constitution } : {}),
        ...(talents !== undefined ? { innateTalents: talents } : {}),
      };

      // 【创角命格落地】：出身/道途/体质/先天天赋折算成真实的六维加成、气血/寿元上限与初始灵石
      const buildEffects = aggregateBuildEffects(talentsData);
      const finalAttributes = this.buildFinalAttributes(attributes, buildEffects.attributeBonus, legacyBlessing);

      const startingMaxHp = STARTING_BASE_MAX_HP + buildEffects.maxHpBonus;
      const startingMaxLifespan = STARTING_BASE_MAX_LIFESPAN + buildEffects.maxLifespanBonus;
      const startingSpiritStones = buildEffects.spiritStonesBonus;

      // 开局剧情：把玩家的名字/性别/出身/体质/道途/灵根/天赋/六维织成一段身世
      const opening = buildOpeningNarrative({
        name: name || '无名氏',
        ...(gender !== undefined ? { gender } : {}),
        ...(origin !== undefined ? { origin } : {}),
        ...(daoPursuit !== undefined ? { daoPursuit } : {}),
        ...(constitution !== undefined ? { constitution } : {}),
        roots: spiritualRootsData,
        innateTalents: Array.isArray(talents) ? talents : [],
        attributes: finalAttributes,
        legacyBlessing: legacyBlessing.type !== 'none' ? legacyBlessing : null,
      });

      await this.prisma.$transaction([
        this.prisma.saves.create({
          data: {
            id: saveId,
            save_slot: 1,
            save_name: `${name}的修仙录`,
            ...(ownerTokenHash ? { owner_token_hash: ownerTokenHash } : {}),
          },
        }),
        this.prisma.world_state.create({
          data: {
            save_id: saveId,
            current_year: 387,
            current_season: '春',
          },
        }),
        this.prisma.players.create({
          data: {
            id: playerId,
            save_id: saveId,
            name: name || '无名氏',
            dao_name: '未定',
            gender: gender || '男',
            age: STARTING_AGE,
            max_lifespan: startingMaxLifespan,
            realm_major: '炼气',
            realm_minor: '初期',
            hp: startingMaxHp, max_hp: startingMaxHp, mp: STARTING_MP, max_mp: STARTING_MP,
            spirit_stones: startingSpiritStones,
            aptitude: finalAttributes.aptitude,
            comprehension: finalAttributes.comprehension,
            divine_sense: finalAttributes.divine_sense,
            speed: finalAttributes.speed,
            dao_heart: finalAttributes.dao_heart,
            fortune: finalAttributes.fortune,
            appearance: 3,
            spiritual_roots: JSON.stringify(spiritualRootsData),
            talents: JSON.stringify(talentsData),
            status_effects: JSON.stringify([]),
            current_location: '青岳·天机坊市',
          },
        }),
      ]);

      // 前世遗泽落地：法宝类奖励需要背包基础设施，等新存档创建完毕后再赠予；
      // 只有真正授予了遗泽（而非"未触发"）才消耗掉这个轮回池名额，否则留给未来某一世继续尝试。
      if (legacyBlessing.type === 'buried_treasure' && legacyBlessing.treasure) {
        await this.inventoryService.addItem(saveId, {
          name: legacyBlessing.treasure.name,
          change: 1,
          category: 'material',
          rarity: legacyBlessing.treasure.rarity,
          description: legacyBlessing.treasure.description,
        });
      }
      if (legacyCandidate && legacyBlessing.type !== 'none') {
        await this.reincarnationService.consumeLegacy(legacyCandidate.saveId);
      }

      return {
        ok: true,
        message: `道音轰鸣！【${origin}】出身的【${rootQuality}】修士降生九州。`,
        data: {
          playerId,
          saveId,
          opening: { paragraphs: opening.paragraphs, options: opening.options },
          legacyBlessing: legacyBlessing.type !== 'none'
            ? { type: legacyBlessing.type, narrativeText: legacyBlessing.narrativeText }
            : null,
        },
      };
    } catch (error) {
      console.error('创角失败:', error);
      return { ok: false, message: '天机混乱，命格凝聚失败。' };
    }
  }
}
