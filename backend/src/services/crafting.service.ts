/**
 * 修仙百艺（Service 层，纯函数，不依赖数据库）。
 * 覆盖炼丹、炼器、阵法、灵植四大技艺：玩家提到"炼制/打造/布下/种植"某个具体物品时，
 * 是否成功、耗时多久全部由后端硬性掷骰决定，不采信 AI 自己编造的成败与产出。
 *
 * 六维差异化：炼丹/灵植偏向"悟性"（理解药理/生长之道），炼器/阵法偏向"神识"（精密掌控灵力走向）——
 * 这让此前完全没有被任何系统用到的"悟性"“神识”两维终于有了真实的机制意义。
 */

export type CraftDiscipline = '炼丹' | '炼器' | '阵法' | '灵植';
export type CraftPrimaryStat = 'comprehension' | 'divine_sense';

export interface CraftRecipe {
  discipline: CraftDiscipline;
  /** 产出的物品名称（若命中物品字典则产出正规物品，否则自动退化为自定义物品） */
  resultName: string;
  /** 基础成功率（0~1），实际成功率还会叠加对应六维属性的加成 */
  baseSuccessRate: number;
  /** 炼制耗时（月），由后端精确锁定，不采信 AI 的猜测 */
  craftMonths: number;
  /** 决定加成的主属性：炼丹/灵植看悟性，炼器/阵法看神识 */
  primaryStat: CraftPrimaryStat;
}

/** 修仙百艺的基础配方表，未来可以继续扩充更高阶的配方 */
export const CRAFT_RECIPES: CraftRecipe[] = [
  { discipline: '炼丹', resultName: '聚气丹', baseSuccessRate: 0.7, craftMonths: 0.2, primaryStat: 'comprehension' },
  { discipline: '炼丹', resultName: '回春散', baseSuccessRate: 0.75, craftMonths: 0.2, primaryStat: 'comprehension' },
  { discipline: '炼丹', resultName: '灵力露', baseSuccessRate: 0.75, craftMonths: 0.2, primaryStat: 'comprehension' },
  { discipline: '炼丹', resultName: '辟谷丹', baseSuccessRate: 0.8, craftMonths: 0.2, primaryStat: 'comprehension' },
  { discipline: '炼丹', resultName: '筑基丹', baseSuccessRate: 0.3, craftMonths: 1, primaryStat: 'comprehension' },
  { discipline: '炼器', resultName: '玄铁剑', baseSuccessRate: 0.5, craftMonths: 1, primaryStat: 'divine_sense' },
  { discipline: '炼器', resultName: '青云袍', baseSuccessRate: 0.6, craftMonths: 0.5, primaryStat: 'divine_sense' },
  { discipline: '阵法', resultName: '传音符', baseSuccessRate: 0.65, craftMonths: 0.2, primaryStat: 'divine_sense' },
  { discipline: '灵植', resultName: '灵草', baseSuccessRate: 0.8, craftMonths: 0.3, primaryStat: 'comprehension' },
];

const DISCIPLINE_KEYWORDS: Record<CraftDiscipline, string[]> = {
  炼丹: ['炼丹', '炼制丹药', '炼药'],
  炼器: ['炼器', '打造', '铸造'],
  阵法: ['阵法', '布阵', '设阵'],
  灵植: ['灵植', '种植', '培育'],
};

/**
 * 从玩家行动文本里识别"是否在尝试炼制某个具体配方"：必须同时命中技艺关键词
 * 和某个已知配方的物品名称，避免把"炼丹炉坏了"这种无关描述误判为炼制行为。
 */
export function detectCraftingAttempt(actionText: string): CraftRecipe | null {
  if (!actionText) return null;
  for (const recipe of CRAFT_RECIPES) {
    const keywords = DISCIPLINE_KEYWORDS[recipe.discipline];
    const mentionsDiscipline = keywords.some((k) => actionText.includes(k));
    const mentionsResult = actionText.includes(recipe.resultName);
    if (mentionsDiscipline && mentionsResult) return recipe;
  }
  return null;
}

export interface CraftingAttemptInput {
  recipe: CraftRecipe;
  comprehension: number;
  divineSense: number;
}

export interface CraftingResult {
  success: boolean;
  recipe: CraftRecipe;
  forcedOutcomeText: string;
}

const STAT_BONUS_PER_POINT = 0.02;
const MIN_SUCCESS_RATE = 0.05;
const MAX_SUCCESS_RATE = 0.95;

/**
 * 炼制的确定性结算：是否成功由后端掷骰决定，主属性（悟性/神识）每点提供小幅成功率加成。
 */
export function resolveCrafting(input: CraftingAttemptInput, rollFn: () => number = Math.random): CraftingResult {
  const { recipe } = input;
  const statValue = recipe.primaryStat === 'comprehension' ? input.comprehension : input.divineSense;
  const successRate = Math.min(
    MAX_SUCCESS_RATE,
    Math.max(MIN_SUCCESS_RATE, recipe.baseSuccessRate + Math.max(0, statValue) * STAT_BONUS_PER_POINT),
  );

  const success = rollFn() <= successRate;
  const statLabel = recipe.primaryStat === 'comprehension' ? '悟性' : '神识';

  return {
    success,
    recipe,
    forcedOutcomeText: success
      ? `玩家凝神${recipe.discipline}，以${statLabel}贯注心神，历经${recipe.craftMonths < 1 ? Math.round(recipe.craftMonths * 30) + '天' : recipe.craftMonths + '个月'}的功夫，成功炼成【${recipe.resultName}】。`
      : `玩家尝试${recipe.discipline}【${recipe.resultName}】，但火候/灵力掌控终究差了一线，此次炼制以失败告终，材料与心血付诸东流，未能产出任何成品。`,
  };
}
