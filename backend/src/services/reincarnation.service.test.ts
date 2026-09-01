import { describe, it, expect } from 'vitest';
import {
  isEligibleForSamsara,
  calculateAttributeBoost,
  pickBuriedTreasure,
  resolveLegacyBlessing,
  pickRandomLegacy,
  ATTRIBUTE_LABELS,
  LEGACY_BLESSING_CHANCE,
  type LegacyCandidate,
} from './reincarnation.service';

describe('isEligibleForSamsara（只有筑基及以上才有资格凝结残魂进入轮回池）', () => {
  it('正常路径：炼气期陨落不应有资格进入轮回池', () => {
    expect(isEligibleForSamsara('炼气')).toBe(false);
  });

  it('正常路径：筑基及以上境界陨落应有资格进入轮回池', () => {
    expect(isEligibleForSamsara('筑基')).toBe(true);
    expect(isEligibleForSamsara('金丹')).toBe(true);
    expect(isEligibleForSamsara('渡劫期')).toBe(true);
  });

  it('边界情况：未知境界名应安全退化为不合格，不产生异常', () => {
    expect(isEligibleForSamsara('未知境界')).toBe(false);
  });
});

describe('calculateAttributeBoost（继承前世造化的属性加成，按比例计算且保底 +1）', () => {
  it('正常路径：应按比例计算加成并向上取整', () => {
    expect(calculateAttributeBoost(10)).toBe(1); // 10*0.1=1
    expect(calculateAttributeBoost(15)).toBe(2); // 15*0.1=1.5 -> 向上取整为2
  });

  it('边界情况：基准值很小时也应保底 +1，不会出现 0 加成', () => {
    expect(calculateAttributeBoost(1)).toBe(1);
    expect(calculateAttributeBoost(0)).toBe(1);
  });
});

describe('pickBuriedTreasure（前世埋藏法宝抽取）', () => {
  it('正常路径：应能抽到合法的法宝对象', () => {
    const treasure = pickBuriedTreasure(() => 0);
    expect(treasure.name.length).toBeGreaterThan(0);
    expect(treasure.rarity).toBeGreaterThan(0);
  });

  it('边界情况：稀有度不应超过自定义物品的地阶上限(4)，不破坏既有造化铁律', () => {
    for (let i = 0; i < 10; i++) {
      const treasure = pickBuriedTreasure(() => i / 10);
      expect(treasure.rarity).toBeLessThanOrEqual(4);
    }
  });

  it('边界情况：骰子结果为最大值(接近1)时不应越界抛出异常', () => {
    expect(() => pickBuriedTreasure(() => 0.999999)).not.toThrow();
  });
});

describe('pickRandomLegacy（从轮回池候选中筛选合格者并随机抽取）', () => {
  const baseAttrs = { aptitude: 10, comprehension: 10, divine_sense: 10, speed: 10, dao_heart: 10, fortune: 10 };
  const makeCandidate = (saveId: string, realmMajor: string): LegacyCandidate => ({ saveId, realmMajor, attributes: baseAttrs });

  it('正常路径：应从合格候选中随机抽取一个', () => {
    const candidates = [makeCandidate('s1', '筑基'), makeCandidate('s2', '金丹')];
    const result = pickRandomLegacy(candidates, () => 0);
    expect(result?.saveId).toBe('s1');
  });

  it('核心场景：应过滤掉境界不合格（炼气期）的候选，不会被误抽中', () => {
    const candidates = [makeCandidate('s1', '炼气')];
    expect(pickRandomLegacy(candidates, () => 0)).toBeNull();
  });

  it('边界情况：轮回池为空时应返回 null，不抛出异常', () => {
    expect(pickRandomLegacy([], () => 0)).toBeNull();
  });

  it('边界情况：全部候选都不合格时应返回 null', () => {
    const candidates = [makeCandidate('s1', '炼气'), makeCandidate('s2', '炼气')];
    expect(pickRandomLegacy(candidates, () => 0.5)).toBeNull();
  });
});

describe('resolveLegacyBlessing（前世遗泽的确定性结算，"可能触发"而非必然）', () => {
  const baseAttributes = { aptitude: 10, comprehension: 10, divine_sense: 10, speed: 10, dao_heart: 10, fortune: 10 };

  it('核心场景：骰子结果超过触发概率时应判定为"未触发"', () => {
    const result = resolveLegacyBlessing(baseAttributes, { chanceRoll: () => LEGACY_BLESSING_CHANCE + 0.01 });
    expect(result.type).toBe('none');
  });

  it('核心场景：骰子结果落在触发概率内，且类型骰命中前半段时，应给予属性加成', () => {
    const result = resolveLegacyBlessing(baseAttributes, { chanceRoll: () => 0, typeRoll: () => 0, attributeRoll: () => 0 });
    expect(result.type).toBe('attribute_boost');
    expect(result.attributeKey).toBeDefined();
    expect(result.attributeBonus).toBeGreaterThan(0);
    expect(result.narrativeText).toContain(ATTRIBUTE_LABELS[result.attributeKey!]);
  });

  it('核心场景：骰子结果落在触发概率内，且类型骰命中后半段时，应给予前世法宝', () => {
    const result = resolveLegacyBlessing(baseAttributes, { chanceRoll: () => 0, typeRoll: () => 0.99, treasureRoll: () => 0 });
    expect(result.type).toBe('buried_treasure');
    expect(result.treasure).toBeDefined();
    expect(result.narrativeText).toContain(result.treasure!.name);
  });

  it('边界情况：未触发时不应包含任何叙事文案（避免空事件也生成文字噪音）', () => {
    const result = resolveLegacyBlessing(baseAttributes, { chanceRoll: () => 0.99 });
    expect(result.narrativeText).toBe('');
  });
});
