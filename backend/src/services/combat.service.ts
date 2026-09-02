/**
 * 战斗与境界压制（Service 层，纯函数，不依赖数据库）。
 * 负责：境界差距对战斗伤害的强制压制/碾压，以及五行相生相克对伤害的加成/减益。
 * 核心原则（“绝非龙傲天”）：严格的硬实力鸿沟——低境界绝不能轻易反杀高境界，
 * 具体的倍率全部由后端硬计算，AI 只负责描述战斗过程与估算基础伤害，
 * 绝不允许 AI 自己决定最终的境界压制/克制结果。
 */

/** 九大境界的战力位阶，数字越大代表境界越高 */
export const REALM_RANKS: Record<string, number> = {
  炼气: 0,
  筑基: 1,
  金丹: 2,
  元婴: 3,
  化神: 4,
  炼虚: 5,
  合体: 6,
  大乘: 7,
  渡劫期: 8,
};

export type FiveElement = '金' | '木' | '水' | '火' | '土';
const FIVE_ELEMENTS = new Set<string>(['金', '木', '水', '火', '土']);
function isFiveElement(value: string): value is FiveElement {
  return FIVE_ELEMENTS.has(value);
}

/** 五行相生：木生火，火生土，土生金，金生水，水生木 */
const GENERATES: Record<FiveElement, FiveElement> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克：木克土，土克水，水克火，火克金，金克木 */
const RESTRAINS: Record<FiveElement, FiveElement> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

const ELEMENT_RESTRAIN_BONUS = 1.3; // 我方元素克制对方：攻击加成
const ELEMENT_RESTRAINED_PENALTY = 0.7; // 我方元素被对方克制：攻击减益
const ELEMENT_GENERATE_PENALTY = 0.9; // 我方元素滋养对方（相生）：力量被对方吸纳，威力略减
const ELEMENT_GENERATED_BONUS = 1.1; // 我方元素被对方滋养（借力打力）：威力略增

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * 计算单一元素对单一元素的伤害倍率。任意一方不是标准五行（如凶兽的“无属性”、
 * 或数据缺失）时，视为中立，不产生任何加成/减益。
 */
export function getElementMultiplier(attackerElement: string, defenderElement: string): number {
  if (!isFiveElement(attackerElement) || !isFiveElement(defenderElement)) return 1;
  if (attackerElement === defenderElement) return 1;
  if (RESTRAINS[attackerElement] === defenderElement) return ELEMENT_RESTRAIN_BONUS;
  if (RESTRAINS[defenderElement] === attackerElement) return ELEMENT_RESTRAINED_PENALTY;
  if (GENERATES[attackerElement] === defenderElement) return ELEMENT_GENERATE_PENALTY;
  if (GENERATES[defenderElement] === attackerElement) return ELEMENT_GENERATED_BONUS;
  return 1;
}

/**
 * 灵根往往不止一个属性（如天灵根可能是「木火」双属性），实战中修士会选用对自己最有利
 * 的属性出手，因此取攻击方全部属性 × 防御方全部属性组合中，对攻击方最有利的那个倍率。
 */
export function getBestElementMultiplier(attackerElements: string[], defenderElements: string[]): number {
  const attackers = attackerElements.length > 0 ? attackerElements : [''];
  const defenders = defenderElements.length > 0 ? defenderElements : [''];
  let best = -Infinity;
  for (const attacker of attackers) {
    for (const defender of defenders) {
      best = Math.max(best, getElementMultiplier(attacker, defender));
    }
  }
  return best === -Infinity ? 1 : best;
}

/**
 * players.spiritual_roots 字段存的是一段 JSON 字符串（如 '{"quality":"地灵根","elements":["木","火"]}'）。
 * 这里统一做安全解析，任何格式异常都直接退化为空数组（视为无五行属性，中立结算），绝不抛出异常。
 */
export function parseElementsFromSpiritualRoots(spiritualRoots: unknown): string[] {
  try {
    const data: unknown = typeof spiritualRoots === 'string' ? JSON.parse(spiritualRoots) : spiritualRoots;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
    const elements = (data as { elements?: unknown }).elements;
    if (!Array.isArray(elements)) return [];
    // 只保留字符串元素，过滤掉意外混入的非字符串（如数字/对象），避免下游类型失真
    return elements.filter((el): el is string => typeof el === 'string');
  } catch {
    return [];
  }
}

export interface CombatParticipant {
  /** 大境界名称（如 "炼气"、"筑基"），未知境界名默认视为与对方同级，不产生境界压制效果 */
  realmMajor: string;
  /** 五行属性（灵根可能多个元素） */
  elements: string[];
}

export type CombatOutcome = 'player_instant_win' | 'enemy_instant_win' | 'normal';

