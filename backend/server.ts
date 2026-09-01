import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { wakeUpHeaven, deduceAction } from './ai';
import { prisma } from './src/db/prisma';
import { InventoryService } from './src/services/inventory.service';
import inventoryRoutes from './src/routes/inventory.routes';
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
} from './src/services/playerState.service';
import { resolveCombatModifiers, parseElementsFromSpiritualRoots } from './src/services/combat.service';
import { resolveKarmaRetribution, clampMeritDelta, clampKarmaDelta } from './src/services/karma.service';
import { CaveService } from './src/services/cave.service';
import { calculateSeclusionCultivationGain, getRegionBaseSpiritualDensity } from './src/services/cultivationFormula.service';
import { detectCraftingAttempt, resolveCrafting } from './src/services/crafting.service';
import {
  clampSpiritStonesDelta,
  detectShopActionType,
  findMentionedTemplateName,
  detectTradeQuantity,
  resolveShopTransaction,
  detectAuctionBidAmount,
  resolveAuctionBid,
} from './src/services/economy.service';
import { SectService } from './src/services/sect.service';
import {
  detectBetrayalIntent,
  buildHuntedByEnforcersDirective,
  clampSectReputationDelta,
  getSectRankByReputation,
  TRAITOR_RANK_LABEL,
} from './src/services/sect.service';
import { RelationshipService } from './src/services/relationship.service';
import { isDualCultivationAttempt, resolveDualCultivation } from './src/services/npc.service';
import { findLongestMatchingName } from './src/utils/textMatch';
import { REALM_RANKS } from './src/services/combat.service';
import {
  isExplorationAttempt,
  rollExplorationEncounter,
  findExplorationRegion,
  checkRegionDanger,
  EXPLORATION_REGIONS,
} from './src/services/exploration.service';
import {
  pickRandomTalentChoices,
  getOwnedTalents,
  getRealmTalentIds,
  getCombatDamageMultiplier,
  getCombatDefenseMultiplier,
  getCultivationSpeedMultiplier,
  addRealmTalent,
  parseTalentsData,
} from './src/services/talent.service';
import {
  aggregateBuildEffects,
  getBuildCultivationSpeedMultiplier,
  getBuildCombatDamageMultiplier,
  getBuildCombatDefenseMultiplier,
  getSpeedDodgeMultiplier,
} from './src/services/characterBuild.service';
import { buildOpeningNarrative } from './src/services/opening.service';
import { isEligibleForSamsara, resolveLegacyBlessing } from './src/services/reincarnation.service';
import { ReincarnationDbService } from './src/services/reincarnationDb.service';
import { SnapshotService } from './src/services/snapshot.service';
import { SaveService } from './src/services/save.service';
import { evaluateSituation, nextSceneContext, parseSceneContext } from './src/services/situation.service';
// S21 安全网关：口令 / 净化 / 注入黑名单 / 创角校验 / 每日行动配额
import {
  requirePlayToken,
  sanitizeAction,
  hitsInjectionBlocklist,
  assertCreatePlayerBody,
  QuotaRepository,
  QuotaService,
  isAllowedCorsOrigin,
} from './src/gateway';

/** players.spiritual_roots 里的 quality 字段解析（如 "地灵根"），解析失败时安全退化为中性品质 */
function parseRootQuality(spiritualRoots: unknown): string {
  try {
    const data = typeof spiritualRoots === 'string' ? JSON.parse(spiritualRoots) : spiritualRoots;
    return typeof (data as any)?.quality === 'string' ? (data as any).quality : '真灵根';
  } catch {
    return '真灵根';
  }
}

// 加载 .env 环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 背包业务逻辑统一走 Service 层，路由/AI 结算代码不直接拼 Prisma 查询
const inventoryService = new InventoryService(prisma);
// 洞府业务逻辑：懒加载兜底 + 灵气浓度查询
const caveService = new CaveService(prisma);
// 宗门业务逻辑：声望驱动的职位晋升 + 叛宗标记
const sectService = new SectService(prisma);
// 人际关系业务逻辑：NPC 寿元推算 + 双修增益
const relationshipService = new RelationshipService(prisma);
// S21 安全网关：每日行动配额（playerId + 北京自然日）
const quotaService = new QuotaService(new QuotaRepository(prisma));
// 轮回业务逻辑：轮回池检索 + 前世遗泽掷骰
const reincarnationService = new ReincarnationDbService(prisma);
// 存档快照业务逻辑：时间戳快照拍摄 + 读档回滚
const snapshotService = new SnapshotService(prisma);
// 存档列表业务逻辑：列出全部存档供前端选择（免手抄 UUID）
const saveService = new SaveService(prisma);

// 中间件配置：允许跨域请求和解析 JSON
// S21 / I06：配了 PLAY_CORS_ORIGIN 则只放行该（逗号分隔）列表 + 本机 5173，避免隧道配置把 localhost 创角卡死
const playCorsOrigin = process.env.PLAY_CORS_ORIGIN;
if (playCorsOrigin) {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || isAllowedCorsOrigin(origin, playCorsOrigin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
} else {
  app.use(cors());
}
app.use(express.json());

// 背包 CRUD 独立路由（增/删/改/查）
app.use('/api/inventory', requirePlayToken, inventoryRoutes);

// 测试路由：探查天地灵气（数据库连接测试）
app.get('/api/ping', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'success', 
      message: '天地之桥已打通！天道系统（数据库）连接成功。' 
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    res.status(500).json({ 
      status: 'error', 
      message: '灵气涣散，数据库连接失败，请检查 XAMPP 是否开启。' 
    });
  }
});

