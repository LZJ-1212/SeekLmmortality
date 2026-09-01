import { describe, it, expect } from 'vitest';
import {
  findExplorationRegion,
  calculateEncounterChance,
  rollExplorationEncounter,
  checkRegionDanger,
  isExplorationAttempt,
  EXPLORATION_REGIONS,
  BASE_ENCOUNTER_CHANCE_PERCENT,
  MAX_ENCOUNTER_CHANCE_PERCENT,
} from './exploration.service';

describe('findExplorationRegion（九州地理分级）', () => {
  it('正常路径：应正确返回已收录地区的分级信息', () => {
    const region = findExplorationRegion('中州天阙');
    expect(region.minSafeRealmRank).toBe(7);
  });

  it('边界情况：未收录的地区应退化为默认安全地带，不产生异常惩罚', () => {
    const region = findExplorationRegion('某个从未去过的地方');
    expect(region.minSafeRealmRank).toBe(0);
    expect(region.fortuneEncounterBonus).toBe(0);
  });

  it('健全性检查：地区分级应按危险程度合理递增（青岳坊市最安全，中州天阙最危险）', () => {
    const capital = findExplorationRegion('青岳·天机坊市');
    const forbidden = findExplorationRegion('中州天阙');
    expect(forbidden.minSafeRealmRank).toBeGreaterThan(capital.minSafeRealmRank);
  });
});

describe('calculateEncounterChance（仙缘换算奇遇概率）', () => {
  it('正常路径：仙缘为基准值(10)时应为基础概率', () => {
    expect(calculateEncounterChance(10)).toBe(BASE_ENCOUNTER_CHANCE_PERCENT);
  });

  it('核心场景：仙缘越高，奇遇概率越高', () => {
    expect(calculateEncounterChance(15)).toBeGreaterThan(calculateEncounterChance(10));
  });

  it('边界情况：概率不会超过封顶值，即便仙缘极高', () => {
    expect(calculateEncounterChance(9999)).toBe(MAX_ENCOUNTER_CHANCE_PERCENT);
  });

  it('边界情况：仙缘低于基准值时不应产生负加成（概率不低于基础值以下）', () => {
    expect(calculateEncounterChance(0)).toBe(BASE_ENCOUNTER_CHANCE_PERCENT);
  });

  it('正常路径：地区的机缘加成应叠加进最终概率', () => {
    const withoutBonus = calculateEncounterChance(10, 0);
    const withBonus = calculateEncounterChance(10, 20);
    expect(withBonus).toBe(withoutBonus + 20);
  });
});

describe('rollExplorationEncounter（1d100 奇遇掷骰机制）', () => {
  it('核心场景：骰子结果超过概率门槛时不应触发奇遇', () => {
    const result = rollExplorationEncounter(10, 0, { encounterRoll: () => 0.99 }); // 1d100 = 100
    expect(result.triggered).toBe(false);
    expect(result.encounterType).toBe('none');
  });

  it('核心场景：骰子结果落在概率门槛内时应强制触发奇遇', () => {
    const result = rollExplorationEncounter(10, 0, { encounterRoll: () => 0 }); // 1d100 = 1
    expect(result.triggered).toBe(true);
    expect(result.roll).toBe(1);
  });

  it('正常路径：奇遇类型由第二次掷骰决定，应能覆盖两种类型', () => {
    const woundedExpert = rollExplorationEncounter(10, 0, { encounterRoll: () => 0, typeRoll: () => 0 });
    const secretRealm = rollExplorationEncounter(10, 0, { encounterRoll: () => 0, typeRoll: () => 0.99 });
    expect(woundedExpert.encounterType).toBe('wounded_expert');
    expect(secretRealm.encounterType).toBe('secret_realm');
  });

  it('边界情况：1d100 掷骰结果应始终落在 1~100 范围内', () => {
    const minRoll = rollExplorationEncounter(10, 0, { encounterRoll: () => 0 });
    const maxRoll = rollExplorationEncounter(10, 0, { encounterRoll: () => 0.999999 });
    expect(minRoll.roll).toBe(1);
    expect(maxRoll.roll).toBe(100);
  });
});

describe('checkRegionDanger（高危地图强闯惩罚，与战斗系统的境界差距阈值保持一致）', () => {
  it('正常路径：境界达到或超过地区门槛时不应有任何惩罚', () => {
    const region = findExplorationRegion('幽冥谷'); // minSafeRealmRank 1
    const result = checkRegionDanger(1, region);
    expect(result.isDangerous).toBe(false);
    expect(result.hpDamagePercent).toBe(0);
  });

  it('核心场景：境界差距 1 级（以下犯上但未到致命程度）应受到重创但非致命', () => {
    const region = findExplorationRegion('幽冥谷'); // minSafeRealmRank 1
    const result = checkRegionDanger(0, region); // 差距1
    expect(result.isDangerous).toBe(true);
    expect(result.isLethal).toBe(false);
    expect(result.hpDamagePercent).toBeGreaterThan(0);
    expect(result.hpDamagePercent).toBeLessThan(1);
  });

  it('核心场景（"去之即死"）：境界差距 2 级及以上应判定为致命', () => {
    const region = findExplorationRegion('中州天阙'); // minSafeRealmRank 7
    const result = checkRegionDanger(0, region); // 差距7，远超阈值
    expect(result.isDangerous).toBe(true);
    expect(result.isLethal).toBe(true);
    expect(result.hpDamagePercent).toBe(1);
  });

  it('边界情况：地区名称未收录时应退化为无风险，不产生异常惩罚', () => {
    const region = findExplorationRegion('平平无奇的村庄');
    const result = checkRegionDanger(0, region);
    expect(result.isDangerous).toBe(false);
  });
});

describe('isExplorationAttempt（识别出门历练/探索行动）', () => {
  it('正常路径：应正确识别历练/探索类关键词', () => {
    expect(isExplorationAttempt('决定出门历练一番')).toBe(true);
    expect(isExplorationAttempt('前往秘境探索')).toBe(true);
  });

  it('边界情况：普通行动不应误判', () => {
    expect(isExplorationAttempt('在洞府里打坐')).toBe(false);
    expect(isExplorationAttempt('')).toBe(false);
  });
});

describe('健全性检查：EXPLORATION_REGIONS 数据完整性', () => {
  it('每个地区都应有合法的名称与非负的门槛/加成数值', () => {
    for (const region of EXPLORATION_REGIONS) {
      expect(region.name.length).toBeGreaterThan(0);
      expect(region.minSafeRealmRank).toBeGreaterThanOrEqual(0);
      expect(region.fortuneEncounterBonus).toBeGreaterThanOrEqual(0);
    }
  });
});
