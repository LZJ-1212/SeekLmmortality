/** 与 backend exploration.service EXPLORATION_REGIONS 对齐。x/y 为示意图百分比坐标。 */
export const CATALOG_REGIONS: Array<{
  name: string;
  short: string;
  hint: string;
  x: number;
  y: number;
}> = [
  { name: '中州天阙', short: '天阙', hint: '大能云集，低境去之即死', x: 50, y: 18 },
  { name: '天机峰', short: '天机峰', hint: '宗门圣地', x: 28, y: 38 },
  { name: '青岳·天机坊市', short: '青岳坊市', hint: '凡俗坊市，炼气可安居', x: 48, y: 58 },
  { name: '黑风岭', short: '黑风岭', hint: '妖兽出没，炼气可涉足', x: 72, y: 48 },
  { name: '幽冥谷', short: '幽冥谷', hint: '阴气秘境，宜筑基以上', x: 68, y: 78 },
];

/** 尚未单独存技艺级：未拜师、未炼成前一律未习，禁止显示成 1 级出师。 */
export function listCraftRanks(): Array<{ title: string; learned: boolean; level: number }> {
  return [
    { title: '丹师', learned: false, level: 0 },
    { title: '器师', learned: false, level: 0 },
    { title: '阵师', learned: false, level: 0 },
    { title: '灵植师', learned: false, level: 0 },
  ];
}

export function formatHeavenCalendar(year?: number | null, season?: string | null): string {
  const y = typeof year === 'number' && Number.isFinite(year) ? year : 387;
  const s = season && season.trim() ? season.trim() : '春';
  return `天玄历 ${y}年·${s}`;
}
