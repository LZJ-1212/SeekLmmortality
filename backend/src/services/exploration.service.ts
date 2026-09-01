/**
 * 探索与随机奇遇（Service 层，纯函数，不依赖数据库）。
 * 设定核心：九州地理分级（如青岳山适合炼气，中州天阙去之即死）。
 * 技术落地：
 *   1. 1d100 掷骰机制：玩家"出门历练"时，代码依据仙缘属性判定是否强行触发奇遇。
 *   2. 若玩家强闯远超自身境界的高危地图，代码强制扣除巨额气血以示惩戒。
 */

// ==================== 九州地理分级 ====================

export interface ExplorationRegion {
  name: string;
  /** 建议的最低安全境界位阶（沿用 combat.service 的 REALM_RANKS 体系），玩家境界低于此即视为"以下犯上" */
  minSafeRealmRank: number;
  /** 该地区的奇遇概率加成（灵气/机缘浓度越高，奇遇越容易发生） */
  fortuneEncounterBonus: number;
}

export const EXPLORATION_REGIONS: ExplorationRegion[] = [
  { name: '青岳·天机坊市', minSafeRealmRank: 0, fortuneEncounterBonus: 0 }, // 凡俗坊市，安全
  { name: '黑风岭', minSafeRealmRank: 0, fortuneEncounterBonus: 5 }, // 妖兽出没，炼气期可涉足
  { name: '幽冥谷', minSafeRealmRank: 1, fortuneEncounterBonus: 10 }, // 阴气浓重的秘境，建议筑基以上
  { name: '天机峰', minSafeRealmRank: 1, fortuneEncounterBonus: 5 }, // 宗门圣地
  { name: '中州天阙', minSafeRealmRank: 7, fortuneEncounterBonus: 30 }, // 大能云集之地，低境界去之即死
];
const DEFAULT_REGION_MIN_SAFE_RANK = 0;
const DEFAULT_REGION_FORTUNE_BONUS = 0;

/** 查询某地区的分级信息；未收录的地区默认视为普通安全地带，不会无端强加惩罚 */
export function findExplorationRegion(regionName: string): ExplorationRegion {
  const found = EXPLORATION_REGIONS.find((r) => r.name === regionName);
  return found ?? { name: regionName, minSafeRealmRank: DEFAULT_REGION_MIN_SAFE_RANK, fortuneEncounterBonus: DEFAULT_REGION_FORTUNE_BONUS };
}

// ==================== 1d100 奇遇掷骰 ====================

export const BASE_ENCOUNTER_CHANCE_PERCENT = 10; // 基础 10% 触发概率
export const FORTUNE_ENCOUNTER_COEFFICIENT = 1.5; // 仙缘每超出基准 1 点，触发概率 +1.5%
export const MAX_ENCOUNTER_CHANCE_PERCENT = 80; // 触发概率封顶 80%，永远保留"平淡无事"的可能性
const FORTUNE_BASELINE = 10; // 六维基准值

export type EncounterType = 'wounded_expert' | 'secret_realm' | 'none';

export interface EncounterRoll {
  /** 1~100 的掷骰结果，供日志/调试展示 */
  roll: number;
  triggered: boolean;
  encounterType: EncounterType;
  forcedOutcomeText: string;
}

/** 依据仙缘换算出本次历练触发奇遇的概率（0~100） */
export function calculateEncounterChance(fortune: number, regionBonus: number = 0): number {
  const chance = BASE_ENCOUNTER_CHANCE_PERCENT + Math.max(0, fortune - FORTUNE_BASELINE) * FORTUNE_ENCOUNTER_COEFFICIENT + regionBonus;
  return Math.min(MAX_ENCOUNTER_CHANCE_PERCENT, Math.max(0, chance));
}

/**
 * 出门历练的奇遇掷骰：1d100 与仙缘换算出的概率比较，命中则强行触发奇遇，
 * 具体是"遇到重伤大能"还是"秘境现世"由第二次掷骰决定，两种奇遇各占一半概率。
 * 是否触发、触发哪一种全部由后端硬性决定，AI 只负责把结果演绎成剧情。
 */
