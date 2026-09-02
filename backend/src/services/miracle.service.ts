/**
 * 宣称奇迹封闭骰（S36 层 3 / 路线图 A5）。
 *
 * 玩家用自然语言「宣布」一件本不该由他决定的好运（捡神器反杀、秒杀对方）时，
 * 命中封闭意图表才掷一颗仙缘骰，成功/失败都写进 forcedOutcome，AI 只准描写。
 *
 * 铁律（详见 docs/plausibility.md 第 3 节）：
 *   - 默认不掷：只有 detectMiracleClaim 命中封闭子串才跑本骰子。
 *   - 不用模型分类、不用正则，只做明文子串匹配，可单测。
 *   - A5 成功也不发物品、不改伤害数字；胜负仍由战斗公式（境界压制）决定。
 *   - 差两大境秒杀是铁律，气运再好也改不了。本函数不看敌境，秒杀交给 combat.service。
 */

// ==================== 封闭意图表 ====================

export type MiracleClaimId = 'miracle_instant_kill' | 'miracle_loot' | 'miracle_reversal';

export interface MiracleClaim {
  id: MiracleClaimId;
}

/** 优先级从高到低：先处理最狂的宣称（秒杀 > 捡神器 > 反杀） */
const MIRACLE_CLAIM_TABLE: ReadonlyArray<{ id: MiracleClaimId; keywords: readonly string[] }> = [
  {
    id: 'miracle_instant_kill',
    keywords: ['秒杀对方', '一招毙命', '直接打死他'],
  },
  {
    id: 'miracle_loot',
    keywords: ['绝世武器', '神兵', '神器', '天降法宝', '捡到剑', '捡到刀', '捡到枪'],
  },
  {
    id: 'miracle_reversal',
    keywords: ['反杀', '绝地逢生', '以弱胜强', '逆转战局'],
  },
];

/**
 * 命中封闭意图表则返回该意图，否则返回 null。
 * 只做明文子串匹配；禁止正则、禁止模型分类。词表全为中文，无大小写问题。
 */
export function detectMiracleClaim(actionText: string): MiracleClaim | null {
  const t = actionText ?? '';
  if (!t) return null;
  for (const row of MIRACLE_CLAIM_TABLE) {
    if (row.keywords.some((k) => t.includes(k))) {
      return { id: row.id };
    }
  }
  return null;
}

// ==================== 仙缘奇迹骰 ====================

const FORTUNE_BASELINE = 10;
export const BASE_MIRACLE_CHANCE_PERCENT = 3;
const FORTUNE_MIRACLE_COEFFICIENT = 1.2;
export const MIN_MIRACLE_CHANCE_PERCENT = 1;
export const MAX_MIRACLE_CHANCE_PERCENT = 25;

/** 依据仙缘换算奇迹骰触发概率（0~100），与 docs/plausibility.md 3.3 一致 */
export function calculateMiracleChance(fortune: number): number {
  const chance = BASE_MIRACLE_CHANCE_PERCENT + (fortune - FORTUNE_BASELINE) * FORTUNE_MIRACLE_COEFFICIENT;
  return Math.min(MAX_MIRACLE_CHANCE_PERCENT, Math.max(MIN_MIRACLE_CHANCE_PERCENT, chance));
}

export interface MiracleRoll {
  claimId: MiracleClaimId;
  /** 1~100 掷骰结果，供日志/调试展示 */
  roll: number;
  chancePercent: number;
  triggered: boolean;
  forcedOutcomeText: string;
}

/**
 * 仙缘奇迹骰：1d100 命中即「气运微澜」，未命中即「妄念落空」。
 * A5 无论成败都不发物品、不改伤害，只把结果写进 forcedOutcome 供 AI 描写。
 */
export function rollMiracle(
  fortune: number,
  claim: MiracleClaim,
  rollFn: () => number = Math.random,
): MiracleRoll {
  const chancePercent = calculateMiracleChance(fortune);
  const roll = Math.floor(rollFn() * 100) + 1; // 1d100，范围 1~100
  const triggered = roll <= chancePercent;

  const successText = `掷骰仙缘（1d100=${roll} ≤ ${Math.round(chancePercent)}）：气运微澜，一线生机若隐若现。但胜负仍以境界压制为准，天道绝不因此改判战果、发放神兵或改动任何数值，你的 hp_delta / item_changes 里不得出现因此带来的额外收益。`;
  const failLootText = `掷骰仙缘（1d100=${roll} > ${Math.round(chancePercent)}）：妄念落空，你翻遍周遭，触手不过是断刃顽石，并无神兵天降，也不会凭空获得任何物品。`;
  const failText = `掷骰仙缘（1d100=${roll} > ${Math.round(chancePercent)}）：妄念落空，天地不认这桩强求的因果，你必须如实描写这徒劳的挣扎，不得让这一击改变战局。`;

  return {
    claimId: claim.id,
    roll,
    chancePercent,
    triggered,
    forcedOutcomeText: triggered ? successText : claim.id === 'miracle_loot' ? failLootText : failText,
  };
}
