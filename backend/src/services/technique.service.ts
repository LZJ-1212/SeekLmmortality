/**
 * 未习术法：S20 招式库未落地前，凡声称「法术/神通」一律落空，只准肉身或已有兵器应对。
 * 已知招式名（以后功法槽）命中则可过；空表 = 什么术都不会。
 */

const SPELL_MARKERS = ['法术', '术法', '神通', '法诀', '秘术', '道术', '禁术'];

export function detectSpellClaim(actionText: string): boolean {
  const t = (actionText ?? '').replace(/\s+/g, '');
  if (!t) return false;
  if (SPELL_MARKERS.some((m) => t.includes(m))) return true;
  if (/[金木水火土雷冰风]系/.test(t) && (t.includes('催动') || t.includes('施展') || t.includes('轰击') || t.includes('缠绕'))) {
    return true;
  }
  return false;
}

/**
 * @param knownTechniqueNames 已学会的招式/功法名；S20 前传空数组
 * @returns 命中未习宣称时的 forcedOutcome；否则 null
 */
export function unlearnedSpellForcedOutcome(
  actionText: string,
  knownTechniqueNames: readonly string[] = [],
): string | null {
  if (!detectSpellClaim(actionText)) return null;
  const t = actionText.replace(/\s+/g, '');
  const known = knownTechniqueNames.filter(Boolean);
  if (known.some((name) => t.includes(name.replace(/\s+/g, '')))) return null;
  return '玩家声称催动术法，然并未修习对应功法或神通，灵力空转、法象不显。叙事中此术必须落空，只可描写拳脚、兵刃或狼狈应对，绝不可让木系缠绕、火系轰杀等未习之术真正生效。';
}