// AI 灵魂测试路由
app.get('/api/ai-ping', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const heavenlyVoice = await wakeUpHeaven();
    res.json({
      status: 'success',
      message: heavenlyVoice
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '天道失联，请检查 .env 中的 DEEPSEEK_API_KEY 是否正确配置。'
    });
  }
});

// 创角系统：完全体降临
app.post('/api/create-player', requirePlayToken, async (req: Request, res: Response) => {
  try {
    // S21：创角字段长度校验（超长/非法直接 400，不写库、不调开场 LLM）
    const createPlayerCheck = assertCreatePlayerBody(req.body);
    if (!createPlayerCheck.ok) {
      return res.status(400).json({ status: 'error', message: createPlayerCheck.message });
    }

    // 接收完整的创角数据
    const { 
      name, gender, attributes, 
      roots,         // 灵根数组 (如 ['水', '木'])
      origin,        // 出身
      daoPursuit,    // 道途追求
      constitution,  // 先天体质
      talents        // 先天天赋数组
    } = req.body;

    const saveId = crypto.randomUUID();
    const playerId = crypto.randomUUID();

    // 组合灵根 JSON
    let rootQuality = "伪灵根";
    if (roots.length === 1) rootQuality = "天灵根";
    if (roots.length === 2) rootQuality = "地灵根";
    if (roots.length === 3) rootQuality = "真灵根";
    if (roots.length >= 4) rootQuality = "杂灵根";
    const spiritualRootsData = { quality: rootQuality, elements: roots };

    // 【轮回与读档机制】：死亡并非终结——随机检索轮回池里的前世角色，可能触发前世遗泽
    const legacyCandidate = await reincarnationService.pickLegacyCandidate();
    const legacyBlessing = legacyCandidate ? resolveLegacyBlessing(legacyCandidate.attributes) : { type: 'none' as const, narrativeText: '' };

    // 将出身、体质、道途、天赋统一打包进 talents JSON 字段（先构建，供命格效果计算使用）
    const talentsData = {
      origin: origin,
      daoPursuit: daoPursuit,
      constitution: constitution,
      innateTalents: talents
    };

    // 【创角命格落地】：出身/道途/体质/先天天赋不再是纯叙事装饰，
    // 而是折算成真实的六维加成、气血/寿元上限与初始灵石。
    const buildEffects = aggregateBuildEffects(talentsData);
    const finalAttributes = {
      aptitude: attributes?.aptitude || 10,
      comprehension: attributes?.comprehension || 10,
      divine_sense: attributes?.divine_sense || 10,
      speed: attributes?.speed || 10,
      dao_heart: attributes?.dao_heart || 10,
      fortune: attributes?.fortune || 10,
    };
    for (const [key, bonus] of Object.entries(buildEffects.attributeBonus)) {
      const k = key as keyof typeof finalAttributes;
      finalAttributes[k] = Math.min(20, Math.max(1, finalAttributes[k] + (bonus ?? 0)));
    }
    if (legacyBlessing.type === 'attribute_boost' && legacyBlessing.attributeKey) {
      const k = legacyBlessing.attributeKey as keyof typeof finalAttributes;
      finalAttributes[k] = Math.min(20, Math.max(1, finalAttributes[k] + (legacyBlessing.attributeBonus ?? 0)));
    }

    const startingMaxHp = 100 + buildEffects.maxHpBonus;
    const startingMaxLifespan = 100 + buildEffects.maxLifespanBonus;
    const startingSpiritStones = buildEffects.spiritStonesBonus;

    // 开局剧情：把玩家的名字/性别/出身/体质/道途/灵根/天赋/六维织成一段身世，
    // 玩家读完后按剧情给出的方向开始游戏。
    const opening = buildOpeningNarrative({
      name: name || '无名氏',
      gender: gender || '男',
      origin,
      daoPursuit,
      constitution,
      roots: spiritualRootsData,
      innateTalents: Array.isArray(talents) ? talents : [],
      attributes: finalAttributes,
      legacyBlessing: legacyBlessing.type !== 'none' ? legacyBlessing : null,
    });

    await prisma.$transaction([
      prisma.saves.create({
        data: {
          id: saveId,
          save_slot: 1,
          save_name: `${name}的修仙录`,
        }
      }),
      prisma.world_state.create({
        data: {
          save_id: saveId,
          current_year: 387,
          current_season: "春",
        }
      }),
      prisma.player_cave.create({
        data: {
          save_id: saveId,
          level: 1,
          spiritual_density: getRegionBaseSpiritualDensity("青岳·天机坊市"),
          location_name: "青岳·天机坊市",
        }
      }),
      prisma.players.create({
        data: {
          id: playerId,
          save_id: saveId,
          name: name || "无名氏",
          dao_name: "未定",
          gender: gender || "男",
          age: 16,
          max_lifespan: startingMaxLifespan,
          realm_major: "炼气",
          realm_minor: "初期",
          hp: startingMaxHp, max_hp: startingMaxHp, mp: 100, max_mp: 100,
          spirit_stones: startingSpiritStones,
          aptitude: finalAttributes.aptitude,
          comprehension: finalAttributes.comprehension,
          divine_sense: finalAttributes.divine_sense,
          speed: finalAttributes.speed,
          dao_heart: finalAttributes.dao_heart,
          fortune: finalAttributes.fortune,
          appearance: 3,
          // 存入高度定制化的 JSON 数据
          spiritual_roots: JSON.stringify(spiritualRootsData),
          talents: JSON.stringify(talentsData),
          status_effects: JSON.stringify([]),
          current_location: "青岳·天机坊市"
        }
      })
    ]);

    // 前世遗泽落地：法宝类奖励需要背包基础设施，等新存档创建完毕后再赠予；
    // 只有真正授予了遗泽（而非"未触发"）才消耗掉这个轮回池名额，否则留给未来某一世继续尝试。
    if (legacyBlessing.type === 'buried_treasure' && legacyBlessing.treasure) {
      await inventoryService.addItem(saveId, {
        name: legacyBlessing.treasure.name,
        change: 1,
        category: 'material',
        rarity: legacyBlessing.treasure.rarity,
        description: legacyBlessing.treasure.description,
      });
    }
    if (legacyCandidate && legacyBlessing.type !== 'none') {
      await reincarnationService.consumeLegacy(legacyCandidate.saveId);
    }

    res.json({
      status: 'success',
      message: `道音轰鸣！【${origin}】出身的【${rootQuality}】修士降生九州。`,
      data: {
        playerId: playerId,
        saveId: saveId,
        opening: {
          paragraphs: opening.paragraphs,
          options: opening.options,
        },
        legacyBlessing: legacyBlessing.type !== 'none' ? {
          type: legacyBlessing.type,
          narrativeText: legacyBlessing.narrativeText,
        } : null,
      }
    });

  } catch (error) {
    console.error("创角失败:", error);
    res.status(500).json({ status: 'error', message: '天机混乱，命格凝聚失败。' });
  }
});

