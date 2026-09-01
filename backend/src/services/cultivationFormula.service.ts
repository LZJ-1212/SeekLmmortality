/**
 * 修炼速度公式（Service 层，纯函数，不依赖数据库）。
 * 落地游戏设计白皮书里的核心公式：
 *   月修为增长 = 10 × 资质系数 × 灵根系数 × 功法系数 × 灵气系数 × 心境系数
 * 目前仅用于闭关修炼场景（洞府的灵气浓度直接决定闭关收益倍率），
 * 日常行动的修为增长仍由 AI 叙事驱动（个位数的小幅波动，无需上升到公式层面）。
 */

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** 灵根品质系数：品质越高，天生修炼效率越高 */
const ROOT_QUALITY_COEFFICIENTS: Record<string, number> = {
  伪灵根: 0.6,
  杂灵根: 0.8,
  真灵根: 1.0,
  地灵根: 1.2,
  天灵根: 1.5,
};
const DEFAULT_ROOT_QUALITY_COEFFICIENT = 1.0;

export function getRootQualityCoefficient(rootQuality: string): number {
  return ROOT_QUALITY_COEFFICIENTS[rootQuality] ?? DEFAULT_ROOT_QUALITY_COEFFICIENT;
}

/**
 * 不同地区/山川的天然灵气浓度基础值（1~100），洞府建在灵气越浓郁的地方，
 * 闭关修炼的收益就越高——这是"地区数据"在这个系统里产生的真实差异化效果。
 * 未收录的地区默认按"寻常之地"计算，不会出现异常的天灵地宝效果。
 */
export const REGION_BASE_SPIRITUAL_DENSITY: Record<string, number> = {
  '青岳·天机坊市': 10, // 凡俗坊市，人多而灵气稀薄
  '黑风岭': 15, // 妖兽出没之地，灵气略浓
  '幽冥谷': 25, // 阴气与灵气交织的秘境
  '天机峰': 40, // 宗门圣地，灵脉汇聚
};
const DEFAULT_REGION_SPIRITUAL_DENSITY = 10;

export function getRegionBaseSpiritualDensity(locationName: string): number {
  return REGION_BASE_SPIRITUAL_DENSITY[locationName] ?? DEFAULT_REGION_SPIRITUAL_DENSITY;
}

export interface CultivationSpeedInput {
  /** 资质（六维之一），基准值 10 对应系数 1.0 */
  aptitude: number;
  /** 灵根品质文本，如 "天灵根"、"地灵根" */
  rootQuality: string;
  /** 道心（六维之一），基准值 10 对应系数 1.0 */
  daoHeart: number;
  /** 洞府当前的灵气浓度（1~100），基准值 10 对应系数 1.0 */
  caveSpiritualDensity: number;
  /** 功法系数：暂无功法系统时的占位值，未来接入具体功法后在此替换为真实系数 */
  techniqueCoefficient?: number;
  /** 逆天改命天赋（如"大道感悟"）聚合出的修炼速度全局乘数，基准值 1.0 表示没有相关天赋 */
  talentCoefficient?: number;
}

/**
 * 月修为增长 = 10 × 资质系数 × 灵根系数 × 功法系数 × 灵气系数 × 心境系数 × 天赋系数。
 * 六个系数全部以"基准值 → 系数 1.0"为标定点，保证新手角色的收益落在合理区间。
 */
export function calculateMonthlyCultivationGain(input: CultivationSpeedInput): number {
  const aptitudeCoefficient = Math.max(0, input.aptitude) / 10;
  const rootCoefficient = getRootQualityCoefficient(input.rootQuality);
  const techniqueCoefficient = input.techniqueCoefficient ?? 1.0;
  const spiritualDensityCoefficient = Math.max(0, input.caveSpiritualDensity) / 10;
  const daoHeartCoefficient = 0.5 + Math.max(0, input.daoHeart) * 0.05;
  const talentCoefficient = input.talentCoefficient ?? 1.0;

  const gain = 10 * aptitudeCoefficient * rootCoefficient * techniqueCoefficient * spiritualDensityCoefficient * daoHeartCoefficient * talentCoefficient;
  return round(gain);
}

/** 闭关修炼收益：按闭关的真实月数（已由岁月流逝系统精确解析）乘上月修为增长速率 */
export function calculateSeclusionCultivationGain(input: CultivationSpeedInput, months: number): number {
  return Math.round(calculateMonthlyCultivationGain(input) * Math.max(0, months));
}
