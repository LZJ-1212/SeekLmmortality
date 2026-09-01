import { describe, it, expect } from 'vitest';
import {
  TALENT_POOL,
  getTalentById,
  pickRandomTalentChoices,
  getCombatDamageMultiplier,
  getCombatDefenseMultiplier,
  getCultivationSpeedMultiplier,
  parseTalentsData,
  getRealmTalentIds,
  getOwnedTalents,
  addRealmTalent,
} from './talent.service';

describe('getTalentById（天赋池查询）', () => {
  it('正常路径：应能查到已知天赋', () => {
    expect(getTalentById('sword_heart_clarity')?.name).toBe('剑心通明');
  });

  it('边界情况：未知 id 应返回 undefined', () => {
    expect(getTalentById('not_exist')).toBeUndefined();
  });
});

describe('pickRandomTalentChoices（突破大境界后的天赋三选一）', () => {
  it('正常路径：无已拥有天赋时应从整个天赋池里随机抽取指定数量', () => {
    const choices = pickRandomTalentChoices([], 3, () => 0);
    expect(choices).toHaveLength(3);
  });

  it('核心场景：不应重复抽到玩家已经拥有的天赋', () => {
    const owned = [TALENT_POOL[0]!.id, TALENT_POOL[1]!.id];
    const choices = pickRandomTalentChoices(owned, 3, () => 0);
    for (const choice of choices) {
      expect(owned).not.toContain(choice.id);
    }
  });

  it('核心场景：同一次抽取不应出现重复天赋', () => {
    const choices = pickRandomTalentChoices([], 3, () => 0.999999);
    const ids = choices.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('边界情况：剩余可选天赋数量不足时，应只返回实际剩余的数量，不报错', () => {
    const owned = TALENT_POOL.slice(0, TALENT_POOL.length - 1).map((t) => t.id); // 只剩 1 个未拥有
    const choices = pickRandomTalentChoices(owned, 3, () => 0);
    expect(choices).toHaveLength(1);
  });

  it('边界情况：天赋池已被全部拥有时应返回空数组', () => {
    const owned = TALENT_POOL.map((t) => t.id);
    const choices = pickRandomTalentChoices(owned, 3, () => 0);
    expect(choices).toHaveLength(0);
  });
});

describe('getCombatDamageMultiplier / getCombatDefenseMultiplier / getCultivationSpeedMultiplier（全局乘数聚合）', () => {
  it('正常路径：没有任何天赋时，各项乘数应为中性值 1', () => {
    expect(getCombatDamageMultiplier([])).toBe(1);
    expect(getCombatDefenseMultiplier([])).toBe(1);
    expect(getCultivationSpeedMultiplier([])).toBe(1);
  });

  it('正常路径：单个天赋应正确应用其对应的倍率', () => {
    const swordHeart = getTalentById('sword_heart_clarity')!;
    expect(getCombatDamageMultiplier([swordHeart])).toBe(1.2);
  });

  it('核心场景：多个天赋的同类效果应叠乘而非叠加', () => {
    const a = getTalentById('sword_heart_clarity')!; // 1.2
    const b = getTalentById('berserker_will')!; // 1.3
    expect(getCombatDamageMultiplier([a, b])).toBeCloseTo(1.2 * 1.3);
  });

  it('正常路径：只影响特定效果的天赋，不应影响其他类型的乘数', () => {
    const ironBody = getTalentById('iron_body')!; // 只有 combatDefenseMultiplier
    expect(getCombatDamageMultiplier([ironBody])).toBe(1);
    expect(getCultivationSpeedMultiplier([ironBody])).toBe(1);
  });
});

describe('players.talents JSON 字段的安全读写', () => {
  it('parseTalentsData：正常 JSON 字符串应正确解析', () => {
    const data = parseTalentsData('{"origin":"农家子","realmTalents":["iron_body"]}');
    expect(data.origin).toBe('农家子');
    expect(data.realmTalents).toEqual(['iron_body']);
  });

  it('parseTalentsData：格式错误的字符串应安全退化为空对象，不抛出异常', () => {
    expect(parseTalentsData('这不是JSON')).toEqual({});
    expect(parseTalentsData(null)).toEqual({});
    expect(parseTalentsData(undefined)).toEqual({});
  });

  it('getRealmTalentIds：应正确提取已拥有的天赋 id 数组', () => {
    expect(getRealmTalentIds('{"realmTalents":["sword_heart_clarity","iron_body"]}')).toEqual(['sword_heart_clarity', 'iron_body']);
  });

  it('getRealmTalentIds：字段缺失时应返回空数组', () => {
    expect(getRealmTalentIds('{"origin":"农家子"}')).toEqual([]);
  });

  it('getOwnedTalents：应把 id 数组还原成完整天赋对象，未知 id 安全过滤', () => {
    const owned = getOwnedTalents('{"realmTalents":["iron_body","some_unknown_id"]}');
    expect(owned).toHaveLength(1);
    expect(owned[0]!.id).toBe('iron_body');
  });

  it('addRealmTalent：应正确追加新天赋，同时保留原有字段', () => {
    const updated = addRealmTalent('{"origin":"农家子","daoPursuit":"问道飞升"}', 'iron_body');
    const parsed = JSON.parse(updated);
    expect(parsed.origin).toBe('农家子');
    expect(parsed.realmTalents).toEqual(['iron_body']);
  });

  it('addRealmTalent：追加第二个天赋时应保留第一个', () => {
    const step1 = addRealmTalent('{}', 'iron_body');
    const step2 = addRealmTalent(step1, 'dao_insight');
    expect(JSON.parse(step2).realmTalents).toEqual(['iron_body', 'dao_insight']);
  });

  it('异常路径：选择未知天赋 id 应抛出异常', () => {
    expect(() => addRealmTalent('{}', 'not_exist')).toThrow('未知的天赋');
  });

  it('异常路径：重复选择同一个天赋应抛出异常', () => {
    const withTalent = addRealmTalent('{}', 'iron_body');
    expect(() => addRealmTalent(withTalent, 'iron_body')).toThrow('已经拥有');
  });
});