export function rollExplorationEncounter(
  fortune: number,
  regionBonus: number = 0,
  rolls: { encounterRoll?: () => number; typeRoll?: () => number } = {},
): EncounterRoll {
  const encounterRollFn = rolls.encounterRoll ?? Math.random;
  const typeRollFn = rolls.typeRoll ?? Math.random;

  const roll = Math.floor(encounterRollFn() * 100) + 1; // 1d100，范围 1~100
  const chance = calculateEncounterChance(fortune, regionBonus);

  if (roll > chance) {
    return { roll, triggered: false, encounterType: 'none', forcedOutcomeText: '' };
  }

  const encounterType: EncounterType = typeRollFn() < 0.5 ? 'wounded_expert' : 'secret_realm';
  const forcedOutcomeText = encounterType === 'wounded_expert'
    ? `掷骰机缘（1d100=${roll} ≤ ${Math.round(chance)}）：天道强行触发奇遇——玩家历练途中，意外遇到一位身受重伤、气息奄奄的大能高手。这份机缘可能是传承、报答或杀身之祸，需要即兴演绎出合理的后续剧情与选项，具体收获（若有）走正常的 item_changes/combat 流程。`
    : `掷骰机缘（1d100=${roll} ≤ ${Math.round(chance)}）：天道强行触发奇遇——天地灵气骤然波动，一处尘封已久的秘境轰然现世在玩家面前。这份机缘可能藏着宝藏也可能布满杀机，需要即兴演绎出合理的后续剧情与选项，具体收获（若有）走正常的 item_changes/combat 流程。`;

  return { roll, triggered: true, encounterType, forcedOutcomeText };
}

// ==================== 高危地图强闯惩罚 ====================

/** 境界差距达到该阈值（含），即视为"去之即死"级别的地理天险，与战斗系统的碾压秒杀阈值保持一致 */
const LETHAL_REALM_GAP_THRESHOLD = 2;
/** 未达到"去之即死"级别，但仍属于以下犯上时的气血惩罚比例（按当前气血上限计算） */
const DANGEROUS_ZONE_DAMAGE_PERCENT = 0.7;

export interface RegionDangerCheck {
  regionName: string;
  isDangerous: boolean;
  isLethal: boolean;
  hpDamagePercent: number;
  forcedOutcomeText: string;
}

/**
 * 高危地图的确定性惩罚判定：玩家境界位阶低于地区建议门槛达到 2 级及以上时，
 * 视为"去之即死"的地理天险，直接判定重创/陨落；差距在 1 级以内时，
 * 仍会因环境凶险受到较重的气血惩罚，但不至于致命——具体伤害比例全部由后端硬算。
 */
export function checkRegionDanger(playerRealmRank: number, region: ExplorationRegion): RegionDangerCheck {
  const gap = region.minSafeRealmRank - playerRealmRank;

  if (gap <= 0) {
    return { regionName: region.name, isDangerous: false, isLethal: false, hpDamagePercent: 0, forcedOutcomeText: '' };
  }

  if (gap >= LETHAL_REALM_GAP_THRESHOLD) {
    return {
      regionName: region.name,
      isDangerous: true,
      isLethal: true,
      hpDamagePercent: 1,
      forcedOutcomeText: `玩家强闯「${region.name}」，此地对其境界而言是绝对禁地，天地法则本身便足以碾碎凡躯，去之即死！玩家当场身受致命重创，绝无幸理。`,
    };
  }

  return {
    regionName: region.name,
    isDangerous: true,
    isLethal: false,
    hpDamagePercent: DANGEROUS_ZONE_DAMAGE_PERCENT,
    forcedOutcomeText: `玩家强闯「${region.name}」，此地对其当前境界而言过于凶险，环境本身的天地法则与潜藏凶兽便让其身受重创。`,
  };
}

/** 判定行动文本中是否在尝试"出门历练/探索"这类会触发地理奇遇/风险的行为 */
const EXPLORATION_KEYWORDS = ['历练', '出门', '外出', '探索', '游历', '远行', '闯'];
export function isExplorationAttempt(actionText: string): boolean {
  if (!actionText) return false;
  return EXPLORATION_KEYWORDS.some((k) => actionText.includes(k));
}
