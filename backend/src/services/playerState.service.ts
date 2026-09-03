/**
 * 修订：
 * 2026-09-03 23:40 +08 lzj — 闭关气血灵力回复与出关境界叙事锁
 * 核心状态机（Service 层，纯函数，不依赖数据库）。
 * 负责：气血/灵力/修为的流逝与恢复、时间流逝的月份累加、寿元耗尽判定、
 * 以及境界突破的确定性数值结算（不依赖 AI 自行计算关键惩罚/奖励数值）。
 */

import { parseNumberToken, NUMBER_TOKEN_PATTERN } from '../utils/numeral';

export const MONTHS_PER_YEAR = 12;
export const MONTHS_PER_SEASON = 3;
export const SEASON_ORDER = ['春', '夏', '秋', '冬'] as const;

/** 保留 4 位小数，避免浮点数运算产生的极小误差在数据库里越滚越乱 */
function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** 气血/灵力等有上下限的资源：在 [0, max] 区间内增减 */
export function clampResource(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(max, current + delta));
}

/** 修为：只有下限 0，没有上限（上限由境界突破阈值天然约束） */
export function applyCultivationDelta(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

/**
 * 时间流逝法则：把本次行动消耗的月数（可能是 0.1、0.2 这种零碎小数）累加到
 * “未满一年的零碎月份累加器”里，累计满 12 个月才真正进位增加年龄。
 * 这样无论玩家做多少次“瞬时微小行动”，年龄最终都会被正确、精确地推进。
 */
export function advanceAge(
  currentAge: number,
  pendingMonths: number,
  monthsPassed: number,
): { newAge: number; newPendingMonths: number } {
  const totalMonths = pendingMonths + monthsPassed;
  const yearsToAdd = Math.floor(totalMonths / MONTHS_PER_YEAR);
  const newPendingMonths = round(totalMonths - yearsToAdd * MONTHS_PER_YEAR);
  return { newAge: currentAge + yearsToAdd, newPendingMonths };
}

/**
 * 世界时间流逝：与 advanceAge 同样的累加器思路，每满 3 个月推进一个季节，
 * 每满 4 个季节（12 个月）推进一年。
 */
export function advanceWorldTime(
  currentYear: number,
  currentSeason: string,
  pendingMonths: number,
  monthsPassed: number,
): { newYear: number; newSeason: string; newPendingMonths: number } {
  const totalMonths = pendingMonths + monthsPassed;
  const seasonSteps = Math.floor(totalMonths / MONTHS_PER_SEASON);
  const newPendingMonths = round(totalMonths - seasonSteps * MONTHS_PER_SEASON);

  const currentSeasonIdx = Math.max(0, SEASON_ORDER.indexOf(currentSeason as (typeof SEASON_ORDER)[number]));
  const totalSeasonIdx = currentSeasonIdx + seasonSteps;
  const yearsToAdd = Math.floor(totalSeasonIdx / SEASON_ORDER.length);
  const newSeasonIdx = ((totalSeasonIdx % SEASON_ORDER.length) + SEASON_ORDER.length) % SEASON_ORDER.length;

  return {
    newYear: currentYear + yearsToAdd,
    newSeason: SEASON_ORDER[newSeasonIdx],
    newPendingMonths,
  };
}

/** 寿元耗尽判定：年龄超过寿元上限即视为寿元耗尽（游戏设计白皮书：年龄 > 寿元上限则强制坐化） */
export function isLifespanExhausted(age: number, maxLifespan: number): boolean {
  return age > maxLifespan;
}

export type DeathReason =
  | 'hp_exhausted'
  | 'lifespan_exhausted'
  | 'tribulation_failure'
  | 'realm_suppression'
  | 'karma_retribution'
  | 'region_danger'
  | null;

/** 最基础的死亡判定：气血耗尽或寿元耗尽，二者任一成立即判定死亡 */
export function getDeathReason(hp: number, age: number, maxLifespan: number): DeathReason {
  if (hp <= 0) return 'hp_exhausted';
  if (isLifespanExhausted(age, maxLifespan)) return 'lifespan_exhausted';
  return null;
}

export function isDead(hp: number, age: number, maxLifespan: number): boolean {
  return getDeathReason(hp, age, maxLifespan) !== null;
}

// ==================== 时间与岁月流逝：闭关时长解析（大限压迫感） ====================

/** 玩家提到「闭关」但未指明具体时长时的默认时长（按 1 年计） */
export const DEFAULT_SECLUSION_MONTHS = MONTHS_PER_YEAR;

const NUMBER_TOKEN = NUMBER_TOKEN_PATTERN;

/**
 * 时间流逝法则·闭关篇：「闭关无岁月，转眼数十载」——闭关的时长绝不能交给 AI 随口猜测，
 * 必须由后端从玩家的行动文本里精确解析出真实月数，强制注入后续结算，做到「转眼数十载」
 * 的真实感和不可篡改性。
 *
 * 支持："闭关十年"、"闭关30年"、"闭关半年"、"闭关三个月"、"闭关七天" 等常见表达。
 * 若提到"闭关"但没有写明具体时长，按 {@link DEFAULT_SECLUSION_MONTHS}（1 年）计算。
 * 若行动文本压根没提到"闭关"，返回 null，交由调用方使用 AI 给出的普通时间消耗。
 */
export function detectSeclusionMonths(actionText: string): number | null {
  if (!actionText || !actionText.includes('闭关')) return null;

  if (/半(年|载)/.test(actionText)) {
    return MONTHS_PER_YEAR / 2;
  }

  const yearMatch = actionText.match(new RegExp(`${NUMBER_TOKEN}\\s*(年|载)`));
  if (yearMatch?.[1]) {
    const years = parseNumberToken(yearMatch[1]);
    if (years !== null && years > 0) return years * MONTHS_PER_YEAR;
  }

  const monthMatch = actionText.match(new RegExp(`${NUMBER_TOKEN}\\s*个?月`));
  if (monthMatch?.[1]) {
    const months = parseNumberToken(monthMatch[1]);
    if (months !== null && months > 0) return months;
  }

  const dayMatch = actionText.match(new RegExp(`${NUMBER_TOKEN}\\s*(天|日)`));
  if (dayMatch?.[1]) {
    const days = parseNumberToken(dayMatch[1]);
    if (days !== null && days > 0) return round(days / 30);
  }

  return DEFAULT_SECLUSION_MONTHS;
}

/** 把月数格式化成人类可读的中文时长（用于拼进 forcedOutcome，让 AI 的叙事和真实流逝的时间对得上） */
export function describeMonths(months: number): string {
  if (months <= 0) return '片刻';
  const years = Math.floor(months / MONTHS_PER_YEAR);
  const remainingMonths = Math.round(round(months - years * MONTHS_PER_YEAR));
  if (years > 0 && remainingMonths > 0) return `${years}年${remainingMonths}个月`;
  if (years > 0) return `${years}年`;
  if (months >= 1) return `${Math.round(months)}个月`;
  return `${Math.round(months * 30)}天`;
}

/** 闭关调息：每月恢复「缺失量」的 8%，12 个月约回满（纯函数，可单测） */
const SECLUSION_RECOVERY_RATE_PER_MONTH = 0.08;

export interface SeclusionResourceRecovery {
  hpDelta: number;
  mpDelta: number;
}

export function calculateSeclusionResourceRecovery(
  months: number,
  hp: number,
  maxHp: number,
  mp: number,
  maxMp: number,
): SeclusionResourceRecovery {
  const m = Math.max(0, months);
  if (m <= 0) return { hpDelta: 0, mpDelta: 0 };
  const factor = Math.min(1, SECLUSION_RECOVERY_RATE_PER_MONTH * m);
  const hpMissing = Math.max(0, maxHp - hp);
  const mpMissing = Math.max(0, maxMp - mp);
  return {
    hpDelta: Math.round(hpMissing * factor),
    mpDelta: Math.round(mpMissing * factor),
  };
}

/** 闭关出关叙事锁：境界不变，禁止模型写「已晋后期」而面板未突破 */
export function buildSeclusionRealmNarrativeLock(
  realmMajor: string,
  realmMinor: string,
  cultivationBefore: number,
  cultivationGain: number,
  laws: Record<string, RealmLaw>,
): string {
  const key = `${realmMajor}·${realmMinor}`;
  const law = laws[key];
  const after = cultivationBefore + cultivationGain;
  let tail = '';
  if (law && after >= law.reqCultivation) {
    tail = law.isMajor
      ? '，修为已够大境门槛，但须玩家另发「突破」渡劫方可晋境'
      : '，修为已够下一小境门槛，但须玩家另发「突破」方可晋境';
  }
  return `玩家出关后境界仍为【${key}】，叙事禁止写已晋入其它小境或大境；闭关后修为约 ${after} 点${tail}。`;
}

// ==================== 时间与岁月流逝：寿元危机预警（大限压迫感） ====================

export interface LifespanStatus {
  /** 剩余寿元（年），已耗尽时为 0 */
  remainingYears: number;
  /** 是否已经进入「大限将至」的预警区间 */
  isNearingLifespanLimit: boolean;
  /** 供拼进 forcedOutcome 的预警文案，未进入预警区间时为 null */
  warningMessage: string | null;
}

/**
 * 寿元危机预警：剩余寿元低于寿元上限的 10% 时，视为「大限将至」，需要持续给玩家制造紧迫感——
 * 修仙路上不仅要与人斗，更要与天夺命。
 * 预警阈值夹在 [3, 50] 年之间：既保证低境界（寿元本来就短）也能有意义地提前预警，
 * 也避免高境界（寿元动辄成千上万年）出现"离死还有几千年就开始警告"的荒谬情况。
 */
export function getLifespanStatus(age: number, maxLifespan: number): LifespanStatus {
  const remainingYears = Math.max(0, maxLifespan - age);
  const threshold = Math.min(50, Math.max(3, Math.round(maxLifespan * 0.1)));
  const isNearingLifespanLimit = remainingYears > 0 && remainingYears <= threshold;

  return {
    remainingYears,
    isNearingLifespanLimit,
    warningMessage: isNearingLifespanLimit
      ? `天道警示：寿元仅剩 ${remainingYears} 年，大限将至！若不能寻得续命机缘或突破境界提升寿元上限，终将油尽灯枯、命殒大限。`
      : null,
  };
}

/** 大境界雷劫的三大等级：人道劫（较易） < 地道劫（危险） < 天道劫（九死一生） */
export type TribulationTier = '人道' | '地道' | '天道';

/** 境界突破法则表的类型定义 */
export interface RealmLaw {
  next: string;
  reqCultivation: number;
  isMajor: boolean;
  /** 仅大境界突破需要：雷劫等级，决定叙事上的凶险程度描述 */
  tribulationTier?: TribulationTier;
  /** 仅大境界突破需要：基础成功率（0~1） */
  baseSuccess?: number;
  /** 仅大境界突破需要：突破失败时的雷劫伤害，按“当前气血上限”的百分比计算（0~1） */
  tribulationDamagePercent?: number;
  /** 仅大境界突破需要：突破失败后，在受伤之外额外判定“九死一生”式陨落的概率（0~1） */
  deathChanceOnFailure?: number;
  /** 突破成功后气血上限的增量 */
  maxHpGain?: number;
  /** 突破成功后的新寿元上限 */
  newLifespan?: number;
}

/**
 * 天地法则：完整的九大境界突破阈值与雷劫数据。
 * 小境界（初期/中期/后期/圆满）水到渠成，只要修为达标即可突破，无风险。
 * 大境界跨越（如炼气→筑基）必须渡雷劫，雷劫等级随境界提升从人道劫一路加重到天道劫，
 * 越到后期成功率越低、雷劫伤害越高、失败后陨落的概率也越高——“九死一生”。
 */
export const REALM_LAWS: Record<string, RealmLaw> = {
  // ---- 炼气期：凡人入道的第一步，雷劫尚且温和（人道劫） ----
  '炼气·初期': { next: '炼气·中期', reqCultivation: 100, isMajor: false },
  '炼气·中期': { next: '炼气·后期', reqCultivation: 200, isMajor: false },
  '炼气·后期': { next: '炼气·圆满', reqCultivation: 400, isMajor: false },
  '炼气·圆满': {
    next: '筑基·初期', reqCultivation: 800, isMajor: true,
    tribulationTier: '人道', baseSuccess: 0.7, tribulationDamagePercent: 0.3,
    deathChanceOnFailure: 0, maxHpGain: 100, newLifespan: 200,
  },

  // ---- 筑基期：初窥长生门径，人道劫加重 ----
  '筑基·初期': { next: '筑基·中期', reqCultivation: 1000, isMajor: false },
  '筑基·中期': { next: '筑基·后期', reqCultivation: 1500, isMajor: false },
  '筑基·后期': { next: '筑基·圆满', reqCultivation: 2200, isMajor: false },
  '筑基·圆满': {
    next: '金丹·初期', reqCultivation: 3000, isMajor: true,
    tribulationTier: '人道', baseSuccess: 0.65, tribulationDamagePercent: 0.35,
    deathChanceOnFailure: 0.05, maxHpGain: 200, newLifespan: 400,
  },

  // ---- 金丹期：结成金丹，寿元大增，雷劫开始真正致命 ----
  '金丹·初期': { next: '金丹·中期', reqCultivation: 4000, isMajor: false },
  '金丹·中期': { next: '金丹·后期', reqCultivation: 6000, isMajor: false },
  '金丹·后期': { next: '金丹·圆满', reqCultivation: 9000, isMajor: false },
  '金丹·圆满': {
    next: '元婴·初期', reqCultivation: 13000, isMajor: true,
    tribulationTier: '地道', baseSuccess: 0.55, tribulationDamagePercent: 0.45,
    deathChanceOnFailure: 0.12, maxHpGain: 400, newLifespan: 800,
  },

  // ---- 元婴期：元婴出窍，地道劫愈发凶险 ----
  '元婴·初期': { next: '元婴·中期', reqCultivation: 18000, isMajor: false },
  '元婴·中期': { next: '元婴·后期', reqCultivation: 25000, isMajor: false },
  '元婴·后期': { next: '元婴·圆满', reqCultivation: 34000, isMajor: false },
  '元婴·圆满': {
    next: '化神·初期', reqCultivation: 46000, isMajor: true,
    tribulationTier: '地道', baseSuccess: 0.5, tribulationDamagePercent: 0.5,
    deathChanceOnFailure: 0.18, maxHpGain: 800, newLifespan: 1500,
  },

  // ---- 化神期：神识通天，正式踏入天道劫的门槛 ----
  '化神·初期': { next: '化神·中期', reqCultivation: 60000, isMajor: false },
  '化神·中期': { next: '化神·后期', reqCultivation: 80000, isMajor: false },
  '化神·后期': { next: '化神·圆满', reqCultivation: 105000, isMajor: false },
  '化神·圆满': {
    next: '炼虚·初期', reqCultivation: 140000, isMajor: true,
    tribulationTier: '天道', baseSuccess: 0.4, tribulationDamagePercent: 0.6,
    deathChanceOnFailure: 0.28, maxHpGain: 1500, newLifespan: 3000,
  },

  // ---- 炼虚期：虚实相合，天道劫愈演愈烈 ----
  '炼虚·初期': { next: '炼虚·中期', reqCultivation: 180000, isMajor: false },
  '炼虚·中期': { next: '炼虚·后期', reqCultivation: 230000, isMajor: false },
  '炼虚·后期': { next: '炼虚·圆满', reqCultivation: 290000, isMajor: false },
  '炼虚·圆满': {
    next: '合体·初期', reqCultivation: 360000, isMajor: true,
    tribulationTier: '天道', baseSuccess: 0.35, tribulationDamagePercent: 0.65,
    deathChanceOnFailure: 0.35, maxHpGain: 3000, newLifespan: 6000,
  },

  // ---- 合体期：天人合一，距飞升仅一步之遥 ----
  '合体·初期': { next: '合体·中期', reqCultivation: 440000, isMajor: false },
  '合体·中期': { next: '合体·后期', reqCultivation: 530000, isMajor: false },
  '合体·后期': { next: '合体·圆满', reqCultivation: 630000, isMajor: false },
  '合体·圆满': {
    next: '大乘·初期', reqCultivation: 750000, isMajor: true,
    tribulationTier: '天道', baseSuccess: 0.3, tribulationDamagePercent: 0.7,
    deathChanceOnFailure: 0.42, maxHpGain: 6000, newLifespan: 12000,
  },

  // ---- 大乘期：修仙路的顶点，渡劫飞升前的最后关卡，九死一生 ----
  '大乘·初期': { next: '大乘·中期', reqCultivation: 900000, isMajor: false },
  '大乘·中期': { next: '大乘·后期', reqCultivation: 1080000, isMajor: false },
  '大乘·后期': { next: '大乘·圆满', reqCultivation: 1300000, isMajor: false },
  '大乘·圆满': {
    next: '渡劫期·飞升', reqCultivation: 1600000, isMajor: true,
    tribulationTier: '天道', baseSuccess: 0.2, tribulationDamagePercent: 0.8,
    deathChanceOnFailure: 0.55, maxHpGain: 12000, newLifespan: 99999,
  },
};

export interface BreakthroughAttemptInput {
  realmMajor: string;
  realmMinor: string;
  cultivation: number;
  hp: number;
  maxHp: number;
  maxLifespan: number;
  daoHeart: number;
  /** 功德：白皮书法则「功德可用于抵御雷劫」，功德越高，渡劫成功率略有提升 */
  merit: number;
}

/** 可注入的随机数生成器集合，便于单元测试确定性地覆盖成功/失败/陨落三种分支 */
export interface BreakthroughRolls {
  /** 决定本次渡劫成功与否的判定骰 */
  successRoll?: () => number;
  /** 渡劫失败后，决定是否“九死一生”陨落的判定骰 */
  deathRoll?: () => number;
}

/** 突破结算结果：patch 里是“最终确定值”而非增量，玩家属性直接被覆盖为这些值 */
export interface BreakthroughAttemptResult {
  success: boolean;
  /** 是否是"大境界渡雷劫成功"（区别于小境界的水到渠成），只有这种情况才触发逆天改命天赋三选一 */
  isMajorBreakthroughSuccess: boolean;
  /** 突破失败时，是否触发了雷劫陨落（区别于普通重伤，用于死亡原因细分展示） */
  diedFromTribulation: boolean;
  forcedOutcomeText: string;
  patch: {
    hp: number;
    cultivation: number;
    realmMajor: string;
    realmMinor: string;
    maxHp: number;
    maxLifespan: number;
  };
}

const MAX_MERIT_SUCCESS_BONUS = 0.15;
const MIN_SUCCESS_RATE = 0.05;
const MAX_SUCCESS_RATE = 0.95;

/**
 * 境界突破 / 渡雷劫的确定性结算：所有气血/修为/境界/寿元变化全部由后端硬计算得出，
 * 绝不依赖 AI 自行在 JSON 里填写对应的 hp_delta / cultivation_delta。
 * 这样即便 AI 的叙事描述有偏差，实际数值结算依然 100% 准确、不可被 LLM 篡改。
 *
 * - 小境界：修为达标直接突破，水到渠成，无风险。
 * - 大境界：必须渡雷劫，雷劫等级（人道/地道/天道）由 REALM_LAWS 决定。
 *   成功：寿元大涨、气血完全恢复至新上限。
 *   失败：先判定是否“九死一生”式陨落（tribulationTier 越高、之前失败次数越多风险越大）；
 *         若未陨落，则按气血上限比例受到雷劫重伤、修为大跌。
 *
 * @param rolls 可注入的随机数生成器（默认 Math.random），便于单元测试覆盖各分支
 */
export function resolveBreakthroughAttempt(
  input: BreakthroughAttemptInput,
  realmLaws: Record<string, RealmLaw>,
  rolls: BreakthroughRolls = {},
): BreakthroughAttemptResult {
  const successRoll = rolls.successRoll ?? Math.random;
  const deathRoll = rolls.deathRoll ?? Math.random;

  const key = `${input.realmMajor}·${input.realmMinor}`;
  const law = realmLaws[key];

  const unchangedPatch = {
    hp: input.hp,
    cultivation: input.cultivation,
    realmMajor: input.realmMajor,
    realmMinor: input.realmMinor,
    maxHp: input.maxHp,
    maxLifespan: input.maxLifespan,
  };

  if (!law) {
    return {
      success: false,
      isMajorBreakthroughSuccess: false,
      diedFromTribulation: false,
      forcedOutcomeText: '玩家试图突破，但前方境界未明，无法突破。扣除少量灵力。',
      patch: unchangedPatch,
    };
  }

  if (input.cultivation < law.reqCultivation) {
    return {
      success: false,
      isMajorBreakthroughSuccess: false,
      diedFromTribulation: false,
      forcedOutcomeText: `玩家试图突破，但修为不足（需要${law.reqCultivation}）。强行冲关导致灵力反噬，受轻伤（气血-10），突破失败。`,
      patch: { ...unchangedPatch, hp: clampResource(input.hp, -10, input.maxHp) },
    };
  }

  if (!law.isMajor) {
    const [nextMajor, nextMinor] = law.next.split('·');
    return {
      success: true,
      isMajorBreakthroughSuccess: false,
      diedFromTribulation: false,
      forcedOutcomeText: `玩家水到渠成，突破至小境界【${law.next}】。修为清零重修。`,
      patch: {
        ...unchangedPatch,
        cultivation: 0,
        realmMajor: nextMajor ?? input.realmMajor,
        realmMinor: nextMinor ?? input.realmMinor,
      },
    };
  }

  // ==================== 大境界突破：渡雷劫 ====================
  const tier = law.tribulationTier ?? '人道';
  const meritBonus = Math.min(MAX_MERIT_SUCCESS_BONUS, Math.max(0, input.merit) * 0.0005);
  const successRate = Math.min(
    MAX_SUCCESS_RATE,
    Math.max(MIN_SUCCESS_RATE, (law.baseSuccess ?? 0.5) + input.daoHeart * 0.01 + meritBonus),
  );

  const roll = successRoll();

  if (roll <= successRate) {
    const [nextMajor, nextMinor] = law.next.split('·');
    const newMaxHp = input.maxHp + (law.maxHpGain ?? 100);
    return {
      success: true,
      isMajorBreakthroughSuccess: true,
      diedFromTribulation: false,
      forcedOutcomeText: `玩家历经${tier}劫的九死一生，成功抵御雷劫，突破至【${law.next}】！气血上限大增，伤势完全恢复，寿元大涨。`,
      patch: {
        hp: newMaxHp, // 突破成功伤势完全恢复：气血回满至新上限
        cultivation: 0,
        realmMajor: nextMajor ?? input.realmMajor,
        realmMinor: nextMinor ?? input.realmMinor,
        maxHp: newMaxHp,
        maxLifespan: law.newLifespan ?? input.maxLifespan,
      },
    };
  }

  // 突破失败：先判定是否触发“九死一生”式陨落
  const deathChance = Math.max(0, (law.deathChanceOnFailure ?? 0) - input.daoHeart * 0.002);
  if (deathChance > 0 && deathRoll() <= deathChance) {
    return {
      success: false,
      isMajorBreakthroughSuccess: false,
      diedFromTribulation: true,
      forcedOutcomeText: `玩家渡${tier}劫失败，雷霆之威远超肉身承受极限，当场被雷劫轰灭，道消身陨于这场九死一生的天劫之中。`,
      patch: { ...unchangedPatch, hp: 0 },
    };
  }

  const damage = Math.round(input.maxHp * (law.tribulationDamagePercent ?? 0.3));
  return {
    success: false,
    isMajorBreakthroughSuccess: false,
    diedFromTribulation: false,
    forcedOutcomeText: `玩家渡${tier}劫失败，被雷劫劈中！身受重伤（气血-${damage}），修为大跌（修为-100）。`,
    patch: {
      ...unchangedPatch,
      hp: clampResource(input.hp, -damage, input.maxHp),
      cultivation: applyCultivationDelta(input.cultivation, -100),
    },
  };
}

// ==================== 岁月加深：日段 / 时辰 / 按场扣时（B1，I20） ====================
// 主钟仍是年/季/月；时辰只做微行累加器。禁止用模型判「这句该过几个时辰」。
// 词表与优先级权威见 docs/player_state.md 第 5.4 节，落点见 player_state_architecture.md。

/** 给玩家看的日段调度 */
export type DayPhase = 'dawn' | 'noon' | 'dusk' | 'night';
/** 未收束微行场：talk 叙话 / market 坊市 / none 无 */
export type BeatScene = 'none' | 'talk' | 'market';

const PHASE_ORDER: readonly DayPhase[] = ['dawn', 'noon', 'dusk', 'night'];
const PHASE_LABEL: Record<DayPhase, string> = { dawn: '晨', noon: '午', dusk: '晚', night: '夜' };

/** 1 日 = 12 时辰；1 日段 = 3 时辰；30 日 = 1 月 */
const SHICHEN_PER_PHASE = 3;
const DAYS_PER_MONTH = 30;

/** 解析库里的 day_phase 列；未知值一律当 dawn，绝不 throw 把整次回合打 500 */
export function parseDayPhase(raw: unknown): DayPhase {
  return raw === 'noon' || raw === 'dusk' || raw === 'night' ? raw : 'dawn';
}

/** 解析库里的 beat_scene 列；未知值一律当 none */
export function parseBeatScene(raw: unknown): BeatScene {
  return raw === 'talk' || raw === 'market' ? raw : 'none';
}

/** 日段文案（给 forcedOutcome / 前端） */
export function describeDayPhase(phase: DayPhase): string {
  return PHASE_LABEL[phase] ?? '晨';
}

/** 把时辰数格式化成人类可读短语（日志用；禁止对 0 写「流逝 0 个月」） */
export function describeShichen(n: number): string {
  if (n <= 0) return '片刻';
  if (n === 1) return '一时辰';
  if (n === 2) return '两时辰';
  return `${n}时辰`;
}

/** 下一日段：dawn → noon → dusk → night → dawn */
function nextPhase(phase: DayPhase): DayPhase {
  const i = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[(i + 1) % PHASE_ORDER.length] ?? 'dawn';
}

/**
 * 时辰累加：满 3 时辰换下一日段；night 再满 3 则进入下一天（回到 dawn，pending_days +1）；
 * 满 30 日折成整月返回。纯函数，不掷骰、不调模型。
 */
export function applyShichen(
  phase: DayPhase,
  shichen: number,
  days: number,
  deltaShichen: number,
): { phase: DayPhase; shichen: number; days: number; monthsToAdd: number } {
  let s = Math.max(0, shichen) + deltaShichen;
  let d = Math.max(0, days);
  let p = phase;
  while (s >= SHICHEN_PER_PHASE) {
    s -= SHICHEN_PER_PHASE;
    p = nextPhase(p);
    if (p === 'dawn') d += 1;
  }
  let months = 0;
  while (d >= DAYS_PER_MONTH) {
    d -= DAYS_PER_MONTH;
    months += 1;
  }
  return { phase: p, shichen: s, days: d, monthsToAdd: months };
}

/** 开场（1～2 日段）：可注入 rollFn，< 0.5 得 3 时辰，否则 6 时辰。禁止写死 Math.random。 */
export function openingShichen(rollFn: () => number = Math.random): number {
  return rollFn() < 0.5 ? 3 : 6;
}

/** 叙话开场词（封闭表，只准改本处与成册 5.4.3） */
const TALK_OPENING_KEYWORDS: readonly string[] = [
  '聊聊天', '叙话', '闲谈', '闲聊', '一席酒', '喝一杯', '攀谈', '交谈', '说说话', '打听修仙门路',
];

/** 坊市开场词 */
const MARKET_OPENING_KEYWORDS: readonly string[] = [
  '逛逛坊市', '去坊市', '在坊市', '坊市四处转转', '逛街', '逛一逛',
];

/** 离开词（beat_scene 置 none；与 A6 离开表对齐，但不含「闭关」——闭关走月数档） */
const BEAT_LEAVE_KEYWORDS: readonly string[] = [
  '不管他', '弃之不顾', '抛下', '丢下', '告辞', '就此别过', '转身离去', '离开此地', '回府',
];

/** 历练词（1 月；与 exploration.service 出门词对齐） */
const TRAVEL_KEYWORDS: readonly string[] = ['历练', '出门', '外出', '探索', '游历', '远行', '闯'];

/** 交手词（1 月；不含情境锁语境，只锁时间档） */
const COMBAT_KEYWORDS: readonly string[] = ['交手', '开战', '厮杀', '迎战', '动手'];

/** 点名日段（只锁叙事落点，0 时辰，不加钟） */
const POINTED_PHASE: ReadonlyArray<readonly [string, DayPhase]> = [
  ['卯', 'dawn'], ['辰', 'dawn'], ['巳', 'dawn'],
  ['午', 'noon'], ['未', 'noon'],
  ['申', 'dusk'], ['酉', 'dusk'], ['戌', 'dusk'],
  ['亥', 'night'], ['子', 'night'], ['丑', 'night'], ['寅', 'night'],
];

/** 玩家点名时辰时，返回叙事应锁到的日段；未点名返回 null（不加钟） */
export function pointedDayPhase(actionText: string): DayPhase | null {
  const t = actionText ?? '';
  for (const [ch, ph] of POINTED_PHASE) {
    if (t.includes(ch)) return ph;
  }
  return null;
}

export interface ActionClockInput {
  actionText: string;
  beat: BeatScene;
  phase: DayPhase;
  shichen: number;
  days: number;
  /** detectSeclusionMonths 的结果；null = 本回合非闭关 */
  seclusionMonths: number | null;
  /** 炼制配方月数；null = 本回合非炼制 */
  craftMonths: number | null;
  rollFn?: () => number;
}

export interface ActionClockResult {
  monthsPassed: number;
  beat: BeatScene;
  phase: DayPhase;
  shichen: number;
  days: number;
  logPhrase: string;
}

function openingResult(beat: BeatScene, phase: DayPhase, shichen: number, days: number, rollFn: () => number): ActionClockResult {
  const delta = openingShichen(rollFn);
  const applied = applyShichen(phase, shichen, days, delta);
  return { monthsPassed: applied.monthsToAdd, beat, phase: applied.phase, shichen: applied.shichen, days: applied.days, logPhrase: describeShichen(delta) };
}

function shichenResult(phase: DayPhase, shichen: number, days: number, delta: number, beat: BeatScene, logPhrase: string): ActionClockResult {
  const applied = applyShichen(phase, shichen, days, delta);
  return { monthsPassed: applied.monthsToAdd, beat, phase: applied.phase, shichen: applied.shichen, days: applied.days, logPhrase };
}

/**
 * 本回合钟：按 docs/player_state.md 5.4.1 优先级自上而下只走一档。
 * 闭关 → 炼制 → 历练/交手(1 月) → 场内(离开/0 时辰) → 开场(3/6 时辰) → 未命中(1 时辰)。
 * 不再采信模型的 time_cost_months；不调用第二次 LLM。
 */
export function resolveActionClock(input: ActionClockInput): ActionClockResult {
  const { actionText, beat, phase, shichen, days, seclusionMonths, craftMonths } = input;
  const rollFn = input.rollFn ?? Math.random;
  const t = (actionText ?? '').replace(/\s+/g, '');

  if (seclusionMonths !== null) {
    return { monthsPassed: seclusionMonths, beat: 'none', phase: 'dawn', shichen: 0, days, logPhrase: describeMonths(seclusionMonths) };
  }
  if (craftMonths !== null) {
    return { monthsPassed: craftMonths, beat: 'none', phase, shichen, days, logPhrase: describeMonths(craftMonths) };
  }
  if (TRAVEL_KEYWORDS.some((k) => t.includes(k)) || COMBAT_KEYWORDS.some((k) => t.includes(k))) {
    return { monthsPassed: 1, beat: 'none', phase: 'dusk', shichen: 0, days, logPhrase: '1个月' };
  }
  if (beat === 'talk' || beat === 'market') {
    if (BEAT_LEAVE_KEYWORDS.some((k) => t.includes(k))) {
      const toDusk = t.includes('回府');
      return { monthsPassed: 0, beat: 'none', phase: toDusk ? 'dusk' : phase, shichen, days, logPhrase: toDusk ? '回府，日已黄昏' : '片刻' };
    }
    // 场内词 / 同场再点开场词 / 未列表接话：都算场内，0 时辰，场不变（不连刷）
    return { monthsPassed: 0, beat, phase, shichen, days, logPhrase: '片刻' };
  }
  // beat === none
  if (MARKET_OPENING_KEYWORDS.some((k) => t.includes(k))) {
    return openingResult('market', phase, shichen, days, rollFn);
  }
  if (TALK_OPENING_KEYWORDS.some((k) => t.includes(k))) {
    return openingResult('talk', phase, shichen, days, rollFn);
  }
  return shichenResult(phase, shichen, days, 1, 'none', '一时辰');
}
