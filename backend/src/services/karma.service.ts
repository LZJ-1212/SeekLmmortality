/**
 * 功德业力法则（Service 层，纯函数，不依赖数据库）。
 * 设定核心：杀人夺宝、屠戮凡人积攒业力；救死扶伤积攒功德。捷径往往伴随代价——
 * 业力绝不是一个只增不减、毫无意义的摆设数字，业力过高必须真实招致「天罚」，
 * 且这个"代价"必须由后端硬性掷骰判定，绝不能只是 AI 嘴上说说的叙事装饰。
 */

import { clampResource, applyCultivationDelta } from './playerState.service';

/** 单次行动里，AI 给出的功德/业力增量允许的最大幅度，防止 AI 一次性给出离谱的数值 */
export const MAX_MERIT_DELTA_PER_ACTION = 20;
export const MAX_KARMA_DELTA_PER_ACTION = 20;

function clampDelta(delta: number, max: number): number {
  return Math.max(-max, Math.min(max, delta));
}

/** 防作弊夹紧：约束单次行动的功德/业力增量幅度 */
export function clampMeritDelta(delta: number): number {
  return clampDelta(delta, MAX_MERIT_DELTA_PER_ACTION);
}
export function clampKarmaDelta(delta: number): number {
  return clampDelta(delta, MAX_KARMA_DELTA_PER_ACTION);
}

export type KarmaRetributionTier = '小天罚' | '中天罚' | '大天罚' | '灭顶天罚';

interface KarmaTierConfig {
  tier: KarmaRetributionTier;
  minEffectiveKarma: number;
  /** 每次行动触发这一等级天罚的概率 */
  triggerChance: number;
  /** 触发后造成的气血伤害，按气血上限的百分比计算 */
  hpDamagePercent: number;
  /** 触发后造成的修为损失，按当前修为的百分比计算 */
  cultivationLossPercent: number;
  /** 触发天罚后，是否还有额外概率直接被灭顶（陨落） */
  fatalChance: number;
}

/**
 * 业力天罚等级表：业力（扣除功德抵消后的"净业力"）越高，天罚等级越高——
 * 触发概率更高、伤害更烈，达到「灭顶天罚」等级时甚至有直接陨落的风险。
 * 功德可以部分抵消业力（每 2 点功德抵 1 点业力），呼应"救死扶伤积攒功德"能减轻因果反噬的设定。
 */
const KARMA_TIERS: KarmaTierConfig[] = [
  { tier: '灭顶天罚', minEffectiveKarma: 800, triggerChance: 0.2, hpDamagePercent: 0.6, cultivationLossPercent: 0.2, fatalChance: 0.25 },
  { tier: '大天罚', minEffectiveKarma: 400, triggerChance: 0.15, hpDamagePercent: 0.4, cultivationLossPercent: 0.15, fatalChance: 0 },
  { tier: '中天罚', minEffectiveKarma: 150, triggerChance: 0.08, hpDamagePercent: 0.25, cultivationLossPercent: 0.08, fatalChance: 0 },
  { tier: '小天罚', minEffectiveKarma: 50, triggerChance: 0.03, hpDamagePercent: 0.12, cultivationLossPercent: 0, fatalChance: 0 },
];

const MERIT_OFFSET_RATIO = 0.5; // 每 1 点功德抵消 0.5 点业力

export interface KarmaRetributionInput {
  karma: number;
  merit: number;
  hp: number;
  maxHp: number;
  cultivation: number;
}

/** 可注入的随机数生成器集合，便于单元测试确定性覆盖是否触发、是否致命两个分支 */
export interface KarmaRetributionRolls {
  /** 决定本次是否触发天罚的判定骰 */
  triggerRoll?: () => number;
  /** 天罚触发且处于「灭顶天罚」等级时，决定是否直接陨落的判定骰 */
  fatalRoll?: () => number;
}

export interface KarmaRetributionResult {
  triggered: boolean;
  fatal: boolean;
  tier: KarmaRetributionTier | null;
  forcedOutcomeText: string;
  patch: { hp: number; cultivation: number };
}

/**
 * 业力天罚的确定性结算：是否触发、伤害多少、是否致命，全部由后端硬计算，
 * AI 不参与任何数值决策，只负责把结果转化为剧情文字。
 */
export function resolveKarmaRetribution(
  input: KarmaRetributionInput,
  rolls: KarmaRetributionRolls = {},
): KarmaRetributionResult {
  const triggerRoll = rolls.triggerRoll ?? Math.random;
  const fatalRoll = rolls.fatalRoll ?? Math.random;

  const unchangedResult: KarmaRetributionResult = {
    triggered: false,
    fatal: false,
    tier: null,
    forcedOutcomeText: '',
    patch: { hp: input.hp, cultivation: input.cultivation },
  };

  const effectiveKarma = Math.max(0, input.karma - input.merit * MERIT_OFFSET_RATIO);
  const config = KARMA_TIERS.find((t) => effectiveKarma >= t.minEffectiveKarma);
  if (!config) return unchangedResult;

  if (triggerRoll() > config.triggerChance) return unchangedResult;

  if (config.fatalChance > 0 && fatalRoll() <= config.fatalChance) {
    return {
      triggered: true,
      fatal: true,
      tier: config.tier,
      forcedOutcomeText: `玩家业力深重、恶贯满盈，招致${config.tier}！九天之上骤然雷云翻涌，因果反噬彻底降临，玩家当场被天罚轰灭，恶有恶报，无从幸免。`,
      patch: { hp: 0, cultivation: input.cultivation },
    };
  }

  const hpDamage = Math.round(input.maxHp * config.hpDamagePercent);
  const cultivationLoss = Math.round(input.cultivation * config.cultivationLossPercent);

  return {
    triggered: true,
    fatal: false,
    tier: config.tier,
    forcedOutcomeText: cultivationLoss > 0
      ? `玩家业力深重，招致${config.tier}！平地忽有雷云聚集，因果反噬降临，气血受创（-${hpDamage}），修为亦随之倒退（-${cultivationLoss}）。`
      : `玩家业力渐重，招致${config.tier}！冥冥中似有恶意窥伺，一股无形反噬袭来，气血受创（-${hpDamage}）。`,
    patch: {
      hp: clampResource(input.hp, -hpDamage, input.maxHp),
      cultivation: applyCultivationDelta(input.cultivation, -cultivationLoss),
    },
  };
}
