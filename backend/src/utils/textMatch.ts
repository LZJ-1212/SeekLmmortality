/**
 * 文本匹配工具（纯函数，无副作用）。
 * 供坊市物品匹配、人际关系 NPC 姓名匹配等多个场景复用：
 * 从若干候选名称里，挑出真正出现在玩家行动文本中的那一个。
 */

/**
 * 优先选最长的匹配项，避免短名字子串误命中长名字（例如候选里有"丹"和"聚气丹"，
 * 提到"聚气丹"时应该精确匹配到"聚气丹"而不是被"丹"抢先命中）。
 */
export function findLongestMatchingName(text: string, candidates: string[]): string | null {
  if (!text) return null;
  const matches = candidates.filter((name) => name && text.includes(name));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.length - a.length)[0]!;
}
