import { describe, it, expect } from 'vitest';
import {
  clampResource,
  applyCultivationDelta,
  advanceAge,
  advanceWorldTime,
  isLifespanExhausted,
  getDeathReason,
  isDead,
  resolveBreakthroughAttempt,
  type RealmLaw,
} from './playerState.service';

describe('clampResource（气血/灵力等资源的增减夹紧）', () => {
  it('正常路径：增减后仍在区间内时按原值计算', () => {
    expect(clampResource(50, 10, 100)).toBe(60);
    expect(clampResource(50, -10, 100)).toBe(40);
  });

  it('边界情况：扣减超过当前值时应夹紧到 0，不能变成负数', () => {
    expect(clampResource(5, -20, 100)).toBe(0);
  });

  it('边界情况：增加超过上限时应夹紧到 max', () => {
    expect(clampResource(95, 20, 100)).toBe(100);
  });
});

describe('applyCultivationDelta（修为增减，只有下限没有上限）', () => {
  it('正常路径：正常增减', () => {
    expect(applyCultivationDelta(100, 50)).toBe(150);
    expect(applyCultivationDelta(100, -30)).toBe(70);
  });

  it('边界情况：扣减为负数时应夹紧到 0', () => {
    expect(applyCultivationDelta(50, -1000)).toBe(0);
  });
});

describe('advanceAge（年龄与零碎月份累加器——修复“角色永远不会变老”的核心 Bug）', () => {
  it('正常路径：单次不足 12 个月时年龄不变，零碎月份被记录下来', () => {
    const result = advanceAge(16, 0, 0.2);
    expect(result.newAge).toBe(16);
    expect(result.newPendingMonths).toBeCloseTo(0.2);
  });

  it('核心场景：多次零碎月份累计满 12 个月后应正确进位增加年龄', () => {
    let age = 16;
    let pending = 0;
    // 模拟 60 次“日常交互”，每次消耗 0.2 个月，累计 12 个月 = 1 年
    for (let i = 0; i < 60; i++) {
      const result = advanceAge(age, pending, 0.2);
      age = result.newAge;
      pending = result.newPendingMonths;
    }
    expect(age).toBe(17);
    expect(pending).toBeCloseTo(0);
  });

  it('边界情况：单次一次性消耗超过 12 个月（如闭关十年=120个月）应正确进位多年', () => {
    const result = advanceAge(16, 0, 120);
    expect(result.newAge).toBe(26);
    expect(result.newPendingMonths).toBeCloseTo(0);
  });

  it('边界情况：跨越多年的大额时间消耗也能正确处理余数', () => {
    const result = advanceAge(16, 5, 19); // 5 + 19 = 24 个月 = 2 年整
    expect(result.newAge).toBe(18);
    expect(result.newPendingMonths).toBeCloseTo(0);
  });
});

describe('advanceWorldTime（世界年份/季节推进）', () => {
  it('正常路径：不足 3 个月时季节不变，累加器记录零碎月份', () => {
    const result = advanceWorldTime(387, '春', 0, 1);
    expect(result.newYear).toBe(387);
    expect(result.newSeason).toBe('春');
    expect(result.newPendingMonths).toBeCloseTo(1);
  });

  it('正常路径：累计满 3 个月应推进一个季节', () => {
    const result = advanceWorldTime(387, '春', 2, 1);
    expect(result.newSeason).toBe('夏');
    expect(result.newYear).toBe(387);
    expect(result.newPendingMonths).toBeCloseTo(0);
  });

  it('边界情况：跨年时季节应循环回“春”，年份 +1', () => {
    const result = advanceWorldTime(387, '冬', 0, 3);
    expect(result.newSeason).toBe('春');
    expect(result.newYear).toBe(388);
  });

  it('边界情况：一次性消耗很多个月（远行/长期闭关）应正确跨越多个季节与年份', () => {
    const result = advanceWorldTime(387, '春', 0, 15); // 15 个月 = 1 年 + 1 季度
    expect(result.newYear).toBe(388);
    expect(result.newSeason).toBe('夏');
  });
});

describe('getDeathReason / isDead / isLifespanExhausted（死亡判定）', () => {
  it('正常路径：气血和寿元都正常时不应判定死亡', () => {
    expect(getDeathReason(50, 30, 100)).toBeNull();
    expect(isDead(50, 30, 100)).toBe(false);
  });

  it('异常路径：气血耗尽应判定死亡，原因为 hp_exhausted', () => {
    expect(getDeathReason(0, 30, 100)).toBe('hp_exhausted');
    expect(isDead(0, 30, 100)).toBe(true);
  });

  it('异常路径（此前完全缺失的核心 Bug）：寿元耗尽（年龄超过寿元上限）应判定死亡', () => {
    expect(isLifespanExhausted(101, 100)).toBe(true);
    expect(getDeathReason(50, 101, 100)).toBe('lifespan_exhausted');
    expect(isDead(50, 101, 100)).toBe(true);
  });

  it('边界情况：年龄恰好等于寿元上限时，不应判定寿元耗尽（严格大于才算耗尽）', () => {
    expect(isLifespanExhausted(100, 100)).toBe(false);
    expect(getDeathReason(50, 100, 100)).toBeNull();
  });

  it('边界情况：气血耗尽优先于寿元耗尽被识别（返回第一个命中的原因）', () => {
    expect(getDeathReason(0, 101, 100)).toBe('hp_exhausted');
  });
});

