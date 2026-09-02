import type { Prisma, PrismaClient, player_cave, players } from '@prisma/client';
import { prisma as globalPrisma } from '../db/prisma';
import { InventoryService } from './inventory.service';
import { CaveService, detectEstablishCaveIntent, detectGrantCaveIntent, resolveSeclusionSpiritualDensity } from './cave.service';
import {
  SectService,
  detectBetrayalIntent,
  buildHuntedByEnforcersDirective,
  clampSectReputationDelta,
  getSectRankByReputation,
  TRAITOR_RANK_LABEL,
  type SectStatus,
} from './sect.service';
import { RelationshipService, deceasedNpcForcedOutcome } from './relationship.service';
import { isDualCultivationAttempt, resolveDualCultivation } from './npc.service';
import { findLongestMatchingName } from '../utils/textMatch';
import { REALM_RANKS, resolveCombatModifiers, parseElementsFromSpiritualRoots } from './combat.service';
import {
  isExplorationAttempt,
  rollExplorationEncounter,
  findExplorationRegion,
  checkRegionDanger,
  EXPLORATION_REGIONS,
} from './exploration.service';
import {
  getOwnedTalents,
  getRealmTalentIds,
  getCombatDamageMultiplier,
  getCombatDefenseMultiplier,
  getCultivationSpeedMultiplier,
  pickRandomTalentChoices,
  parseTalentsData,
} from './talent.service';
import {
  getBuildCultivationSpeedMultiplier,
  getBuildCombatDamageMultiplier,
  getBuildCombatDefenseMultiplier,
  getSpeedDodgeMultiplier,
} from './characterBuild.service';
import { isEligibleForSamsara } from './reincarnation.service';
import { SnapshotService } from './snapshot.service';
import { evaluateSituation, nextSceneContext } from './situation.service';
import { WorldStateRepository } from '../repositories/worldState.repository';
import { QuotaService, QuotaRepository } from '../gateway';
import { deduceAction } from '../../ai';
import { unlearnedSpellForcedOutcome } from './technique.service';
import { detectMiracleClaim, rollMiracle } from './miracle.service';
import { calculateSeclusionCultivationGain } from './cultivationFormula.service';
import { detectCraftingAttempt, resolveCrafting } from './crafting.service';
import {
  clampSpiritStonesDelta,
  detectShopActionType,
  findMentionedTemplateName,
  detectTradeQuantity,
  resolveShopTransaction,
  detectAuctionBidAmount,
  resolveAuctionBid,
  type ShopActionType,
} from './economy.service';
import { resolveKarmaRetribution, clampMeritDelta, clampKarmaDelta } from './karma.service';
import {
  REALM_LAWS,
  resolveBreakthroughAttempt,
  clampResource,
  applyCultivationDelta,
  advanceAge,
  advanceWorldTime,
  getDeathReason,
  detectSeclusionMonths,
  describeMonths,
  getLifespanStatus,
  type DeathReason,
  type LifespanStatus,
} from './playerState.service';
import type { ItemChangeInput } from './inventory.service';

/**
 * 天道推演编排层（Service）。
 * 把「一次玩家行动」从入参到落库的完整编排收敛到这里：
 * 境界突破拦截 → 业力天罚 → 物品真实性 → 洞府 → 闭关 → 修仙百艺 → 坊市 → 拍卖 →
 * 叛宗 → 双修 → 探索 → 高危地图 → 旧友仙逝 → 寿元预警 → AI 推演 → 战斗结算 → 状态机结算 →
 * 时间流逝 → 死亡判定 → 宗门/人际关系落库 → 背包变更 → 快照。
 * 具体 HTTP 的 Request/Response 处理留在路由层。
 */

/** 一次成功行动返回给前端的完整数据载荷 */
export interface ActionSuccessData {
  narrative: string | undefined;
  options: { tag: string; text: string }[] | undefined;
  monthsPassed: number;
  isDead: boolean;
  deathReason: DeathReason;
  enteredSamsaraPool: boolean;
  lifespanStatus: LifespanStatus | null;
  combat: {
    enemyName: string;
    outcome: string;
    realmGap: number;
    damageTaken: number;
    damageDealt: number;
  } | null;
  talentChoices: { id: string; name: string; description: string }[] | null;
  karmaRetribution: { tier: string | null; fatal: boolean } | null;
  crafting: { discipline: string; resultName: string; success: boolean } | null;
  seclusionCultivationGain: number | null;
  cave: player_cave | null;
  shopTransaction: { type: ShopActionType | null; itemName: string | null; success: boolean; spiritStonesDelta: number } | null;
  auction: { won: boolean; finalPrice: number } | null;
  sect: SectStatus | null;
  sectPromotion: { fromRank: string; toRank: string } | null;
  sectBetrayed: boolean;
  dualCultivation: { npcName: string | null; success: boolean; cultivationBonus: number } | null;
  deceasedFriendNotices: string[];
  exploration: { roll: number; encounterType: string } | null;
  regionDanger: { regionName: string; isLethal: boolean } | null;
  player: players;
}