// 天道探查：获取修士真实状态
app.get('/api/player/:id', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const player = await prisma.players.findUnique({
      where: { id: req.params.id }
    });
    
    if (!player) {
      return res.status(404).json({ status: 'error', message: '查无此人，该修士恐已陨落。' });
    }
    
    // 背包数据统一走 Service 层查询与格式化
    const inventoryData = await inventoryService.getInventory(player.save_id);
    const lifespanStatus = getLifespanStatus(player.age ?? 16, player.max_lifespan ?? 100);
    const cave = await caveService.getOrCreateCave(player.save_id, player.current_location ?? '青岳·天机坊市');
    const sect = await sectService.getSect(player.save_id);
    const relationships = await relationshipService.getAll(player.save_id);

    res.json({
      status: 'success',
      data: {
        ...player,
        inventory: inventoryData,
        lifespanStatus,
        cave,
        sect,
        relationships
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '天道探查失败' });
  }
});

// 天道推演：处理玩家行动
app.post('/api/action', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const { playerId } = req.body;

    // S21 层 C：行动文本净化（空串/非法不可见字符/超长一律 400，不静默截断）
    const sanitized = sanitizeAction(req.body.action);
    if (!sanitized.ok) {
      const message = sanitized.code === 'empty'
        ? '请先述说所行之事。'
        : sanitized.code === 'too_long'
          ? '所言过繁，请精简至二百字内。'
          : '所言含天机不容之字符。';
      return res.status(400).json({ status: 'error', message });
    }
    const action = sanitized.text;

    // S21 层 D：注入黑名单（命令模型改数值/泄密），命中即拒绝，不调 DeepSeek
    if (hitsInjectionBlocklist(action)) {
      return res.status(400).json({ status: 'error', message: '此言大逆天道，天机不予推演。' });
    }

    const player = await prisma.players.findUnique({
      where: { id: playerId },
      include: { saves: true },
    });
    if (!player) return res.status(404).json({ status: 'error', message: '修士不存在' });

    // 【死亡锁】：存档一旦被标记为终结（气血耗尽或寿元耗尽），无论如何都不允许再有任何行动
    const alreadyDead = player.saves?.is_game_over
      || getDeathReason(player.hp ?? 100, player.age ?? 16, player.max_lifespan ?? 100) !== null;
    if (alreadyDead) {
      return res.status(403).json({ status: 'error', message: '大限已至，道消身陨，万事皆休。' });
    }

    // 世界状态：情境锁 + 年份/旧友检测复用
    const worldState = await prisma.world_state.findUnique({ where: { save_id: player.save_id } });
    const sceneContext = parseSceneContext(worldState?.scene_context);
    const situation = evaluateSituation(sceneContext, action);
    if (!situation.ok) {
      return res.status(400).json({ status: 'error', message: situation.message });
    }

    // S21 层 B：每日行动配额（仅在口令/净化/黑名单/玩家存在/未死亡全部通过后计数）
    const quotaResult = await quotaService.tryConsumeDailyAction(playerId);
    if (!quotaResult.ok) {
      return res.status(429).json({ status: 'error', message: '今日推演次数已尽，明日再来。' });
    }

    // 洞府：灵气浓度直接决定闭关修炼的收益倍率（懒加载兜底，兼容洞府系统上线前创建的旧存档）
    const cave = await caveService.getOrCreateCave(player.save_id, player.current_location ?? '青岳·天机坊市');
    // 宗门：可能为 null（尚未加入任何宗门，即"散修"），这是合法状态，不做懒加载兜底
    const playerSect = await sectService.getSect(player.save_id);
    // 人际关系：全部现有关系，供双修目标匹配 + 旧友寿元耗尽检测复用
    const relationships = await relationshipService.getAll(player.save_id);
    // 逆天改命天赋：已拥有的天赋列表，供战斗/修炼计算读取全局乘数
    const ownedTalents = getOwnedTalents(player.talents);
    // 创角命格：出身/道途/体质/先天天赋，供战斗/修炼计算读取命格全局乘数
    const characterBuild = parseTalentsData(player.talents);

    const forcedOutcomeParts: string[] = [];

    // 【核心拦截器 1】：境界突破与渡雷劫——所有数值变化由后端硬计算，不依赖 AI 自己填写 hp_delta/cultivation_delta
    const attemptingBreakthrough = action.includes("突破") || action.includes("破境") || action.includes("结丹") || action.includes("渡劫");
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
            merit: player.merit ?? 0, // 白皮书法则：功德可用于抵御雷劫，提升渡劫成功率
          },
          REALM_LAWS,
        )
      : null;
    if (breakthroughResult) {
      forcedOutcomeParts.push(breakthroughResult.forcedOutcomeText);
    }
    const maxLifespanForThisTurn = breakthroughResult ? breakthroughResult.patch.maxLifespan : (player.max_lifespan ?? 100);

    // 【逆天改命体系】：大境界渡雷劫成功后，直接下发三个天赋选项（类似 Rogue-like 的天赋三选一）。
    // 选项本身只是"提议"，玩家真正拥有这个天赋要等调用 /api/talents/choose 确认后才会写入 talents。
    const talentChoices = breakthroughResult?.isMajorBreakthroughSuccess
      ? pickRandomTalentChoices(getRealmTalentIds(player.talents), 3)
      : [];
    if (talentChoices.length > 0) {
      forcedOutcomeParts.push(
        '玩家刚刚成功渡过大境界的雷劫，天道因此赐下一线机缘，即将有三条逆天改命的天赋供其抉择（此事交由玩家在界面上自行选择，你只需在叙事里带一句"隐约感觉到冥冥中有几分因果可供自己抉择"，不必展开具体选项）。',
      );
    }

    // 【核心拦截器 2】：业力天罚——「捷径往往伴随代价」，业力越高越容易招致天罚，
    // 是否触发、伤害多少全部由后端硬性掷骰决定，不依赖 AI 主动交代。
    // 与境界突破同为"自成一体"的重大事件，二者不在同一回合叠加，优先让突破占据这个回合的主线。
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
    const fabricationWarning = await inventoryService.detectFabricatedItemUsage(player.save_id, action);
    if (fabricationWarning) {
      forcedOutcomeParts.push(fabricationWarning);
    }

    // 【核心拦截器 3】：闭关时长解析——「闭关无岁月，转眼数十载」，具体闭关多久绝不能让 AI 随口猜测，
    // 必须由后端从行动文本里精确解析出真实月数并强制锁定，AI 只负责把这段时光写成一笔带过的剧情。
    const seclusionMonths = detectSeclusionMonths(action);
    // 闭关修炼收益：由洞府灵气浓度 × 资质 × 灵根 × 道心的公式硬性算出，绝不采信 AI 的想象。
    // 与境界突破/业力天罚一样，属于"自成一体"的确定性事件，不与它们叠加在同一回合。
    const seclusionCultivationGain = seclusionMonths !== null && !breakthroughResult && !karmaRetributionResult?.triggered
      ? calculateSeclusionCultivationGain(
          {
            aptitude: player.aptitude ?? 10,
            rootQuality: parseRootQuality(player.spiritual_roots),
            daoHeart: player.dao_heart ?? 10,
            caveSpiritualDensity: cave.spiritual_density ?? 10,
            talentCoefficient: getCultivationSpeedMultiplier(ownedTalents) * getBuildCultivationSpeedMultiplier(characterBuild), // 逆天改命天赋 + 创角命格（体质/天赋/出身/道途）的修炼倍率
          },
          seclusionMonths,
        )
      : null;
    if (seclusionMonths !== null) {
      forcedOutcomeParts.push(
        `玩家决定闭关，此次共计闭关 ${describeMonths(seclusionMonths)}。须以"山中无甲子，寒尽不知年"的笔法一笔带过这段漫长时光，直接描写出关后的状态与心境变化，不要逐日描写修炼过程。`
        + (seclusionCultivationGain !== null ? `此次闭关，凭借洞府灵气与自身根骨，修为精进 ${seclusionCultivationGain} 点，需在叙事中体现修为大有长进。` : ''),
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

    // 【核心拦截器 6】：坊市买卖——成交价格完全取决于物品图鉴（items_template.base_price），
    // 灵石够不够、库存够不够全部由后端硬性校验，不采信 AI 自己判断的价格与成败。
    const shopActionType = detectShopActionType(action);
    let matchedShopItemName: string | null = null;
    let shopTransactionResult: ReturnType<typeof resolveShopTransaction> | null = null;
    if (shopActionType) {
      const allTemplateNames = await inventoryService.listAllTemplateNames();
      matchedShopItemName = findMentionedTemplateName(action, allTemplateNames);
      if (matchedShopItemName) {
        const shopTemplate = await inventoryService.getTemplateByName(matchedShopItemName);
        if (shopTemplate) {
          const tradeQuantity = detectTradeQuantity(action);
          const ownedQuantity = shopActionType === 'sell'
            ? await inventoryService.getOwnedQuantityByName(player.save_id, matchedShopItemName)
            : undefined;
          shopTransactionResult = resolveShopTransaction({
            type: shopActionType,
            itemName: matchedShopItemName,
            basePrice: shopTemplate.base_price ?? 10,
            quantity: tradeQuantity,
            playerSpiritStones: player.spirit_stones ?? 0,
            playerOwnedQuantity: ownedQuantity,
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
      const allTemplateNames = await inventoryService.listAllTemplateNames();
      matchedAuctionItemName = findMentionedTemplateName(action, allTemplateNames);
      const auctionTemplate = matchedAuctionItemName ? await inventoryService.getTemplateByName(matchedAuctionItemName) : null;
      // 匹配不到字典物品时（AI 临时编造的稀世拍卖品），退化为保底估值/稀有度，仍保证成败判定可控
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

    // 【核心拦截器 8】：叛宗——是否叛出师门是重大分支，必须由后端关键词硬性判定，绝不能靠 AI 自己拿主意。
    // 一旦触发即永久生效：此后每一次行动都要强制体现"被执法堂追杀"的持续压力，不是一次性事件。
    const willBetraySectThisTurn = !!playerSect && !playerSect.is_traitor && detectBetrayalIntent(action);
    const sectNameForDirective = playerSect?.sect_name ?? '原宗门';
    if (willBetraySectThisTurn) {
      forcedOutcomeParts.push(
        `玩家在这一刻彻底叛出「${sectNameForDirective}」，从此与昔日同门恩断义绝，被打上叛徒的烙印，声望清零。`,
      );
    }
    if (playerSect?.is_traitor || willBetraySectThisTurn) {
      forcedOutcomeParts.push(buildHuntedByEnforcersDirective(sectNameForDirective));
    }

    // 【核心拦截器 9】：人际与情缘双修——全性向，只看好感度，与性别无关；
    // 增益幅度由后端依据好感度硬性计算，绝不采信 AI 自己给出的增益数值。
    let dualCultivationTargetName: string | null = null;
    let dualCultivationResult: ReturnType<typeof resolveDualCultivation> | null = null;
    if (isDualCultivationAttempt(action) && relationships.length > 0) {
      dualCultivationTargetName = findLongestMatchingName(action, relationships.map((r) => r.npc_name));
      if (dualCultivationTargetName) {
        const targetRelationship = relationships.find((r) => r.npc_name === dualCultivationTargetName)!;
        dualCultivationResult = resolveDualCultivation(dualCultivationTargetName, {
          affinity: targetRelationship.affinity ?? 0,
          playerMaxHp: player.max_hp ?? 100,
          playerMaxMp: player.max_mp ?? 100,
        });
        forcedOutcomeParts.push(dualCultivationResult.forcedOutcomeText);
      }
    }

    // 【核心拦截器 10】：探索与随机奇遇——1d100 掷骰机制，仙缘决定触发概率；
    // 若强闯远超自身境界的高危地图，代码强制扣除巨额气血以示惩戒。九州地理分级 + 掷骰全部由后端硬算。
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

    // 【背景因果】：昔日旧友寿元耗尽——与玩家本次行动无关，是持续在背景运转的世界线，
    // 每一回合都要检查一次，一旦有旧友仙逝，传音符的讯息必须注入叙事，不能因为玩家在忙别的事就漏掉。
    // 若本回合是"闭关十年"这类一次性大跨度时间流逝（时长提前已知），要用"闭关结束后"的世界年份来检测，
    // 否则像闭关一百年这种极端情况，会因为检测用的是回合开始前的年份而漏掉这次闭关期间旧友的仙逝。
    const projectedWorldYear = worldState
      ? seclusionMonths !== null
        ? advanceWorldTime(worldState.current_year ?? 387, worldState.current_season ?? '春', worldState.pending_months ?? 0, seclusionMonths).newYear
        : (worldState.current_year ?? 387)
      : 387;
    const deceasedFriendNotices = worldState
      ? await relationshipService.checkForDeceasedFriends(player.save_id, projectedWorldYear)
      : [];
    for (const notice of deceasedFriendNotices) {
      forcedOutcomeParts.push(notice);
    }

    // 【大限压迫感】：寿元告急时，持续给 AI 的叙事施加紧迫感，让玩家真切感受到"与天夺命"
    const preActionLifespanStatus = getLifespanStatus(player.age ?? 16, maxLifespanForThisTurn);
    if (preActionLifespanStatus.warningMessage) {
      forcedOutcomeParts.push(preActionLifespanStatus.warningMessage);
    }

    const forcedOutcome = forcedOutcomeParts.join('\n');

    // 查询背包（用于传递给 AI），统一走 Service 层
    const inventoryStr = await inventoryService.getInventoryPromptString(player.save_id);

    // hp/修为是否已被后端锁定：只有突破/业力天罚/闭关收益这三类"自成一体"的确定性事件才会锁定，
    // 单纯的预警/物品校验文案不应该限制 AI 对普通行动的正常数值判断。
    const hasLockedNumbers = !!breakthroughResult || !!karmaRetributionResult?.triggered || seclusionCultivationGain !== null || !!regionDangerCheck?.isDangerous;

    // 丢给 DeepSeek 进行推演（叙事 + 非关键数值，如 mp/功德/业力/物品变化）
    const deduction = await deduceAction(player, action, forcedOutcome, inventoryStr, hasLockedNumbers, {
      level: cave.level ?? 1,
      spiritualDensity: cave.spiritual_density ?? 10,
      locationName: cave.location_name ?? player.current_location ?? '青岳·天机坊市',
    }, playerSect ? {
      sectName: playerSect.sect_name,
      rank: playerSect.rank ?? '试炼弟子',
      reputation: playerSect.reputation ?? 0,
      isTraitor: !!playerSect.is_traitor,
    } : undefined, relationships);

    // ==================== 战斗与境界压制：AI 只报告"基础伤害估算"，真实伤害由后端重新计算 ====================
    // 绝非龙傲天：低境界绝不能轻易反杀高境界，境界差距 2 级以上直接碾压秒杀——
    // 这些倍率全部由 combat.service 硬计算，绝不采信 AI 自己给出的最终伤害数字。
    const combat = deduction.combat;
    const combatResolution = combat?.in_combat
      ? resolveCombatModifiers(
          { realmMajor: player.realm_major, elements: parseElementsFromSpiritualRoots(player.spiritual_roots) },
          { realmMajor: combat.enemy_realm_major, elements: combat.enemy_element ? [combat.enemy_element] : [] },
        )
      : null;

    // ==================== 核心状态机：气血/灵力/修为结算 ====================
    // 结算优先级：境界突破 > 业力天罚 > 战斗境界压制 > AI 自行给出的普通数值。
    // 前三者都不属于"可以信任 AI 自己填数字"的场景，必须由后端硬算出最终结果。
    const maxHp = breakthroughResult ? breakthroughResult.patch.maxHp : (player.max_hp ?? 100);
    const maxLifespan = maxLifespanForThisTurn;
    const realmMajor = breakthroughResult ? breakthroughResult.patch.realmMajor : player.realm_major;
    const realmMinor = breakthroughResult ? breakthroughResult.patch.realmMinor : player.realm_minor;

    // 逆天改命天赋 + 创角命格（体质/天赋/出身/道途）：战斗计算读取聚合出的全局乘数
    // （如"剑心通明"伤害+20%、"金刚不坏"减伤15%、先天道体修炼更快、遁速越高闪避越多）
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
      // 'player_instant_win'：玩家碾压获胜，不掉血，combatHpDelta 保持 0
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

    // ==================== 核心状态机：时间流逝（“闭关无岁月，转眼数十载”） ====================
    // 闭关时长由后端从行动文本里精确解析得出（见上方拦截器 3），绝不采信 AI 的猜测；
    // 只有非闭关的普通行动，才使用 AI 自行判断的零碎时间消耗（0.1/0.2/1 个月等）。
    const monthsPassed = seclusionMonths ?? craftingRecipe?.craftMonths ?? (deduction.time_cost_months || 1);
    const { newAge, newPendingMonths } = advanceAge(player.age ?? 16, player.pending_months ?? 0, monthsPassed);

    // ==================== 核心状态机：死亡判定（气血耗尽 / 寿元耗尽 / 渡劫陨落 / 境界碾压 / 业力天罚） ====================
    // 优先展示更具体、更戏剧化的死因，其次才是通用的气血耗尽/寿元耗尽判定
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

    // 大限压迫感：把流逝之后的最新寿元状态返回给前端，供状态卡展示"剩余寿元"预警
    const lifespanStatus = isDeadNow ? null : getLifespanStatus(newAge, maxLifespan);

    // ==================== 宗门势力运转：加入宗门 / 声望驱动的职位晋升 ====================
    // 职位（rank）完全由代码依据 reputation 阈值表计算，AI 只负责报告"加入了哪个宗门"
    // 和"这次行动对宗门的贡献度"，绝不允许 AI 自己指定职位名称。
    const sectEvent = deduction.sect_event;
    let sectPromotion: { fromRank: string; toRank: string } | null = null;
    let sectStatusForResponse: { sectName: string | null; rank: string; reputation: number; isTraitor: boolean } | null =
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
    // 这部分不影响任何战斗/数值结算，属于低风险场景，直接委托 Service 层执行即可，
    // 不需要像宗门/坊市那样先算出结果再塞进统一事务（关系表的写入与玩家主表更新没有强一致性要求）。
    const relationshipEvent = deduction.relationship_event;
    if (relationshipEvent?.npc_name) {
      const existingRelationship = relationships.find((r) => r.npc_name === relationshipEvent.npc_name);
      if (!existingRelationship && relationshipEvent.is_new) {
        await relationshipService.recordNewRelationship(
          player.save_id,
          {
            npcName: relationshipEvent.npc_name,
            relationType: relationshipEvent.relation_type || '相识',
            affinityDelta: relationshipEvent.affinity_delta || 0,
            npcRealmMajor: relationshipEvent.npc_realm_major || '炼气',
            npcAgeYears: relationshipEvent.npc_age_years ?? 20,
          },
          worldState?.current_year ?? 387,
        );
      } else if (existingRelationship && (relationshipEvent.affinity_delta || relationshipEvent.relation_type)) {
        await relationshipService.applyAffinityDelta(
          existingRelationship,
          relationshipEvent.affinity_delta || 0,
          relationshipEvent.relation_type,
        );
      }
    }

    // ==================== 构建统一事务 ====================
    const transactionOps: any[] = [];

    // 1. 玩家属性更新
    transactionOps.push(
      prisma.players.update({
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
          // 功德/业力铁律：救死扶伤积功德、杀人夺宝积业力，但单次行动的增量必须被夹紧，
          // 不能让 AI 一次性给出离谱的数值（防作弊铁律的一部分）
          merit: Math.max(0, (player.merit || 0) + clampMeritDelta(deduction.merit_delta || 0)),
          karma: Math.max(0, (player.karma || 0) + clampKarmaDelta(deduction.karma_delta || 0)),
          // 灵石体系：坊市买卖/拍卖中标的灵石变动完全由后端硬算的成交价决定，优先级高于 AI 自己的猜测
          spirit_stones: Math.max(0, (player.spirit_stones || 0) + (
            shopTransactionResult?.success
              ? shopTransactionResult.spiritStonesDelta
              : auctionResult?.won
                ? -auctionResult.finalPrice
                : clampSpiritStonesDelta(deduction.spirit_stones_delta || 0)
          )),
        }
      })
    );

    // 2. 世界时间推进（年份/季节随月份流逝同步更新）
    if (worldState) {
      const { newYear, newSeason, newPendingMonths: newWorldPendingMonths } = advanceWorldTime(
        worldState.current_year ?? 387,
        worldState.current_season ?? '春',
        worldState.pending_months ?? 0,
        monthsPassed,
      );
      const nextScene = nextSceneContext({
        inCombat: Boolean(combat?.in_combat),
        isDead: isDeadNow,
      });
      transactionOps.push(
        prisma.world_state.update({
          where: { save_id: player.save_id },
          data: {
            current_year: newYear,
            current_season: newSeason,
            pending_months: newWorldPendingMonths,
            scene_context: nextScene,
          },
        })
      );
    }

    // 3. 死亡结算：一旦判定死亡，永久锁死该存档；
    // 若境界够高（筑基及以上），死亡并非终结——同时打上轮回标记，等待未来某一世随机抽中获得前世遗泽。
    const enterSamsaraPool = isDeadNow && isEligibleForSamsara(realmMajor);
    if (isDeadNow) {
      transactionOps.push(
        prisma.saves.update({
          where: { id: player.save_id },
          data: { is_game_over: true, ...(enterSamsaraPool ? { in_samsara_pool: true } : {}) },
        })
      );
    }

    // 4. 宗门势力：叛宗 / 首次加入宗门 / 声望与职位更新
    if (willBetraySectThisTurn) {
      transactionOps.push(
        prisma.player_sect.update({ where: { save_id: player.save_id }, data: { is_traitor: true, rank: TRAITOR_RANK_LABEL, reputation: 0 } })
      );
    } else if (!playerSect && sectEvent?.joined_sect_name) {
      transactionOps.push(
        prisma.player_sect.create({ data: { save_id: player.save_id, sect_name: sectEvent.joined_sect_name, rank: '试炼弟子', reputation: 0, is_traitor: false } })
      );
    } else if (sectStatusForResponse && playerSect && !playerSect.is_traitor && sectEvent?.reputation_delta) {
      transactionOps.push(
        prisma.player_sect.update({
          where: { save_id: player.save_id },
          data: { reputation: sectStatusForResponse.reputation, rank: sectStatusForResponse.rank },
        })
      );
    }

    // ==================== 处理背包物品变更（含自定义物品熔断） ====================
    // 物品增删逻辑统一走 Service 层（内部自带事务），必须先于玩家属性事务执行：
    // 一旦物品变更失败（如库存不足），直接抛出异常，玩家属性事务不会被执行。
    // 防御性兜底：炼制/坊市买卖/拍卖涉及的具体物品，产出与否完全由后端的确定性判定为准，
    // 即便 AI 没有严格遵守"不要重复声明"的铁律，也要先把它自己关于这些物品的条目过滤掉。
    const backendHandledItemNames = new Set<string>();
    if (craftingRecipe) backendHandledItemNames.add(craftingRecipe.resultName);
    if (matchedShopItemName) backendHandledItemNames.add(matchedShopItemName);
    if (matchedAuctionItemName) backendHandledItemNames.add(matchedAuctionItemName);

    const itemChanges = (deduction.item_changes || []).filter((ic: any) => !backendHandledItemNames.has(ic?.name));
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
    await inventoryService.applyItemChanges(player.save_id, itemChanges);

    // 执行玩家属性更新事务
    const [updatedPlayer] = await prisma.$transaction(transactionOps);

    // 常规读档：每次行动落定后拍一张时间戳快照（players + world_state 的完整副本），
    // 供玩家之后按时间点回滚；快照的截取不应影响本次请求的成败，失败也只记录日志不抛出异常。
    try {
      const latestWorldState = await prisma.world_state.findUnique({ where: { save_id: player.save_id } });
      const snapshotLabel = deduction.narrative ? String(deduction.narrative).slice(0, 40) : action.slice(0, 40);
      await snapshotService.captureSnapshot(player.save_id, snapshotLabel, updatedPlayer, latestWorldState);
    } catch (snapshotError) {
      console.error('拍摄存档快照失败（不影响本次行动结果）:', snapshotError);
    }

    res.json({
      status: 'success',
      data: {
        narrative: deduction.narrative,
        options: deduction.next_options,
        monthsPassed: monthsPassed,
        isDead: isDeadNow,
        deathReason: deathReason,
        enteredSamsaraPool: enterSamsaraPool,
        lifespanStatus: lifespanStatus,
        combat: combatResolution ? {
          enemyName: combat?.enemy_name ?? '神秘敌人',
          outcome: combatResolution.outcome,
          realmGap: combatResolution.realmGap,
          damageTaken: -combatHpDelta,
          damageDealt: effectiveDamageToEnemy,
        } : null,
        talentChoices: talentChoices.length > 0 ? talentChoices.map((t) => ({ id: t.id, name: t.name, description: t.description })) : null,
        karmaRetribution: karmaRetributionResult?.triggered ? {
          tier: karmaRetributionResult.tier,
          fatal: karmaRetributionResult.fatal,
        } : null,
        crafting: craftingResult ? {
          discipline: craftingResult.recipe.discipline,
          resultName: craftingResult.recipe.resultName,
          success: craftingResult.success,
        } : null,
        seclusionCultivationGain: seclusionCultivationGain,
        cave: cave,
        shopTransaction: shopTransactionResult ? {
          type: shopActionType,
          itemName: matchedShopItemName,
          success: shopTransactionResult.success,
          spiritStonesDelta: shopTransactionResult.spiritStonesDelta,
        } : null,
        auction: auctionResult ? {
          won: auctionResult.won,
          finalPrice: auctionResult.finalPrice,
        } : null,
        sect: sectStatusForResponse,
        sectPromotion: sectPromotion,
        sectBetrayed: willBetraySectThisTurn,
        dualCultivation: dualCultivationResult ? {
          npcName: dualCultivationTargetName,
          success: dualCultivationResult.success,
          cultivationBonus: dualCultivationResult.cultivationBonus,
        } : null,
        deceasedFriendNotices: deceasedFriendNotices,
        exploration: explorationEncounter?.triggered ? {
          roll: explorationEncounter.roll,
          encounterType: explorationEncounter.encounterType,
        } : null,
        regionDanger: regionDangerCheck?.isDangerous ? {
          regionName: regionDangerCheck.regionName,
          isLethal: regionDangerCheck.isLethal,
        } : null,
        player: updatedPlayer
      }
    });

  } catch (error) {
    console.error("Action接口报错:", error);
    res.status(500).json({ status: 'error', message: '天机反噬，推演失败。' });
  }
});

// 逆天改命：确认玩家从三选一里选中的天赋，写入 talents JSON
app.post('/api/talents/choose', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const { playerId, talentId } = req.body;
    if (!talentId) {
      return res.status(400).json({ status: 'error', message: '缺少要选择的天赋 id' });
    }
    const player = await prisma.players.findUnique({ where: { id: playerId } });
    if (!player) return res.status(404).json({ status: 'error', message: '修士不存在' });

    let updatedTalentsJson: string;
    try {
      updatedTalentsJson = addRealmTalent(player.talents, talentId);
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message || '天赋选择失败' });
    }

    const updatedPlayer = await prisma.players.update({
      where: { id: playerId },
      data: { talents: updatedTalentsJson },
    });

    res.json({ status: 'success', message: '天道垂青，逆天改命已成！', data: { player: updatedPlayer } });
  } catch (error) {
    console.error('天赋选择接口报错:', error);
    res.status(500).json({ status: 'error', message: '天机紊乱，天赋选择失败。' });
  }
});