describe('resolveBreakthroughAttempt（境界突破的确定性数值结算，不依赖 AI 自己计算数值）', () => {
  const REALM_LAWS: Record<string, RealmLaw> = {
    '炼气·初期': { next: '炼气·中期', reqCultivation: 100, isMajor: false },
    '炼气·圆满': {
      next: '筑基·初期',
      reqCultivation: 800,
      isMajor: true,
      baseSuccess: 0.7,
      tribulationDamage: 60,
      newLifespan: 200,
    },
  };

  it('异常路径：当前境界不在法则表中时，突破应失败且状态不变', () => {
    const result = resolveBreakthroughAttempt(
      { realmMajor: '未知境界', realmMinor: '未知', cultivation: 999, hp: 100, maxHp: 100, maxLifespan: 100, daoHeart: 10 },
      REALM_LAWS,
    );
    expect(result.success).toBe(false);
    expect(result.patch.hp).toBe(100);
    expect(result.patch.cultivation).toBe(999);
  });

  it('异常路径：修为不足时突破失败，应扣除固定 10 点气血，境界不变', () => {
    const result = resolveBreakthroughAttempt(
      { realmMajor: '炼气', realmMinor: '初期', cultivation: 50, hp: 100, maxHp: 100, maxLifespan: 100, daoHeart: 10 },
      REALM_LAWS,
    );
    expect(result.success).toBe(false);
    expect(result.patch.hp).toBe(90);
    expect(result.patch.realmMajor).toBe('炼气');
    expect(result.patch.realmMinor).toBe('初期');
  });

  it('正常路径：小境界修为达标直接突破成功，修为清零，气血不受影响', () => {
    const result = resolveBreakthroughAttempt(
      { realmMajor: '炼气', realmMinor: '初期', cultivation: 150, hp: 80, maxHp: 100, maxLifespan: 100, daoHeart: 10 },
      REALM_LAWS,
    );
    expect(result.success).toBe(true);
    expect(result.patch.realmMajor).toBe('炼气');
    expect(result.patch.realmMinor).toBe('中期');
    expect(result.patch.cultivation).toBe(0);
    expect(result.patch.hp).toBe(80);
  });

  it('正常路径：大境界突破成功时（注入必定成功的 rollFn），气血回满至新上限、寿元上限提升、修为清零', () => {
    const result = resolveBreakthroughAttempt(
      { realmMajor: '炼气', realmMinor: '圆满', cultivation: 900, hp: 30, maxHp: 200, maxLifespan: 100, daoHeart: 10 },
      REALM_LAWS,
      () => 0, // roll = 0，必定 <= successRate，触发成功分支
    );
    expect(result.success).toBe(true);
    expect(result.patch.realmMajor).toBe('筑基');
    expect(result.patch.realmMinor).toBe('初期');
    expect(result.patch.maxHp).toBe(300);
    expect(result.patch.hp).toBe(300); // 伤势完全恢复
    expect(result.patch.cultivation).toBe(0);
    expect(result.patch.maxLifespan).toBe(200);
  });

  it('异常路径：大境界突破失败时（注入必定失败的 rollFn），应扣除固定雷劫伤害与 100 点修为', () => {
    const result = resolveBreakthroughAttempt(
      { realmMajor: '炼气', realmMinor: '圆满', cultivation: 900, hp: 200, maxHp: 200, maxLifespan: 100, daoHeart: 10 },
      REALM_LAWS,
      () => 0.999, // roll 接近 1，必定 > successRate，触发失败分支
    );
    expect(result.success).toBe(false);
    expect(result.patch.hp).toBe(140); // 200 - 60 雷劫伤害
    expect(result.patch.cultivation).toBe(800); // 900 - 100
    expect(result.patch.realmMajor).toBe('炼气'); // 境界不变
    expect(result.patch.maxLifespan).toBe(100); // 寿元上限不变
  });

  it('边界情况：大境界突破失败时气血/修为不会扣成负数', () => {
    const result = resolveBreakthroughAttempt(
      { realmMajor: '炼气', realmMinor: '圆满', cultivation: 850, hp: 20, maxHp: 200, maxLifespan: 100, daoHeart: 10 },
      REALM_LAWS,
      () => 0.999,
    );
    expect(result.patch.hp).toBe(0); // 20 - 60，夹紧到 0
    expect(result.patch.cultivation).toBe(750); // 850 - 100
  });
});
