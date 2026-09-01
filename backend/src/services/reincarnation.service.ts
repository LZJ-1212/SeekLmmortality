/**
 * 轮回与读档机制（Service 层，纯函数，不依赖数据库）。
 * 设定核心：死亡并非终结。高境界修士死后，可以化为一丝残魂投入轮回，
 * 下一世重开时可能触发前世因果（继承部分六维属性，或挖出前世埋藏的法宝）。
 *
 * saves.in_samsara_pool 复用作"轮回标记"：
 *   - 高境界角色陨落时置为 true（进入轮回池，等待被下一世抽中）；
 *   - 一旦被下一世抽中并授予前世遗泽后，置回 false（已经转世，不能重复被抽中）。
 */

import { REALM_RANKS } from './combat.service';

/** 只有筑基及以上的修士，肉身陨落时才有足够根基凝结出可供轮回的残魂 */
export const MIN_REALM_RANK_FOR_SAMSARA = 1; // 1 对应"筑基"

export function isEligibleForSamsara(realmMajor: string): boolean {
  return (REALM_RANKS[realmMajor] ?? 0) >= MIN_REALM_RANK_FOR_SAMSARA;
}

/** 前世因果并非必然触发，只是"可能"——即便轮回池里有残魂，也只有一定概率真正显灵 */
export const LEGACY_BLESSING_CHANCE = 0.5;

export type LegacyBlessingType = 'attribute_boost' | 'buried_treasure' | 'none';

const SIX_ATTRIBUTE_KEYS = ['aptitude', 'comprehension', 'divine_sense', 'speed', 'dao_heart', 'fortune'] as const;
export type SixAttributeKey = (typeof SIX_ATTRIBUTE_KEYS)[number];

export const ATTRIBUTE_LABELS: Record<SixAttributeKey, string> = {
  aptitude: '资质',
  comprehension: '悟性',
  divine_sense: '神识',
  speed: '遁速',
  dao_heart: '道心',
  fortune: '仙缘',
};

/** 继承前世造化，对应属性按此比例提升（向上取整，保证至少 +1） */
export const ATTRIBUTE_BOOST_RATIO = 0.1;

export function calculateAttributeBoost(baseValue: number): number {
  return Math.max(1, Math.ceil(baseValue * ATTRIBUTE_BOOST_RATIO));
}

export interface BuriedTreasure {
  name: string;
  rarity: number;
  description: string;
}

/** 前世埋藏的法宝池：稀有度封顶在自定义物品的地阶(4)以内，不破坏既有的造化铁律 */
const BURIED_TREASURE_POOL: BuriedTreasure[] = [
  { name: '前世埋藏的储物袋', rarity: 2, description: '前世匆匆掩埋于此，袋中灵气尚未散尽，隐约还残留着前世的一丝气息。' },
  { name: '断裂的传承玉简', rarity: 3, description: '前世修炼路上的心得残篇，虽已残缺，仍能窥得一二玄妙之处。' },
  { name: '尘封的护身法牌', rarity: 2, description: '前世贴身佩戴之物，历经轮回仍留有一丝庇护之力。' },
  { name: '半块洗髓丹', rarity: 3, description: '前世未能来得及服下的珍稀丹药，虽只剩半块，药力犹存。' },
];

export function pickBuriedTreasure(rollFn: () => number = Math.random): BuriedTreasure {
  const index = Math.min(BURIED_TREASURE_POOL.length - 1, Math.max(0, Math.floor(rollFn() * BURIED_TREASURE_POOL.length)));
  return BURIED_TREASURE_POOL[index]!;
}

export interface LegacyBlessingResult {
  type: LegacyBlessingType;
  attributeKey?: SixAttributeKey;
  attributeBonus?: number;
  treasure?: BuriedTreasure;
  narrativeText: string;
}

export interface LegacyCandidate {
  saveId: string;
  realmMajor: string;
  attributes: Record<SixAttributeKey, number>;
}

/**
 * 从轮回池候选里筛出真正有资格的（境界达标），再随机抽中一个。
 * 池子为空或全部不合格时返回 null，交由调用方回退为"无前世遗泽"。
 */
export function pickRandomLegacy(candidates: LegacyCandidate[], rollFn: () => number = Math.random): LegacyCandidate | null {
  const eligible = candidates.filter((c) => isEligibleForSamsara(c.realmMajor));
  if (eligible.length === 0) return null;
  const index = Math.min(eligible.length - 1, Math.max(0, Math.floor(rollFn() * eligible.length)));
  return eligible[index]!;
}

export interface LegacyBlessingRolls {
  /** 决定这次是否真正触发前世遗泽的判定骰 */
  chanceRoll?: () => number;
  /** 决定遗泽类型（属性 or 法宝）的判定骰 */
  typeRoll?: () => number;
  /** 决定继承哪一项六维属性的判定骰 */
  attributeRoll?: () => number;
  /** 决定挖出哪件法宝的判定骰 */
  treasureRoll?: () => number;
}

/**
 * 前世遗泽的确定性结算：是否触发、触发哪一种、具体给什么，全部由后端硬性掷骰决定。
 * @param legacyPlayerBaseAttributes 前世角色的六维属性快照，用于计算继承加成的基准值
 */
export function resolveLegacyBlessing(
  legacyPlayerBaseAttributes: Record<SixAttributeKey, number>,
  rolls: LegacyBlessingRolls = {},
): LegacyBlessingResult {
  const chanceRoll = rolls.chanceRoll ?? Math.random;
  if (chanceRoll() > LEGACY_BLESSING_CHANCE) {
    return { type: 'none', narrativeText: '' };
  }

  const typeRoll = rolls.typeRoll ?? Math.random;
  if (typeRoll() < 0.5) {
    const attributeRoll = rolls.attributeRoll ?? Math.random;
    const index = Math.min(SIX_ATTRIBUTE_KEYS.length - 1, Math.max(0, Math.floor(attributeRoll() * SIX_ATTRIBUTE_KEYS.length)));
    const attributeKey = SIX_ATTRIBUTE_KEYS[index]!;
    const baseValue = legacyPlayerBaseAttributes[attributeKey] ?? 10;
    const attributeBonus = calculateAttributeBoost(baseValue);
    return {
      type: 'attribute_boost',
      attributeKey,
      attributeBonus,
      narrativeText: `前世的一丝残魂悄然融入识海，你天生便继承了前世在「${ATTRIBUTE_LABELS[attributeKey]}」上的造化（+${attributeBonus}）。`,
    };
  }

  const treasureRoll = rolls.treasureRoll ?? Math.random;
  const treasure = pickBuriedTreasure(treasureRoll);
  return {
    type: 'buried_treasure',
    treasure,
    narrativeText: `依稀记得前世的记忆碎片，你循迹寻得一件前世埋藏之物——「${treasure.name}」。`,
  };
}
