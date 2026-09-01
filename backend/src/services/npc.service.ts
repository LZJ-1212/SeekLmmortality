/**
 * 人际与情缘双修（Service 层，纯函数，不依赖数据库）。
 * 设定核心：全性向；NPC 拥有独立的境界与寿元；双修可得增益；
 * 昔日旧友寿元耗尽会传来传音符。
 *
 * 【全性向说明】：本系统任何地方都不会读取或校验玩家/NPC 的性别来决定关系是否成立——
 * 双修、结缘等玩法只看 affinity（好感度）与 relation_type，绝不存在任何性别限制的判断分支。
 */

/** NPC 的境界与寿元上限一一对应，规则与玩家的境界突破体系完全一致（同一套天道法则，一体两面） */
export const REALM_MAX_LIFESPAN_BY_MAJOR: Record<string, number> = {
  炼气: 100,
  筑基: 200,
  金丹: 400,
  元婴: 800,
  化神: 1500,
  炼虚: 3000,
  合体: 6000,
  大乘: 12000,
  渡劫期: 99999,
};
const DEFAULT_NPC_MAX_LIFESPAN = 100;

/** 依据 NPC 的大境界换算寿元上限；未知境界名默认按凡人寿元（100 岁）计算，不给异常长寿 */
export function getMaxLifespanForRealm(realmMajor: string): number {
  return REALM_MAX_LIFESPAN_BY_MAJOR[realmMajor] ?? DEFAULT_NPC_MAX_LIFESPAN;
}

/** NPC 当前年龄 = 世界当前年份 - NPC 出生年份（无需逐回合更新 NPC 记录，年龄永远是推算值） */
export function getNpcCurrentAge(currentWorldYear: number, npcBirthYear: number): number {
  return Math.max(0, currentWorldYear - npcBirthYear);
}

/** 寿元耗尽判定：与玩家的判定规则一致（年龄超过寿元上限即视为耗尽） */
export function isNpcLifespanExhausted(currentWorldYear: number, npcBirthYear: number, npcMaxLifespan: number): boolean {
  return getNpcCurrentAge(currentWorldYear, npcBirthYear) > npcMaxLifespan;
}

/** 依据 NPC 当前年龄换算出生年份，用于首次记录一段人际关系时落库 */
export function calculateBirthYear(currentWorldYear: number, npcCurrentAge: number): number {
  return currentWorldYear - Math.max(0, npcCurrentAge);
}

/** 单次行动里，AI 给出的好感度增量上限，防止 AI 一次性给出离谱的数值 */
export const MAX_AFFINITY_DELTA_PER_ACTION = 20;

export function clampAffinityDelta(delta: number): number {
  return Math.max(-MAX_AFFINITY_DELTA_PER_ACTION, Math.min(MAX_AFFINITY_DELTA_PER_ACTION, delta));
}

/** 好感度达到此门槛，才允许与该 NPC 双修（全性向，与性别无关，只看好感度） */
export const MIN_AFFINITY_FOR_DUAL_CULTIVATION = 60;

const DUAL_CULTIVATION_KEYWORDS = ['双修'];

/** 判定这次行动是否在尝试与某个 NPC 双修 */
export function isDualCultivationAttempt(actionText: string): boolean {
  if (!actionText) return false;
  return DUAL_CULTIVATION_KEYWORDS.some((k) => actionText.includes(k));
}

export interface DualCultivationInput {
  affinity: number;
  playerMaxHp: number;
  playerMaxMp: number;
}

export interface DualCultivationResult {
  success: boolean;
  cultivationBonus: number;
  hpRestore: number;
  mpRestore: number;
  forcedOutcomeText: string;
}

/**
 * 双修增益的确定性结算：好感度越高，双修的增益越显著；好感度不足门槛时直接判定失败，
 * 不会有任何增益（也不会有惩罚，只是这段关系还没到能双修的地步）。
 */
export function resolveDualCultivation(npcName: string, input: DualCultivationInput): DualCultivationResult {
  if (input.affinity < MIN_AFFINITY_FOR_DUAL_CULTIVATION) {
    return {
      success: false,
      cultivationBonus: 0,
      hpRestore: 0,
      mpRestore: 0,
      forcedOutcomeText: `玩家想与「${npcName}」双修，但彼此情谊尚浅（好感度不足），对方婉言拒绝，此事作罢，未产生任何增益。`,
    };
  }

  const cultivationBonus = Math.round(input.affinity * 0.5);
  const hpRestore = Math.round(input.playerMaxHp * 0.2);
  const mpRestore = Math.round(input.playerMaxMp * 0.3);

  return {
    success: true,
    cultivationBonus,
    hpRestore,
    mpRestore,
    forcedOutcomeText: `玩家与「${npcName}」两情相悦，携手双修，阴阳调和、灵力交融，修为精进 ${cultivationBonus} 点，气血与灵力也大幅恢复。`,
  };
}

/** 旧友寿元耗尽时，传音符送来的讯息文案——用于持续性地拼进 forcedOutcome */
export function buildDeceasedFriendNotice(npcName: string, relationType: string | null): string {
  const relation = relationType || '旧友';
  return `一枚传音符自远方传来，捎来噩耗：玩家的${relation}「${npcName}」寿元耗尽，已然仙逝而去。这份物是人非的怅然，需要在叙事里有所体现，但不必阻断玩家当前正在进行的行动。`;
}