/** 行动结果：成功携带数据；失败携带 HTTP 状态码与提示语 */
export type ActionResult =
  | { ok: true; data: ActionSuccessData }
  | { ok: false; status: number; message: string };

/** players.spiritual_roots 里的 quality 字段解析（如 "地灵根"），解析失败时安全退化为中性品质 */
function parseRootQuality(spiritualRoots: unknown): string {
  try {
    const data = typeof spiritualRoots === 'string' ? JSON.parse(spiritualRoots) : spiritualRoots;
    return typeof (data as { quality?: unknown })?.quality === 'string' ? (data as { quality: string }).quality : '真灵根';
  } catch {
    return '真灵根';
  }
}

const STARTING_WORLD_YEAR = 387;
const STARTING_WORLD_SEASON = '春';
const DEFAULT_AGE = 16;

export class ActionService {
  private readonly prisma: PrismaClient;
  private readonly inventoryService: InventoryService;
  private readonly caveService: CaveService;
  private readonly sectService: SectService;
  private readonly relationshipService: RelationshipService;
  private readonly quotaService: QuotaService;
  private readonly snapshotService: SnapshotService;
  private readonly worldStateRepo: WorldStateRepository;

  constructor(client: PrismaClient = globalPrisma) {
    this.prisma = client;
    this.inventoryService = new InventoryService(client);
    this.caveService = new CaveService(client);
    this.sectService = new SectService(client);
    this.relationshipService = new RelationshipService(client);
    this.quotaService = new QuotaService(new QuotaRepository(client));
    this.snapshotService = new SnapshotService(client);
    this.worldStateRepo = new WorldStateRepository(client);
  }

