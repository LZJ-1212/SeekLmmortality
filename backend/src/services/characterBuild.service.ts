/**
 * 创角命格（Service 层，纯函数，不依赖数据库）。
 * 把玩家在创角时选择的「出身 / 道途 / 先天体质 / 先天天赋」转化为真实的数值效果，
 * 让这些命格选项不再是纯叙事装饰，而是真正影响修炼速度、战斗伤害/减伤、初始资源与六维属性。
 *
 * 落地方式分两层：
 *   1. 创角时（create-player）：把 attributeBonus / maxHpBonus / maxLifespanBonus / spiritStonesBonus
 *      一次性折算进玩家的初始六维、气血上限、寿元上限与灵石。
 *   2. 运行时（/api/action）：把 cultivation/combat 乘数实时聚合进修炼与战斗结算，
 *      这样即便是旧存档也能享受到命格加成，不需要重建角色。
 */

export const SIX_ATTRIBUTE_KEYS = ['aptitude', 'comprehension', 'divine_sense', 'speed', 'dao_heart', 'fortune'] as const;
export type SixAttributeKey = (typeof SIX_ATTRIBUTE_KEYS)[number];

/** 一整套命格效果（全部为基准中性的默认值，缺省即表示"无此加成"） */
export interface BuildEffects {
  /** 修炼速度倍率（闭关修炼收益的全局乘数，基准 1.0） */
  cultivationSpeedMultiplier: number;
  /** 战斗中己方造成伤害的倍率（基准 1.0） */
  combatDamageMultiplier: number;
  /** 战斗中己方承受伤害的倍率（基准 1.0，低于 1 表示减伤） */
  combatDefenseMultiplier: number;
  /** 初始气血上限加成（绝对值，直接加到 100 的基准上） */
  maxHpBonus: number;
  /** 初始寿元上限加成（绝对值，直接加到 100 年的基准上） */
  maxLifespanBonus: number;
  /** 初始灵石加成（绝对值） */
  spiritStonesBonus: number;
  /** 六维属性加成（创角时折算进玩家初始六维） */
  attributeBonus: Partial<Record<SixAttributeKey, number>>;
}

const EMPTY_EFFECTS: BuildEffects = {
  cultivationSpeedMultiplier: 1,
  combatDamageMultiplier: 1,
  combatDefenseMultiplier: 1,
  maxHpBonus: 0,
  maxLifespanBonus: 0,
  spiritStonesBonus: 0,
  attributeBonus: {},
};

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** 先天体质：每一种体质都给出生理/修炼层面的差异化效果 */
export const CONSTITUTIONS: Record<string, Partial<BuildEffects>> = {
  凡体: {},
  先天道体: { cultivationSpeedMultiplier: 1.2, maxLifespanBonus: 20 },
  剑灵体: { combatDamageMultiplier: 1.15 },
  九阳圣体: { maxHpBonus: 50, combatDamageMultiplier: 1.1 },
  冰魄灵体: { combatDefenseMultiplier: 0.9, attributeBonus: { divine_sense: 1 } },
  玄阴体: { cultivationSpeedMultiplier: 1.1 },
  纯阳体: { combatDamageMultiplier: 1.2 },
  混沌体: { cultivationSpeedMultiplier: 1.1, combatDamageMultiplier: 1.1 },
};

/** 先天天赋：创角时三选一挑中的天赋，给出六维或修炼/战斗层面的加成 */
export const INNATE_TALENTS: Record<string, Partial<BuildEffects>> = {
  天资聪颖: { cultivationSpeedMultiplier: 1.1 },
  过目不忘: { cultivationSpeedMultiplier: 1.05, attributeBonus: { comprehension: 2 } },
  身轻如燕: { combatDefenseMultiplier: 0.95, attributeBonus: { speed: 2 } },
  天生道心: { cultivationSpeedMultiplier: 1.1, attributeBonus: { dao_heart: 2 } },
  气运加身: { attributeBonus: { fortune: 3 } },
  百脉俱通: { cultivationSpeedMultiplier: 1.1 },
};

/** 出身：决定初始资源与初始六维的倾向 */
export const ORIGINS: Record<string, Partial<BuildEffects>> = {
  农家子: { attributeBonus: { fortune: 1 }, spiritStonesBonus: 10 },
  猎户之后: { attributeBonus: { speed: 2 } },
  商贾之家: { spiritStonesBonus: 80 },
  官宦子弟: { spiritStonesBonus: 50, attributeBonus: { comprehension: 1 } },
  将门之后: { combatDamageMultiplier: 1.1, maxHpBonus: 10 },
  没落世家: { attributeBonus: { comprehension: 2 }, spiritStonesBonus: 20 },
  市井孤儿: { attributeBonus: { fortune: 2, dao_heart: 1 } },
  书香门第: { attributeBonus: { comprehension: 3 } },
  方外遗孤: { attributeBonus: { divine_sense: 3 } },
  妖族后裔: { maxHpBonus: 30, attributeBonus: { speed: 1 } },
};