// 存档列表：列出全部存档（免手抄 UUID）；薄做只读列表，不做快照回滚 UI
app.get('/api/saves', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const saves = await saveService.listSaves();
    res.json({ status: 'success', data: saves });
  } catch (error) {
    console.error('查询存档列表失败:', error);
    res.status(500).json({ status: 'error', message: '天机紊乱，无法读取存档列表。' });
  }
});

// 删除全部存档（级联清理关联表与每日配额）
app.delete('/api/saves', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const { deleted } = await saveService.deleteAllSaves();
    res.json({ status: 'success', data: { deleted } });
  } catch (error) {
    console.error('清空存档失败:', error);
    res.status(500).json({ status: 'error', message: '天机紊乱，清空存档失败。' });
  }
});

// 删除单个存档
app.delete('/api/saves/:saveId', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const { deleted } = await saveService.deleteSave(req.params.saveId);
    if (!deleted) {
      res.status(404).json({ status: 'error', message: '该存档已不存在。' });
      return;
    }
    res.json({ status: 'success', data: { deleted: true } });
  } catch (error) {
    console.error('删除存档失败:', error);
    res.status(500).json({ status: 'error', message: '天机紊乱，删除存档失败。' });
  }
});

// 常规读档：列出某存档全部可回滚的时间戳快照
app.get('/api/saves/:saveId/snapshots', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const snapshots = await snapshotService.listSnapshots(req.params.saveId);
    res.json({
      status: 'success',
      data: snapshots.map((s) => ({ id: s.id, createdAt: s.created_at, label: s.label })),
    });
  } catch (error) {
    console.error('查询存档快照失败:', error);
    res.status(500).json({ status: 'error', message: '天道探查失败，无法读取存档快照列表。' });
  }
});

// 常规读档：把存档回滚到某个时间戳快照
app.post('/api/saves/:saveId/rollback', requirePlayToken, async (req: Request, res: Response) => {
  try {
    const { snapshotId } = req.body;
    if (!snapshotId) {
      return res.status(400).json({ status: 'error', message: '缺少要回滚到的快照 id' });
    }
    const restoredPlayer = await snapshotService.rollbackToSnapshot(req.params.saveId, snapshotId);
    // 读档回滚可能会让存档从"已终结"状态复活（例如回滚到死亡之前），需要同步解除死亡锁
    await prisma.saves.update({ where: { id: req.params.saveId }, data: { is_game_over: false } });
    res.json({ status: 'success', message: '时光倒流，存档已回滚至选定的时间点。', data: { player: restoredPlayer } });
  } catch (error: any) {
    console.error('存档回滚失败:', error);
    res.status(400).json({ status: 'error', message: error.message || '存档回滚失败' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`天道服务器已启动，正监听端口: ${PORT}`);
});