  async execute(playerId: string, action: string): Promise<ActionResult> {
    try {
      const player = await this.prisma.players.findUnique({
        where: { id: playerId },
        include: { saves: true },
      });
      if (!player) return { ok: false, status: 404, message: '修士不存在' };

      // 【死亡锁】：存档一旦被标记为终结（气血耗尽或寿元耗尽），无论如何都不允许再有任何行动
      const alreadyDead = player.saves?.is_game_over
        || getDeathReason(player.hp ?? 100, player.age ?? DEFAULT_AGE, player.max_lifespan ?? 100) !== null;
      if (alreadyDead) {
        return { ok: false, status: 403, message: '大限已至，道消身陨，万事皆休。' };
      }

      // 世界状态：情境锁 + 年份/旧友检测复用
      const worldState = await this.worldStateRepo.findBySaveId(player.save_id);
      const { context: sceneContext, persistable: scenePersistable } = await this.worldStateRepo.readSceneContext(player.save_id);
      const situation = evaluateSituation(sceneContext, action);
      if (!situation.ok) {
        return { ok: false, status: 400, message: situation.message };
      }

      // 每日行动配额
      const quotaResult = await this.quotaService.tryConsumeDailyAction(playerId);
      if (!quotaResult.ok) {
        return { ok: false, status: 429, message: '今日推演次数已尽，明日再来。' };
      }

      let cave = await this.caveService.getCave(player.save_id);
      // 宗门：可能为 null（尚未加入任何宗门，即"散修"），这是合法状态，不做懒加载兜底
      const playerSect = await this.sectService.getSect(player.save_id);
      // 人际关系：全部现有关系，供双修目标匹配 + 旧友寿元耗尽检测复用
      const relationships = await this.relationshipService.getAll(player.save_id);
      // 逆天改命天赋：已拥有的天赋列表，供战斗/修炼计算读取全局乘数
      const ownedTalents = getOwnedTalents(player.talents);
      // 创角命格：出身/道途/体质/先天天赋，供战斗/修炼计算读取命格全局乘数
      const characterBuild = parseTalentsData(player.talents);

      const forcedOutcomeParts: string[] = [];

      // 【核心拦截器 1】：境界突破与渡雷劫——所有数值变化由后端硬计算
      const attemptingBreakthrough = action.includes('突破') || action.includes('破境') || action.includes('结丹') || action.includes('渡劫');
      const breakthroughResult = attemptingBreakthrough
        ? resolveBreakthroughAttempt(
            {
              realmMajor: player.realm_major,
              realmMinor: player.realm_minor,
              cultivation: player.cultivation ?? 0,
              hp: player.hp ?? 100,
              maxHp: player.max_hp ?? 100,
              maxLifespan: player.max_lifespan ?? 100,
              daoHeart: player.dao_heart ?? 10,
              merit: player.merit ?? 0,
            },
            REALM_LAWS,
          )
        : null;
      if (breakthroughResult) {
        forcedOutcomeParts.push(breakthroughResult.forcedOutcomeText);
      }
      const maxLifespanForThisTurn = breakthroughResult ? breakthroughResult.patch.maxLifespan : (player.max_lifespan ?? 100);

      // 【逆天改命体系】：大境界渡雷劫成功后，直接下发三个天赋选项（三选一）
      const talentChoices = breakthroughResult?.isMajorBreakthroughSuccess
        ? pickRandomTalentChoices(getRealmTalentIds(player.talents), 3)
        : [];
      if (talentChoices.length > 0) {
        forcedOutcomeParts.push(
          '玩家刚刚成功渡过大境界的雷劫，天道因此赐下一线机缘，即将有三条逆天改命的天赋供其抉择（此事交由玩家在界面上自行选择，你只需在叙事里带一句"隐约感觉到冥冥中有几分因果可供自己抉择"，不必展开具体选项）。',
        );
      }

      // 【核心拦截器 2】：业力天罚——业力越高越容易招致天罚，是否触发、伤害多少全部由后端硬性掷骰决定
      const karmaRetributionResult = !breakthroughResult
        ? resolveKarmaRetribution({
            karma: player.karma ?? 0,
            merit: player.merit ?? 0,
            hp: player.hp ?? 100,
            maxHp: player.max_hp ?? 100,
            cultivation: player.cultivation ?? 0,
          })
        : null;
      if (karmaRetributionResult?.triggered) {
        forcedOutcomeParts.push(karmaRetributionResult.forcedOutcomeText);
      }

      // 【核心拦截器 3】：物品真实性校验——防止 AI 凭空编造玩家使用了背包里没有的字典物品
      const fabricationWarning = await this.inventoryService.detectFabricatedItemUsage(player.save_id, action);
      if (fabricationWarning) {
        forcedOutcomeParts.push(fabricationWarning);
      }

      const spellFizzle = unlearnedSpellForcedOutcome(action, []);
      if (spellFizzle) {
        forcedOutcomeParts.push(spellFizzle);
      }

      const deceasedVisit = deceasedNpcForcedOutcome(action, relationships);
      if (deceasedVisit) {
        forcedOutcomeParts.push(deceasedVisit);
      }

      const wantsEstablish = detectEstablishCaveIntent(action);
      const wantsGrant = detectGrantCaveIntent(action);
      if (wantsGrant && !wantsEstablish && !playerSect) {
        forcedOutcomeParts.push('玩家并无宗门，何来赐府。叙事须点明无人授府，不得凭空得洞府。');
      } else if (wantsEstablish || (wantsGrant && playerSect)) {
        const locationName = player.current_location ?? '青岳·天机坊市';
        const established = await this.caveService.establishCave(player.save_id, locationName);
        if (established.ok) {
          cave = established.cave;
          const how = wantsGrant && playerSect && !wantsEstablish ? '宗门赐府' : '自行开辟';
          forcedOutcomeParts.push(`玩家于「${locationName}」${how}，洞府落成。此后闭关方可凭府中灵脉；叙事须写清开府安家，不得写成客栈即洞府。`);
        } else {
          forcedOutcomeParts.push('玩家已有洞府，不得另开一座。叙事须点明旧府仍在，此次开府落空。');
        }
      }

      // 【核心拦截器 4】：闭关时长解析——具体闭关多久绝不能让 AI 随口猜测
      const seclusionMonths = detectSeclusionMonths(action);
      const seclusionAura = resolveSeclusionSpiritualDensity(
        cave ? { spiritual_density: cave.spiritual_density ?? 10 } : null,
        player.current_location ?? '青岳·天机坊市',
      );
      const seclusionCultivationGain = seclusionMonths !== null && !breakthroughResult && !karmaRetributionResult?.triggered
        ? calculateSeclusionCultivationGain(
            {
              aptitude: player.aptitude ?? 10,
              rootQuality: parseRootQuality(player.spiritual_roots),
              daoHeart: player.dao_heart ?? 10,
              caveSpiritualDensity: seclusionAura.density,
              talentCoefficient: getCultivationSpeedMultiplier(ownedTalents) * getBuildCultivationSpeedMultiplier(characterBuild),
            },
            seclusionMonths,
          )
        : null;
      if (seclusionMonths !== null) {
        const auraNote = seclusionAura.source === 'cave'
          ? `此次闭关，凭借洞府灵气与自身根骨，修为精进 ${seclusionCultivationGain} 点，需在叙事中体现修为大有长进。`
          : `玩家并无洞府，只得借地打坐，灵气散逸。此次修为精进 ${seclusionCultivationGain} 点。叙事不得写成已有洞府或客栈即洞府。`;
        forcedOutcomeParts.push(
          `玩家决定闭关，此次共计闭关 ${describeMonths(seclusionMonths)}。须以"山中无甲子，寒尽不知年"的笔法一笔带过这段漫长时光，直接描写出关后的状态与心境变化，不要逐日描写修炼过程。`
          + (seclusionCultivationGain !== null ? auraNote : ''),
        );
      }

      // 【核心拦截器 5】：修仙百艺——炼丹/炼器/阵法/灵植的成败与产出，由后端依据悟性/神识硬性判定
      const craftingRecipe = detectCraftingAttempt(action);
      const craftingResult = craftingRecipe
        ? resolveCrafting({
            recipe: craftingRecipe,
            comprehension: player.comprehension ?? 10,
            divineSense: player.divine_sense ?? 10,
          })
        : null;
      if (craftingResult) {
        forcedOutcomeParts.push(craftingResult.forcedOutcomeText);
      }

      // 【核心拦截器 6】：坊市买卖——成交价格完全取决于物品图鉴（items_template.base_price）
      const shopActionType = detectShopActionType(action);
      let matchedShopItemName: string | null = null;
      let shopTransactionResult: ReturnType<typeof resolveShopTransaction> | null = null;
      if (shopActionType) {
        const allTemplateNames = await this.inventoryService.listAllTemplateNames();
        matchedShopItemName = findMentionedTemplateName(action, allTemplateNames);
        if (matchedShopItemName) {
          const shopTemplate = await this.inventoryService.getTemplateByName(matchedShopItemName);
          if (shopTemplate) {
            const tradeQuantity = detectTradeQuantity(action);
            const ownedQuantity = shopActionType === 'sell'
              ? await this.inventoryService.getOwnedQuantityByName(player.save_id, matchedShopItemName)
              : undefined;
            shopTransactionResult = resolveShopTransaction({
              type: shopActionType,
              itemName: matchedShopItemName,
              basePrice: shopTemplate.base_price ?? 10,
              quantity: tradeQuantity,
              playerSpiritStones: player.spirit_stones ?? 0,
              ...(ownedQuantity !== undefined ? { playerOwnedQuantity: ownedQuantity } : {}),
            });
            forcedOutcomeParts.push(shopTransactionResult.forcedOutcomeText);
          }
        }
      }

      // 【核心拦截器 7】：拍卖会喊价——是否中标、成交价全部由后端与虚拟对手的心理价位掷骰决定
      const auctionBidAmount = detectAuctionBidAmount(action);
      let matchedAuctionItemName: string | null = null;
      let auctionResult: ReturnType<typeof resolveAuctionBid> | null = null;
      if (auctionBidAmount !== null) {
        const allTemplateNames = await this.inventoryService.listAllTemplateNames();
        matchedAuctionItemName = findMentionedTemplateName(action, allTemplateNames);
        const auctionTemplate = matchedAuctionItemName ? await this.inventoryService.getTemplateByName(matchedAuctionItemName) : null;
        const itemBaseValue = auctionTemplate?.base_price ?? 200;
        const rarity = auctionTemplate?.rarity ?? 3;
        auctionResult = resolveAuctionBid({
          bidAmount: auctionBidAmount,
          itemBaseValue,
          rarity,
          playerSpiritStones: player.spirit_stones ?? 0,
        });
        forcedOutcomeParts.push(auctionResult.forcedOutcomeText);
      }

      // 【核心拦截器 8】：叛宗——是否叛出师门是重大分支，必须由后端关键词硬性判定
      const willBetraySectThisTurn = !!playerSect && !playerSect.is_traitor && detectBetrayalIntent(action);
      const sectNameForDirective = playerSect?.sect_name ?? '原宗门';
      if (willBetraySectThisTurn) {
        forcedOutcomeParts.push(`玩家在这一刻彻底叛出「${sectNameForDirective}」，从此与昔日同门恩断义绝，被打上叛徒的烙印，声望清零。`);
      }
      if (playerSect?.is_traitor || willBetraySectThisTurn) {
        forcedOutcomeParts.push(buildHuntedByEnforcersDirective(sectNameForDirective));
      }

      // 【核心拦截器 9】：人际与情缘双修——全性向，只看好感度，增益幅度由后端硬性计算
      let dualCultivationTargetName: string | null = null;
      let dualCultivationResult: ReturnType<typeof resolveDualCultivation> | null = null;
      const livingRelationships = relationships.filter((rel) => !rel.is_deceased);
      if (isDualCultivationAttempt(action) && livingRelationships.length > 0) {
        dualCultivationTargetName = findLongestMatchingName(action, livingRelationships.map((r) => r.npc_name));
        if (dualCultivationTargetName) {
          const targetRelationship = livingRelationships.find((r) => r.npc_name === dualCultivationTargetName)!;
          dualCultivationResult = resolveDualCultivation(dualCultivationTargetName, {
            affinity: targetRelationship.affinity ?? 0,
            playerMaxHp: player.max_hp ?? 100,
            playerMaxMp: player.max_mp ?? 100,
          });
          forcedOutcomeParts.push(dualCultivationResult.forcedOutcomeText);
        }
      }

      // 【核心拦截器 10】：探索与随机奇遇——1d100 掷骰机制，仙缘决定触发概率
      const explorationEncounter = isExplorationAttempt(action)
        ? rollExplorationEncounter(player.fortune ?? 10)
        : null;
      if (explorationEncounter?.triggered) {
        forcedOutcomeParts.push(explorationEncounter.forcedOutcomeText);
      }

      const mentionedRegionName = findLongestMatchingName(action, EXPLORATION_REGIONS.map((r) => r.name));
      const regionDangerCheck = mentionedRegionName
        ? checkRegionDanger(REALM_RANKS[player.realm_major] ?? 0, findExplorationRegion(mentionedRegionName))
        : null;
      if (regionDangerCheck?.isDangerous) {
        forcedOutcomeParts.push(regionDangerCheck.forcedOutcomeText);
      }

      // 【背景因果】：昔日旧友寿元耗尽——每一回合都要检查一次
      const projectedWorldYear = worldState
        ? seclusionMonths !== null
          ? advanceWorldTime(worldState.current_year ?? STARTING_WORLD_YEAR, worldState.current_season ?? STARTING_WORLD_SEASON, worldState.pending_months ?? 0, seclusionMonths).newYear
          : (worldState.current_year ?? STARTING_WORLD_YEAR)
        : STARTING_WORLD_YEAR;
      const deceasedFriendNotices = worldState
        ? await this.relationshipService.checkForDeceasedFriends(player.save_id, projectedWorldYear)
        : [];
      for (const notice of deceasedFriendNotices) {
        forcedOutcomeParts.push(notice);
      }

      // 【大限压迫感】：寿元告急时，持续给 AI 的叙事施加紧迫感
      const preActionLifespanStatus = getLifespanStatus(player.age ?? DEFAULT_AGE, maxLifespanForThisTurn);
      if (preActionLifespanStatus.warningMessage) {
        forcedOutcomeParts.push(preActionLifespanStatus.warningMessage);
      }

      // 【核心拦截器 11 / A5】：宣称奇迹封闭骰——狂句必骰、失败落空、不破差两大境秒杀。
      // 与闭关/突破等拦截器并列，只看「反杀/神器/秒杀」子串，互不误触；放在调模型之前，
      // 只追加叙事约束，不改 hp_delta / 物品 / 伤害，秒杀仍由下方战斗公式裁决。
      const miracleClaim = detectMiracleClaim(action);
      if (miracleClaim) {
        const miracleRoll = rollMiracle(player.fortune ?? 10, miracleClaim);
        forcedOutcomeParts.push(miracleRoll.forcedOutcomeText);
      }

      const forcedOutcome = forcedOutcomeParts.join('\n');

      // 查询背包（用于传递给 AI）
      const inventoryStr = await this.inventoryService.getInventoryPromptString(player.save_id);

      // hp/修为是否已被后端锁定
      const hasLockedNumbers = !!breakthroughResult || !!karmaRetributionResult?.triggered || seclusionCultivationGain !== null || !!regionDangerCheck?.isDangerous;

      // 丢给 DeepSeek 进行推演
      const deduction = await deduceAction(
        player,
        action,
        forcedOutcome,
        inventoryStr,
        hasLockedNumbers,
        cave ? {
          level: cave.level ?? 1,
          spiritualDensity: cave.spiritual_density ?? 10,
          locationName: cave.location_name ?? player.current_location ?? '青岳·天机坊市',
        } : undefined,
        playerSect ? {
          sectName: playerSect.sect_name,
          rank: playerSect.rank ?? '试炼弟子',
          reputation: playerSect.reputation ?? 0,
          isTraitor: !!playerSect.is_traitor,
        } : undefined,
        relationships,
      );

      // ==================== 战斗与境界压制 ====================
      const combat = deduction.combat ?? null;
      const combatResolution = combat?.in_combat
        ? resolveCombatModifiers(
            { realmMajor: player.realm_major, elements: parseElementsFromSpiritualRoots(player.spiritual_roots) },
            { realmMajor: combat.enemy_realm_major ?? '', elements: combat.enemy_element ? [combat.enemy_element] : [] },
          )
        : null;

      // ==================== 核心状态机：气血/灵力/修为结算 ====================
      const maxHp = breakthroughResult ? breakthroughResult.patch.maxHp : (player.max_hp ?? 100);
      const maxLifespan = maxLifespanForThisTurn;
      const realmMajor = breakthroughResult ? breakthroughResult.patch.realmMajor : player.realm_major;
      const realmMinor = breakthroughResult ? breakthroughResult.patch.realmMinor : player.realm_minor;

      const talentDamageMultiplier = getCombatDamageMultiplier(ownedTalents) * getBuildCombatDamageMultiplier(characterBuild);
      const talentDefenseMultiplier = getCombatDefenseMultiplier(ownedTalents) * getBuildCombatDefenseMultiplier(characterBuild) * getSpeedDodgeMultiplier(player.speed ?? 10);

      let combatHpDelta = 0;
      let effectiveDamageToEnemy = 0;
      if (combatResolution) {
        if (combatResolution.outcome === 'enemy_instant_win') {
          combatHpDelta = -(player.hp ?? 100); // 直接碾压秒杀：气血归零
        } else if (combatResolution.outcome === 'normal') {
          combatHpDelta = -Math.round((combat!.base_damage_to_player || 0) * combatResolution.enemyDamageMultiplier * talentDefenseMultiplier);
          effectiveDamageToEnemy = Math.round((combat!.base_damage_to_enemy || 0) * combatResolution.playerDamageMultiplier * talentDamageMultiplier);
        }
        // 'player_instant_win'：玩家碾压获胜，不掉血
      }

      const newHp = breakthroughResult
        ? breakthroughResult.patch.hp
        : karmaRetributionResult?.triggered
          ? karmaRetributionResult.patch.hp
          : regionDangerCheck?.isDangerous
            ? clampResource(player.hp ?? 100, -Math.round(maxHp * regionDangerCheck.hpDamagePercent), maxHp)
            : dualCultivationResult?.success
              ? clampResource(player.hp ?? 100, dualCultivationResult.hpRestore, maxHp)
              : combatResolution
                ? clampResource(player.hp ?? 100, combatHpDelta, maxHp)
                : clampResource(player.hp ?? 100, deduction.hp_delta || 0, maxHp);
      const newMp = dualCultivationResult?.success
        ? clampResource(player.mp ?? 100, dualCultivationResult.mpRestore, player.max_mp ?? 100)
        : clampResource(player.mp ?? 100, deduction.mp_delta || 0, player.max_mp ?? 100);
      const newCultivation = breakthroughResult
        ? breakthroughResult.patch.cultivation
        : karmaRetributionResult?.triggered
          ? karmaRetributionResult.patch.cultivation
          : seclusionCultivationGain !== null
            ? applyCultivationDelta(player.cultivation ?? 0, seclusionCultivationGain)
            : dualCultivationResult?.success
              ? applyCultivationDelta(player.cultivation ?? 0, dualCultivationResult.cultivationBonus)
              : applyCultivationDelta(player.cultivation ?? 0, deduction.cultivation_delta || 0);

      // ==================== 核心状态机：时间流逝 ====================
      const monthsPassed = seclusionMonths ?? craftingRecipe?.craftMonths ?? (deduction.time_cost_months || 1);
      const { newAge, newPendingMonths } = advanceAge(player.age ?? DEFAULT_AGE, player.pending_months ?? 0, monthsPassed);

      // ==================== 核心状态机：死亡判定 ====================
      const deathReason = breakthroughResult?.diedFromTribulation
        ? 'tribulation_failure'
        : karmaRetributionResult?.fatal
          ? 'karma_retribution'
          : regionDangerCheck?.isLethal
            ? 'region_danger'
            : combatResolution?.outcome === 'enemy_instant_win'
              ? 'realm_suppression'
              : getDeathReason(newHp, newAge, maxLifespan);
      const isDeadNow = deathReason !== null;

      const lifespanStatus = isDeadNow ? null : getLifespanStatus(newAge, maxLifespan);

      // ==================== 宗门势力运转 ====================
      const sectEvent = deduction.sect_event;
      let sectPromotion: { fromRank: string; toRank: string } | null = null;
      let sectStatusForResponse: SectStatus | null =
        playerSect ? { sectName: playerSect.sect_name, rank: playerSect.rank ?? '试炼弟子', reputation: playerSect.reputation ?? 0, isTraitor: !!playerSect.is_traitor } : null;

      if (willBetraySectThisTurn && playerSect) {
        sectStatusForResponse = { sectName: playerSect.sect_name, rank: TRAITOR_RANK_LABEL, reputation: 0, isTraitor: true };
      } else if (!playerSect && sectEvent?.joined_sect_name) {
        sectStatusForResponse = { sectName: sectEvent.joined_sect_name, rank: '试炼弟子', reputation: 0, isTraitor: false };
      } else if (playerSect && !playerSect.is_traitor && sectEvent?.reputation_delta) {
        const newReputation = Math.max(0, (playerSect.reputation ?? 0) + clampSectReputationDelta(sectEvent.reputation_delta));
        const newRank = getSectRankByReputation(newReputation);
        const fromRank = playerSect.rank ?? '试炼弟子';
        if (newRank !== fromRank) sectPromotion = { fromRank, toRank: newRank };
        sectStatusForResponse = { sectName: playerSect.sect_name, rank: newRank, reputation: newReputation, isTraitor: false };
      }

      // ==================== 人际关系：新建关系 / 好感度更新 ====================
      const relationshipEvent = deduction.relationship_event;
      if (relationshipEvent?.npc_name) {
        const existingRelationship = relationships.find((r) => r.npc_name === relationshipEvent.npc_name);
        if (!existingRelationship && relationshipEvent.is_new) {
          await this.relationshipService.recordNewRelationship(
            player.save_id,
            {
              npcName: relationshipEvent.npc_name,
              relationType: relationshipEvent.relation_type || '相识',
              affinityDelta: relationshipEvent.affinity_delta || 0,
              npcRealmMajor: relationshipEvent.npc_realm_major || '炼气',
              npcAgeYears: relationshipEvent.npc_age_years ?? 20,
            },
            worldState?.current_year ?? STARTING_WORLD_YEAR,
          );
        } else if (
          existingRelationship
          && !existingRelationship.is_deceased
          && (relationshipEvent.affinity_delta || relationshipEvent.relation_type)
        ) {
          await this.relationshipService.applyAffinityDelta(
            existingRelationship,
            relationshipEvent.affinity_delta || 0,
            relationshipEvent.relation_type,
          );
        }
      }

      // ==================== 构建统一事务 ====================
      const transactionOps: Prisma.PrismaPromise<unknown>[] = [];

      transactionOps.push(
        this.prisma.players.update({
          where: { id: playerId },
          data: {
            hp: newHp,
            mp: newMp,
            cultivation: newCultivation,
            age: newAge,
            pending_months: newPendingMonths,
            realm_major: realmMajor,
            realm_minor: realmMinor,
            max_hp: maxHp,
            max_lifespan: maxLifespan,
            merit: Math.max(0, (player.merit || 0) + clampMeritDelta(deduction.merit_delta || 0)),
            karma: Math.max(0, (player.karma || 0) + clampKarmaDelta(deduction.karma_delta || 0)),
            spirit_stones: Math.max(0, (player.spirit_stones || 0) + (
              shopTransactionResult?.success
                ? shopTransactionResult.spiritStonesDelta
                : auctionResult?.won
                  ? -auctionResult.finalPrice
                  : clampSpiritStonesDelta(deduction.spirit_stones_delta || 0)
            )),
          },
        }),
      );

      // 2. 世界时间推进
      if (worldState) {
        const { newYear, newSeason, newPendingMonths: newWorldPendingMonths } = advanceWorldTime(
          worldState.current_year ?? STARTING_WORLD_YEAR,
          worldState.current_season ?? STARTING_WORLD_SEASON,
          worldState.pending_months ?? 0,
          monthsPassed,
        );
        const nextScene = nextSceneContext({ inCombat: Boolean(combat?.in_combat), isDead: isDeadNow });
        const clockOp = this.worldStateRepo.clockUpdate(player.save_id, {
          current_year: newYear,
          current_season: newSeason,
          pending_months: newWorldPendingMonths,
        });
        if (scenePersistable) {
          transactionOps.push(clockOp, this.worldStateRepo.sceneContextUpdate(player.save_id, nextScene));
        } else {
          transactionOps.push(clockOp);
        }
      }

      // 3. 死亡结算
      const enterSamsaraPool = isDeadNow && isEligibleForSamsara(realmMajor);
      if (isDeadNow) {
        transactionOps.push(
          this.prisma.saves.update({
            where: { id: player.save_id },
            data: { is_game_over: true, ...(enterSamsaraPool ? { in_samsara_pool: true } : {}) },
          }),
        );
      }

      // 4. 宗门势力
      if (willBetraySectThisTurn) {
        transactionOps.push(
          this.prisma.player_sect.update({ where: { save_id: player.save_id }, data: { is_traitor: true, rank: TRAITOR_RANK_LABEL, reputation: 0 } }),
        );
      } else if (!playerSect && sectEvent?.joined_sect_name) {
        transactionOps.push(
          this.prisma.player_sect.create({ data: { save_id: player.save_id, sect_name: sectEvent.joined_sect_name, rank: '试炼弟子', reputation: 0, is_traitor: false } }),
        );
      } else if (sectStatusForResponse && playerSect && !playerSect.is_traitor && sectEvent?.reputation_delta) {
        transactionOps.push(
          this.prisma.player_sect.update({
            where: { save_id: player.save_id },
            data: { reputation: sectStatusForResponse.reputation, rank: sectStatusForResponse.rank },
          }),
        );
      }

      // ==================== 处理背包物品变更 ====================
      const backendHandledItemNames = new Set<string>();
      if (craftingRecipe) backendHandledItemNames.add(craftingRecipe.resultName);
      if (matchedShopItemName) backendHandledItemNames.add(matchedShopItemName);
      if (matchedAuctionItemName) backendHandledItemNames.add(matchedAuctionItemName);

      const itemChanges: ItemChangeInput[] = (deduction.item_changes || [])
        .filter((ic) => !!ic.name && !backendHandledItemNames.has(ic.name as string))
        .map((ic) => ({
          name: ic.name as string,
          change: ic.change ?? 0,
          ...(ic.category !== undefined ? { category: ic.category } : {}),
          ...(ic.rarity !== undefined ? { rarity: ic.rarity } : {}),
          ...(ic.description !== undefined ? { description: ic.description } : {}),
          ...(ic.effects !== undefined ? { effects: ic.effects } : {}),
        }));
      if (craftingResult?.success) {
        itemChanges.push({ name: craftingResult.recipe.resultName, change: 1 });
      }
      if (shopTransactionResult?.success && matchedShopItemName) {
        const tradeQuantity = detectTradeQuantity(action);
        itemChanges.push({ name: matchedShopItemName, change: shopActionType === 'buy' ? tradeQuantity : -tradeQuantity });
      }
      if (auctionResult?.won && matchedAuctionItemName) {
        itemChanges.push({ name: matchedAuctionItemName, change: 1 });
      }
      await this.inventoryService.applyItemChanges(player.save_id, itemChanges);

      // 执行玩家属性更新事务
      const [updatedPlayer] = (await this.prisma.$transaction(transactionOps)) as [players];

      // 常规读档：每次行动落定后拍一张时间戳快照
      try {
        const latestWorldState = await this.prisma.world_state.findUnique({ where: { save_id: player.save_id } });
        const snapshotLabel = deduction.narrative ? String(deduction.narrative).slice(0, 40) : action.slice(0, 40);
        await this.snapshotService.captureSnapshot(player.save_id, snapshotLabel, updatedPlayer, latestWorldState);
      } catch (snapshotError) {
        console.error('拍摄存档快照失败（不影响本次行动结果）:', snapshotError);
      }

      return {
        ok: true,
        data: {
          narrative: deduction.narrative,
          options: deduction.next_options,
          monthsPassed,
          isDead: isDeadNow,
          deathReason,
          enteredSamsaraPool: enterSamsaraPool,
          lifespanStatus,
          combat: combatResolution ? {
            enemyName: combat?.enemy_name ?? '神秘敌人',
            outcome: combatResolution.outcome,
            realmGap: combatResolution.realmGap,
            damageTaken: -combatHpDelta,
            damageDealt: effectiveDamageToEnemy,
          } : null,
          talentChoices: talentChoices.length > 0 ? talentChoices.map((t) => ({ id: t.id, name: t.name, description: t.description })) : null,
          karmaRetribution: karmaRetributionResult?.triggered ? { tier: karmaRetributionResult.tier, fatal: karmaRetributionResult.fatal } : null,
          crafting: craftingResult ? {
            discipline: craftingResult.recipe.discipline,
            resultName: craftingResult.recipe.resultName,
            success: craftingResult.success,
          } : null,
          seclusionCultivationGain,
          cave,
          shopTransaction: shopTransactionResult ? {
            type: shopActionType,
            itemName: matchedShopItemName,
            success: shopTransactionResult.success,
            spiritStonesDelta: shopTransactionResult.spiritStonesDelta,
          } : null,
          auction: auctionResult ? { won: auctionResult.won, finalPrice: auctionResult.finalPrice } : null,
          sect: sectStatusForResponse,
          sectPromotion,
          sectBetrayed: willBetraySectThisTurn,
          dualCultivation: dualCultivationResult ? {
            npcName: dualCultivationTargetName,
            success: dualCultivationResult.success,
            cultivationBonus: dualCultivationResult.cultivationBonus,
          } : null,
          deceasedFriendNotices,
          exploration: explorationEncounter?.triggered ? { roll: explorationEncounter.roll, encounterType: explorationEncounter.encounterType } : null,
          regionDanger: regionDangerCheck?.isDangerous ? { regionName: regionDangerCheck.regionName, isLethal: regionDangerCheck.isLethal } : null,
          player: updatedPlayer,
        },
      };
    } catch (error) {
      console.error('Action接口报错:', error);
      return { ok: false, status: 500, message: '天机反噬，推演失败。' };
    }
  }
}
