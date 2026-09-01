/**
 * 逆天改命体系（Service 层，纯函数，不依赖数据库）。
 * 设定核心：突破大境界后，从多个强力被动中做出抉择（类似 Rogue-like 的天赋三选一）。
 * 技术落地：
 *   1. 雷劫突破成功时，后端直接生成三个天赋选项。
 *   2. 玩家选择后，天赋 id 写入 players.talents 的 JSON 数组；
 *      战斗/修炼计算时读取这些天赋，聚合出全局乘数。
 */

export interface TalentEffects {
  /** 战斗中己方造成伤害的倍率加成（如 1.2 表示 +20%） */
  combatDamageMultiplier?: number;
  /** 战斗中己方承受伤害的倍率（如 0.85 表示 -15%） */
  combatDefenseMultiplier?: number;
  /** 修炼速度的倍率加成（作用于闭关修炼收益公式） */
  cultivationSpeedMultiplier?: number;
}

export interface Talent {
  id: string;
  name: string;
  description: string;
  effects: TalentEffects;
}

/** 大境界突破天赋池：每一条都是能被战斗/修炼计算真实读取的全局乘数，绝非纯叙事装饰 */
export const TALENT_POOL: Talent[] = [
  { id: 'sword_heart_clarity', name: '剑心通明', description: '心境如镜，剑意通明，战斗中造成的伤害提升 20%。', effects: { combatDamageMultiplier: 1.2 } },
  { id: 'iron_body', name: '金刚不坏', description: '肉身坚如金刚，战斗中受到的伤害降低 15%。', effects: { combatDefenseMultiplier: 0.85 } },
  { id: 'dao_insight', name: '大道感悟', description: '对天地大道的感悟更深，修炼速度提升 25%。', effects: { cultivationSpeedMultiplier: 1.25 } },
  { id: 'berserker_will', name: '拼命之心', description: '身陷绝境愈战愈勇，战斗伤害提升 30%，但自身也更容易受创（受到伤害 +10%）。', effects: { combatDamageMultiplier: 1.3, combatDefenseMultiplier: 1.1 } },
  { id: 'thunder_step', name: '雷影遁形', description: '身法快若惊雷，战斗中受到的伤害降低 25%。', effects: { combatDefenseMultiplier: 0.75 } },
  { id: 'boundless_dao_heart', name: '道心无疆', description: '道心愈发坚韧，修炼速度提升 15%，战斗伤害提升 10%。', effects: { cultivationSpeedMultiplier: 1.15, combatDamageMultiplier: 1.1 } },
];

export function getTalentById(id: string): Talent | undefined {
  return TALENT_POOL.find((t) => t.id === id);
}

/**
 * 从天赋池中随机抽取 count 个玩家尚未拥有的天赋，供突破大境界后三选一。
 * 可注入的随机数生成器每次调用返回一个 0~1 的值，用于确定性单元测试。
 */
export function pickRandomTalentChoices(ownedTalentIds: string[], count: number = 3, rollFn: () => number = Math.random): Talent[] {
  const available = TALENT_POOL.filter((t) => !ownedTalentIds.includes(t.id));
  const remaining = [...available];
  const picks: Talent[] = [];
  const pickCount = Math.min(count, remaining.length);

  for (let i = 0; i < pickCount; i++) {
    const index = Math.floor(rollFn() * remaining.length);
    const safeIndex = Math.min(remaining.length - 1, Math.max(0, index));
    picks.push(remaining.splice(safeIndex, 1)[0]!);
  }
  return picks;
}

/** 聚合玩家已拥有的全部天赋里，某个乘数类效果的最终倍率（多个天赋之间是相乘关系） */
function aggregateMultiplier(talents: Talent[], pick: (t: Talent) => number | undefined): number {
  return talents.reduce((acc, t) => acc * (pick(t) ?? 1), 1);
}

export function getCombatDamageMultiplier(talents: Talent[]): number {
  return aggregateMultiplier(talents, (t) => t.effects.combatDamageMultiplier);
}

export function getCombatDefenseMultiplier(talents: Talent[]): number {
  return aggregateMultiplier(talents, (t) => t.effects.combatDefenseMultiplier);
}

export function getCultivationSpeedMultiplier(talents: Talent[]): number {
  return aggregateMultiplier(talents, (t) => t.effects.cultivationSpeedMultiplier);
}

// ==================== players.talents JSON 字段的读写 ====================

export interface TalentsData {
  origin?: string;
  daoPursuit?: string;
  constitution?: string;
  innateTalents?: string[];
  /** 大境界突破后选择的天赋 id 数组 */
  realmTalents?: string[];
}

/** 安全解析 players.talents 字段；任何格式异常都退化为空对象，绝不抛出异常 */
export function parseTalentsData(talentsJson: unknown): TalentsData {
  try {
    const data = typeof talentsJson === 'string' ? JSON.parse(talentsJson) : talentsJson;
    return data && typeof data === 'object' ? (data as TalentsData) : {};
  } catch {
    return {};
  }
}

export function getRealmTalentIds(talentsJson: unknown): string[] {
  const data = parseTalentsData(talentsJson);
  return Array.isArray(data.realmTalents) ? data.realmTalents : [];
}

/** 把已拥有的天赋 id 数组还原成完整的天赋对象列表（未知 id 会被安全过滤掉） */
export function getOwnedTalents(talentsJson: unknown): Talent[] {
  return getRealmTalentIds(talentsJson)
    .map((id) => getTalentById(id))
    .filter((t): t is Talent => !!t);
}

/**
 * 把新选择的天赋 id 写入 talents JSON，返回更新后的 JSON 字符串。
 * @throws Error 当天赋 id 不存在于天赋池，或玩家已经拥有该天赋时
 */
export function addRealmTalent(talentsJson: unknown, talentId: string): string {
  if (!getTalentById(talentId)) {
    throw new Error(`未知的天赋 id："${talentId}"`);
  }
  const data = parseTalentsData(talentsJson);
  const existing = Array.isArray(data.realmTalents) ? data.realmTalents : [];
  if (existing.includes(talentId)) {
    throw new Error('该天赋已经拥有，不能重复选择');
  }
  const updated: TalentsData = { ...data, realmTalents: [...existing, talentId] };
  return JSON.stringify(updated);
}