export interface CombatResolution {
  outcome: CombatOutcome;
  /** 玩家境界位阶 - 敌人境界位阶，正数表示玩家境界更高 */
  realmGap: number;
  /** 玩家造成伤害的最终倍率（境界压制 × 五行相克，已经算好，直接乘在基础伤害上即可） */
  playerDamageMultiplier: number;
  /** 敌人造成伤害的最终倍率（即玩家承受伤害的倍率） */
  enemyDamageMultiplier: number;
  /** 供拼进 forcedOutcome / 日志的说明文案 */
  narrativeHint: string;
}

/** 境界差距达到该阈值（含）即视为「降维打击」，直接碾压/秒杀，不再进行常规伤害结算 */
const INSTANT_KILL_REALM_GAP = 2;
/** 己方境界比对方低一级时，输出伤害被强制压制到的比例（“绝非龙傲天”：低境界打不痛高境界） */
const SUPPRESSED_DAMAGE_MULTIPLIER = 0.4;
/** 己方境界比对方高一级时，输出伤害的加成比例 */
const DOMINANT_DAMAGE_MULTIPLIER = 1.5;
/** 己方境界比对方高一级时，承受伤害被削减到的比例 */
const DOMINANT_DEFENSE_MULTIPLIER = 0.5;

/**
 * 战斗与境界压制的核心结算：先判定境界差距是否已经拉开到「碾压秒杀」的程度，
 * 若还在可战范围内，再叠加五行相生相克的加成/减益，算出双方最终的伤害倍率。
 *
 * 上层调用者应该用 AI 报告的“基础伤害估算值” × 这里算出的倍率，得到真正落地的伤害，
 * 而不是直接采信 AI 自己给出的最终伤害数字。
 */
export function resolveCombatModifiers(player: CombatParticipant, enemy: CombatParticipant): CombatResolution {
  const playerRank = REALM_RANKS[player.realmMajor];
  const enemyRank = REALM_RANKS[enemy.realmMajor];
  // 境界名称未知（AI 瞎编或数据缺失）时，默认与对方同级，避免出现莫名其妙的碾压/被碾压
  const resolvedPlayerRank = playerRank ?? enemyRank ?? 0;
  const resolvedEnemyRank = enemyRank ?? playerRank ?? 0;
  const realmGap = resolvedPlayerRank - resolvedEnemyRank;

  if (realmGap <= -INSTANT_KILL_REALM_GAP) {
    return {
      outcome: 'enemy_instant_win',
      realmGap,
      playerDamageMultiplier: 0,
      enemyDamageMultiplier: 1,
      narrativeHint: `境界压制：敌人境界比玩家高出 ${Math.abs(realmGap)} 个大境界，双方实力如云泥之别，玩家绝无反抗之力，此战必然重创甚至陨落，气运与法宝宣称都无法改写这个结局。`,
    };
  }

  if (realmGap >= INSTANT_KILL_REALM_GAP) {
    return {
      outcome: 'player_instant_win',
      realmGap,
      playerDamageMultiplier: 1,
      enemyDamageMultiplier: 0,
      narrativeHint: `境界压制：玩家境界比敌人高出 ${realmGap} 个大境界，如降维打击，敌人不堪一击，此战必胜且玩家几乎不会受到实质伤害。`,
    };
  }

  const elementMultiplierForPlayer = getBestElementMultiplier(player.elements, enemy.elements);
  const elementMultiplierForEnemy = getBestElementMultiplier(enemy.elements, player.elements);

  let realmMultiplierForPlayer = 1;
  let realmMultiplierForEnemy = 1;
  let narrativeHint = '双方境界相当，胜负全凭真实战力与随机博弈，五行属性的克制关系会左右战斗细节。';

  if (realmGap === -1) {
    realmMultiplierForPlayer = SUPPRESSED_DAMAGE_MULTIPLIER;
    narrativeHint = '境界压制：敌人境界高出玩家一个大境界，玩家的攻击威力被强行压制到四成左右，很难对敌人造成实质伤害，不可能轻易反杀。';
  } else if (realmGap === 1) {
    realmMultiplierForPlayer = DOMINANT_DAMAGE_MULTIPLIER;
    realmMultiplierForEnemy = DOMINANT_DEFENSE_MULTIPLIER;
    narrativeHint = '境界压制：玩家境界高出敌人一个大境界，攻守两端均占据压倒性优势，碾压敌人毫无难度。';
  }

  return {
    outcome: 'normal',
    realmGap,
    playerDamageMultiplier: round(realmMultiplierForPlayer * elementMultiplierForPlayer),
    enemyDamageMultiplier: round(realmMultiplierForEnemy * elementMultiplierForEnemy),
    narrativeHint,
  };
}
