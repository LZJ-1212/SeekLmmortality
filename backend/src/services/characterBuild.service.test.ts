import { describe, it, expect } from 'vitest';
import {
  aggregateBuildEffects,
  getBuildCultivationSpeedMultiplier,
  getBuildCombatDamageMultiplier,
  getBuildCombatDefenseMultiplier,
  getSpeedDodgeMultiplier,
  CONSTITUTIONS,
  INNATE_TALENTS,
  ORIGINS,
  DAO_PURSUITS,
} from './characterBuild.service';

describe('aggregateBuildEffects（命格效果聚合）', () => {
  it('正常路径：空命格应返回全部中性的默认效果', () => {
    const effects = aggregateBuildEffects({});
    expect(effects.cultivationSpeedMultiplier).toBe(1);
    expect(effects.combatDamageMultiplier).toBe(1);
    expect(effects.combatDefenseMultiplier).toBe(1);
    expect(effects.maxHpBonus).toBe(0);
    expect(effects.maxLifespanBonus).toBe(0);
    expect(effects.spiritStonesBonus).toBe(0);
    expect(effects.attributeBonus).toEqual({});
  });

  it('边界情况：未知的命格名称应被安全忽略，不报错', () => {
    const effects = aggregateBuildEffects({ origin: '不存在', constitution: '不存在', innateTalents: ['不存在'] });
    expect(effects.cultivationSpeedMultiplier).toBe(1);
    expect(effects.maxHpBonus).toBe(0);
  });

  it('正常路径：单一体质应正确应用其乘数', () => {
    const effects = aggregateBuildEffects({ constitution: '先天道体' });
    expect(effects.cultivationSpeedMultiplier).toBe(1.2);
    expect(effects.maxLifespanBonus).toBe(20);
  });

  it('核心场景：出身 + 道途 + 体质 + 天赋的乘数应叠乘，绝对值应相加', () => {
    // 先天道体 1.2 × 问道飞升 1.1 × 天资聪颖 1.1 = 1.452
    const effects = aggregateBuildEffects({
      constitution: '先天道体',
      daoPursuit: '问道飞升',
      innateTalents: ['天资聪颖'],
      origin: '商贾之家',
    });
    expect(effects.cultivationSpeedMultiplier).toBeCloseTo(1.2 * 1.1 * 1.1);
    expect(effects.maxLifespanBonus).toBe(20); // 先天道体 + 逍遥长生未选，只有体质贡献
    expect(effects.spiritStonesBonus).toBe(80); // 商贾之家
  });

  it('核心场景：六维属性加成应正确累加', () => {
    // 书香门第 comprehension+3，过目不忘 comprehension+2
    const effects = aggregateBuildEffects({ origin: '书香门第', innateTalents: ['过目不忘'] });
    expect(effects.attributeBonus.comprehension).toBe(5);
  });

  it('核心场景：多个命格对同一六维的加成应相加', () => {
    // 方外遗孤 divine_sense+3，冰魄灵体 divine_sense+1
    const effects = aggregateBuildEffects({ origin: '方外遗孤', constitution: '冰魄灵体' });
    expect(effects.attributeBonus.divine_sense).toBe(4);
  });

  it('核心场景：战斗减伤乘数应叠乘', () => {
    // 冰魄灵体 0.9 × 身轻如燕 0.95 = 0.855
    const effects = aggregateBuildEffects({ constitution: '冰魄灵体', innateTalents: ['身轻如燕'] });
    expect(effects.combatDefenseMultiplier).toBeCloseTo(0.9 * 0.95);
  });
});

describe('命格命格乘数的快捷访问器', () => {
  it('getBuildCultivationSpeedMultiplier 应返回正确的修炼倍率', () => {
    expect(getBuildCultivationSpeedMultiplier({ constitution: '先天道体' })).toBe(1.2);
    expect(getBuildCultivationSpeedMultiplier({})).toBe(1);
  });

  it('getBuildCombatDamageMultiplier 应返回正确的伤害倍率', () => {
    expect(getBuildCombatDamageMultiplier({ constitution: '纯阳体' })).toBe(1.2);
  });

  it('getBuildCombatDefenseMultiplier 应返回正确的减伤倍率', () => {
    expect(getBuildCombatDefenseMultiplier({ daoPursuit: '守护所爱' })).toBe(0.9);
  });
});

describe('命格配置表完整性', () => {
  it('所有创角选项都应在配置表中有对应条目', () => {
    const origins = ['农家子', '猎户之后', '商贾之家', '官宦子弟', '将门之后', '没落世家', '市井孤儿', '书香门第', '方外遗孤', '妖族后裔'];
    const pursuits = ['问道飞升', '逍遥长生', '快意恩仇', '守护所爱', '问鼎天下', '随心所欲'];
    const constitutions = ['凡体', '先天道体', '剑灵体', '九阳圣体', '冰魄灵体', '玄阴体', '纯阳体', '混沌体'];
    const talents = ['天资聪颖', '过目不忘', '身轻如燕', '天生道心', '气运加身', '百脉俱通'];

    for (const o of origins) expect(ORIGINS[o], `出身缺少: ${o}`).toBeDefined();
    for (const p of pursuits) expect(DAO_PURSUITS[p], `道途缺少: ${p}`).toBeDefined();
    for (const c of constitutions) expect(CONSTITUTIONS[c], `体质缺少: ${c}`).toBeDefined();
    for (const t of talents) expect(INNATE_TALENTS[t], `天赋缺少: ${t}`).toBeDefined();
  });
});

describe('getSpeedDodgeMultiplier（遁速闪避/减伤倍率）', () => {
  it('正常路径：基准遁速 10 应为中性乘数 1', () => {
    expect(getSpeedDodgeMultiplier(10)).toBe(1);
  });

  it('核心场景：高遁速应降低受伤倍率（闪避）', () => {
    expect(getSpeedDodgeMultiplier(15)).toBe(0.9);
    expect(getSpeedDodgeMultiplier(12)).toBe(0.96);
  });

  it('核心场景：低遁速应提高受伤倍率（迟钝）', () => {
    expect(getSpeedDodgeMultiplier(5)).toBe(1.1);
    expect(getSpeedDodgeMultiplier(1)).toBe(1.18);
  });

  it('边界情况：极端数值应被夹紧在 [0.7, 1.3] 区间内', () => {
    expect(getSpeedDodgeMultiplier(100)).toBe(0.7);
    expect(getSpeedDodgeMultiplier(-100)).toBe(1.3);
  });

  it('边界情况：非法输入应退化为基准遁速 10', () => {
    expect(getSpeedDodgeMultiplier(NaN)).toBe(1);
    expect(getSpeedDodgeMultiplier(Infinity)).toBe(1);
  });
});