/** 道途追求：决定一个长期的人生倾向性加成 */
export const DAO_PURSUITS: Record<string, Partial<BuildEffects>> = {
  问道飞升: { cultivationSpeedMultiplier: 1.1 },
  逍遥长生: { maxLifespanBonus: 20 },
  快意恩仇: { combatDamageMultiplier: 1.1 },
  守护所爱: { combatDefenseMultiplier: 0.9 },
  问鼎天下: { cultivationSpeedMultiplier: 1.05, combatDamageMultiplier: 1.05 },
  随心所欲: { attributeBonus: { fortune: 2 } },
};

/** 玩家命格（来自 players.talents JSON 字段） */
export interface CharacterBuild {
  origin?: string;
  daoPursuit?: string;
  constitution?: string;
  innateTalents?: string[];
}

/**
 * 把出身 / 道途 / 体质 / 先天天赋四类命格的效果聚合为一套最终效果：
 * 乘数类效果（修炼/伤害/减伤）之间是相乘关系，绝对值类效果（气血/寿元/灵石/六维）是相加关系。
 * 未知的命格名称（例如 AI 或历史数据瞎写的）会被安全忽略，绝不抛出异常。
 */
export function aggregateBuildEffects(build: CharacterBuild): BuildEffects {
  const parts = [
    ORIGINS[build.origin ?? ''],
    DAO_PURSUITS[build.daoPursuit ?? ''],
    CONSTITUTIONS[build.constitution ?? ''],
    ...(Array.isArray(build.innateTalents) ? build.innateTalents : []).map((t) => INNATE_TALENTS[t]),
  ].filter((p): p is Partial<BuildEffects> => !!p);

  const result: BuildEffects = { ...EMPTY_EFFECTS, attributeBonus: {} };
  for (const part of parts) {
    if (part.cultivationSpeedMultiplier) result.cultivationSpeedMultiplier *= part.cultivationSpeedMultiplier;
    if (part.combatDamageMultiplier) result.combatDamageMultiplier *= part.combatDamageMultiplier;
    if (part.combatDefenseMultiplier) result.combatDefenseMultiplier *= part.combatDefenseMultiplier;
    if (part.maxHpBonus) result.maxHpBonus += part.maxHpBonus;
    if (part.maxLifespanBonus) result.maxLifespanBonus += part.maxLifespanBonus;
    if (part.spiritStonesBonus) result.spiritStonesBonus += part.spiritStonesBonus;
    if (part.attributeBonus) {
      for (const [key, value] of Object.entries(part.attributeBonus)) {
        const k = key as SixAttributeKey;
        result.attributeBonus[k] = (result.attributeBonus[k] ?? 0) + (value ?? 0);
      }
    }
  }

  return {
    ...result,
    cultivationSpeedMultiplier: round(result.cultivationSpeedMultiplier),
    combatDamageMultiplier: round(result.combatDamageMultiplier),
    combatDefenseMultiplier: round(result.combatDefenseMultiplier),
  };
}

/** 命格对修炼速度的全局乘数（供闭关修炼收益公式叠加使用） */
export function getBuildCultivationSpeedMultiplier(build: CharacterBuild): number {
  return aggregateBuildEffects(build).cultivationSpeedMultiplier;
}

/** 命格对战斗伤害的全局乘数 */
export function getBuildCombatDamageMultiplier(build: CharacterBuild): number {
  return aggregateBuildEffects(build).combatDamageMultiplier;
}

/** 命格对战斗减伤的全局乘数 */
export function getBuildCombatDefenseMultiplier(build: CharacterBuild): number {
  return aggregateBuildEffects(build).combatDefenseMultiplier;
}

/**
 * 遁速（六维之一）对战斗减伤的贡献——身法越快，越能在交手中闪避、卸力，从而少受伤。
 * 以 10 为基准（乘数 1.0），每高/低 1 点遁速，受伤倍率增减 2%，最终夹紧在 [0.7, 1.3] 之间，
 * 既保证高遁速有真实收益，也避免数值被极端属性带崩。
 */
export function getSpeedDodgeMultiplier(speed: number): number {
  const s = Number.isFinite(speed) ? speed : 10;
  const multiplier = 1 + (10 - s) * 0.02;
  return round(Math.min(1.3, Math.max(0.7, multiplier)));
}
