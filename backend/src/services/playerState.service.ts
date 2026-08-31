/**
 * 核心状态机（Service 层，纯函数，不依赖数据库）。
 * 负责：气血/灵力/修为的流逝与恢复、时间流逝的月份累加、寿元耗尽判定、
 * 以及境界突破的确定性数值结算（不依赖 AI 自行计算关键惩罚/奖励数值）。
 */

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

export type DeathReason = 'hp_exhausted' | 'lifespan_exhausted' | null;

/** 最基础的死亡判定：气血耗尽或寿元耗尽，二者任一成立即判定死亡 */
export function getDeathReason(hp: number, age: number, maxLifespan: number): DeathReason {
  if (hp <= 0) return 'hp_exhausted';
  if (isLifespanExhausted(age, maxLifespan)) return 'lifespan_exhausted';
  return null;
}

export function isDead(hp: number, age: number, maxLifespan: number): boolean {
  return getDeathReason(hp, age, maxLifespan) !== null;
}

/** 境界突破法则表的类型定义 */
export interface RealmLaw {
  next: string;
  reqCultivation: number;
  isMajor: boolean;
  baseSuccess?: number;
  tribulationDamage?: number;
  newLifespan?: number;
}

/** 天地法则：境界突破阈值与雷劫数据（未来补全金丹、元婴等境界时在这里追加即可） */
export const REALM_LAWS: Record<string, RealmLaw> = {
  '炼气·初期': { next: '炼气·中期', reqCultivation: 100, isMajor: false },
  '炼气·中期': { next: '炼气·后期', reqCultivation: 200, isMajor: false },
  '炼气·后期': { next: '炼气·圆满', reqCultivation: 400, isMajor: false },
  '炼气·圆满': {
    next: '筑基·初期',
    reqCultivation: 800,
    isMajor: true,
    baseSuccess: 0.7, // 基础成功率 70%
    tribulationDamage: 60, // 雷劫基础伤害
    newLifespan: 200, // 筑基期寿元上限
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
}

/** 突破结算结果：patch 里是“最终确定值”而非增量，玩家属性直接被覆盖为这些值 */
export interface BreakthroughAttemptResult {
  success: boolean;
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

/**
 * 境界突破的确定性结算：所有气血/修为/境界/寿元变化全部由后端硬计算得出，
 * 绝不依赖 AI 自行在 JSON 里填写对应的 hp_delta / cultivation_delta。
 * 这样即便 AI 的叙事描述有偏差，实际数值结算依然 100% 准确、不可被 LLM 篡改。
 *
 * @param rollFn 可注入的随机数生成器（默认 Math.random），便于单元测试覆盖成功/失败分支
 */
export function resolveBreakthroughAttempt(
  input: BreakthroughAttemptInput,
  realmLaws: Record<string, RealmLaw>,
  rollFn: () => number = Math.random,
): BreakthroughAttemptResult {
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
      forcedOutcomeText: '玩家试图突破，但前方境界未明，无法突破。扣除少量灵力。',
      patch: unchangedPatch,
    };
  }

  if (input.cultivation < law.reqCultivation) {
    return {
      success: false,
      forcedOutcomeText: `玩家试图突破，但修为不足（需要${law.reqCultivation}）。强行冲关导致灵力反噬，受轻伤（气血-10），突破失败。`,
      patch: { ...unchangedPatch, hp: clampResource(input.hp, -10, input.maxHp) },
    };
  }

  if (!law.isMajor) {
    const [nextMajor, nextMinor] = law.next.split('·');
    return {
      success: true,
      forcedOutcomeText: `玩家水到渠成，突破至小境界【${law.next}】。修为清零重修。`,
      patch: {
        ...unchangedPatch,
        cultivation: 0,
        realmMajor: nextMajor ?? input.realmMajor,
        realmMinor: nextMinor ?? input.realmMinor,
      },
    };
  }

  // 大境界突破：需要掷骰子判定，基础成功率 + 道心加成
  const roll = rollFn();
  const successRate = (law.baseSuccess ?? 0.5) + input.daoHeart * 0.01;

  if (roll <= successRate) {
    const [nextMajor, nextMinor] = law.next.split('·');
    const newMaxHp = input.maxHp + 100;
    return {
      success: true,
      forcedOutcomeText: `玩家成功抵御雷劫，突破至【${law.next}】！气血上限增加，伤势完全恢复，寿元大涨。`,
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

  const damage = law.tribulationDamage ?? 0;
  return {
    success: false,
    forcedOutcomeText: `玩家突破失败，被雷劫劈中！受重伤（气血-${damage}），修为大跌（修为-100）。`,
    patch: {
      ...unchangedPatch,
      hp: clampResource(input.hp, -damage, input.maxHp),
      cultivation: applyCultivationDelta(input.cultivation, -100),
    },
  };
}
