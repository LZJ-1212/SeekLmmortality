/** 修订：2026-09-03 23:40 +08 lzj — 闭关回复与境界叙事锁单测
 * 修订：2026-09-05 15:08 +08 lzj — 渡劫成仙结局单测
 */
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
  detectSeclusionMonths,
  DEFAULT_SECLUSION_MONTHS,
  getLifespanStatus,
  describeMonths,
  applyShichen,
  calculateSeclusionResourceRecovery,
  buildSeclusionRealmNarrativeLock,
  openingShichen,
  resolveActionClock,
  parseDayPhase,
  parseBeatScene,
  describeDayPhase,
  describeShichen,
  pointedDayPhase,
  REALM_LAWS as PRODUCTION_REALM_LAWS,
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

describe('resolveBreakthroughAttempt（境界突破 / 渡雷劫的确定性数值结算，不依赖 AI 自己计算数值）', () => {
  const REALM_LAWS: Record<string, RealmLaw> = {
    '炼气·初期': { next: '炼气·中期', reqCultivation: 100, isMajor: false },
    '炼气·圆满': {
      next: '筑基·初期', reqCultivation: 800, isMajor: true,
      tribulationTier: '人道', baseSuccess: 0.7, tribulationDamagePercent: 0.3,
      deathChanceOnFailure: 0, maxHpGain: 100, newLifespan: 200,
    },
    '元婴·圆满': {
      next: '化神·初期', reqCultivation: 46000, isMajor: true,
      tribulationTier: '地道', baseSuccess: 0.5, tribulationDamagePercent: 0.5,
      deathChanceOnFailure: 0, maxHpGain: 800, newLifespan: 1500,
    },
    '金丹·圆满': {
      next: '元婴·初期', reqCultivation: 13000, isMajor: true,
      tribulationTier: '天道', baseSuccess: 0.3, tribulationDamagePercent: 0.7,
      deathChanceOnFailure: 0.5, maxHpGain: 400, newLifespan: 800,
    },
  };

  const baseInput = { hp: 100, maxHp: 100, maxLifespan: 100, daoHeart: 10, merit: 0 };

  it('异常路径：当前境界不在法则表中时，突破应失败且状态不变', () => {
    const result = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '未知境界', realmMinor: '未知', cultivation: 999 },
      REALM_LAWS,
    );
    expect(result.success).toBe(false);
    expect(result.diedFromTribulation).toBe(false);
    expect(result.patch.hp).toBe(100);
    expect(result.patch.cultivation).toBe(999);
  });

  it('异常路径：修为不足时突破失败，应扣除固定 10 点气血，境界不变', () => {
    const result = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '炼气', realmMinor: '初期', cultivation: 50 },
      REALM_LAWS,
    );
    expect(result.success).toBe(false);
    expect(result.patch.hp).toBe(90);
    expect(result.patch.realmMajor).toBe('炼气');
    expect(result.patch.realmMinor).toBe('初期');
  });

  it('正常路径：小境界修为达标直接突破成功，修为清零，气血不受影响，无需渡劫', () => {
    const result = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '炼气', realmMinor: '初期', cultivation: 150, hp: 80 },
      REALM_LAWS,
    );
    expect(result.success).toBe(true);
    expect(result.patch.realmMajor).toBe('炼气');
    expect(result.patch.realmMinor).toBe('中期');
    expect(result.patch.cultivation).toBe(0);
    expect(result.patch.hp).toBe(80);
    expect(result.isMajorBreakthroughSuccess).toBe(false); // 小境界水到渠成，不触发天赋三选一
  });

  it('正常路径：大境界（人道劫）突破成功时，气血回满至新上限、寿元上限提升、修为清零', () => {
    const result = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '炼气', realmMinor: '圆满', cultivation: 900, hp: 30, maxHp: 200 },
      REALM_LAWS,
      { successRoll: () => 0 }, // roll = 0，必定 <= successRate，触发成功分支
    );
    expect(result.success).toBe(true);
    expect(result.patch.realmMajor).toBe('筑基');
    expect(result.patch.realmMinor).toBe('初期');
    expect(result.patch.maxHp).toBe(300); // 200 + maxHpGain(100)
    expect(result.patch.hp).toBe(300); // 伤势完全恢复
    expect(result.patch.cultivation).toBe(0);
    expect(result.patch.maxLifespan).toBe(200);
    expect(result.isMajorBreakthroughSuccess).toBe(true); // 大境界渡劫成功，应触发天赋三选一
  });

  it('异常路径：大境界（人道劫）突破失败时，按气血上限百分比扣伤害与固定 100 点修为，不会陨落', () => {
    const result = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '炼气', realmMinor: '圆满', cultivation: 900, hp: 200, maxHp: 200 },
      REALM_LAWS,
      { successRoll: () => 0.999 }, // roll 接近 1，必定 > successRate，触发失败分支
    );
    expect(result.success).toBe(false);
    expect(result.diedFromTribulation).toBe(false);
    expect(result.patch.hp).toBe(140); // 200 - (200*0.3=60) 雷劫伤害
    expect(result.patch.cultivation).toBe(800); // 900 - 100
    expect(result.patch.realmMajor).toBe('炼气'); // 境界不变
    expect(result.patch.maxLifespan).toBe(100); // 寿元上限不变
  });

  it('边界情况：大境界突破失败时气血/修为不会扣成负数', () => {
    const result = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '炼气', realmMinor: '圆满', cultivation: 850, hp: 20, maxHp: 200 },
      REALM_LAWS,
      { successRoll: () => 0.999 },
    );
    expect(result.patch.hp).toBe(0); // 20 - 60，夹紧到 0
    expect(result.patch.cultivation).toBe(750); // 850 - 100
  });

  it('正常路径：功德（merit）会提升渡劫成功率，命中「功德抵御雷劫」的法则', () => {
    // baseSuccess 0.5 + daoHeart(10)*0.01=0.1 + merit(200)*0.0005=0.1 => successRate = 0.7
    const withHighMerit = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '元婴', realmMinor: '圆满', cultivation: 50000, merit: 200 },
      REALM_LAWS,
      { successRoll: () => 0.69 }, // 恰好命中提升后的成功率区间
    );
    expect(withHighMerit.success).toBe(true);

    const withoutMerit = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '元婴', realmMinor: '圆满', cultivation: 50000, merit: 0 },
      REALM_LAWS,
      { successRoll: () => 0.69 }, // 同样的骰子结果，没有功德加成时应该失败（0.5+0.1=0.6 < 0.69）
    );
    expect(withoutMerit.success).toBe(false);
  });

  it('边界情况：功德加成有上限（不会无限提升成功率）', () => {
    // merit 极高时，加成应被夹在 MAX_MERIT_SUCCESS_BONUS(0.15) 以内：0.5+0.1(道心)+0.15(功德上限)=0.75
    const result = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '元婴', realmMinor: '圆满', cultivation: 50000, merit: 999999 },
      REALM_LAWS,
      { successRoll: () => 0.76 }, // 超出加成上限后的成功率，理应失败
    );
    expect(result.success).toBe(false);
  });

  it('异常路径（“九死一生”核心场景）：天道劫突破失败后，命中陨落判定应直接死亡（气血归零）', () => {
    const result = resolveBreakthroughAttempt(
      { realmMajor: '金丹', realmMinor: '圆满', cultivation: 20000, hp: 500, maxHp: 500, maxLifespan: 800, daoHeart: 0, merit: 0 },
      REALM_LAWS,
      { successRoll: () => 0.99, deathRoll: () => 0 }, // 先渡劫失败，再命中 50% 的陨落判定
    );
    expect(result.success).toBe(false);
    expect(result.diedFromTribulation).toBe(true);
    expect(result.patch.hp).toBe(0);
  });

  it('边界情况：天道劫突破失败但陨落判定未命中时，应退化为普通重伤而非死亡', () => {
    const result = resolveBreakthroughAttempt(
      { realmMajor: '金丹', realmMinor: '圆满', cultivation: 20000, hp: 500, maxHp: 500, maxLifespan: 800, daoHeart: 0, merit: 0 },
      REALM_LAWS,
      { successRoll: () => 0.99, deathRoll: () => 0.99 }, // 渡劫失败，但陨落判定(0.5)未命中
    );
    expect(result.success).toBe(false);
    expect(result.diedFromTribulation).toBe(false);
    expect(result.patch.hp).toBe(150); // 500 - (500*0.7=350)
  });

  it('边界情况：道心足够高时，可以把陨落概率压到 0，彻底避免九死一生的死亡分支', () => {
    // deathChance = max(0, 0.5 - daoHeart*0.002)，daoHeart=250 时 -> 0.5-0.5=0
    const result = resolveBreakthroughAttempt(
      { realmMajor: '金丹', realmMinor: '圆满', cultivation: 20000, hp: 500, maxHp: 500, maxLifespan: 800, daoHeart: 250, merit: 0 },
      REALM_LAWS,
      { successRoll: () => 0.99, deathRoll: () => 0 }, // deathRoll 给到最容易触发死亡的值，但 deathChance 已被压到 0
    );
    expect(result.diedFromTribulation).toBe(false);
  });

  it('失败/拒绝：未知键文案不得谎称已扣灵力', () => {
    const result = resolveBreakthroughAttempt(
      { ...baseInput, realmMajor: '未知境界', realmMinor: '未知', cultivation: 999 },
      REALM_LAWS,
    );
    expect(result.forcedOutcomeText).not.toContain('扣除少量灵力');
    expect(result.clockKind).toBe('blocked');
  });

  it('正常路径：大乘圆满渡劫成功即成仙结局，不发三选一', () => {
    const result = resolveBreakthroughAttempt(
      { hp: 1000, maxHp: 1000, maxLifespan: 12000, daoHeart: 10, merit: 0, realmMajor: '大乘', realmMinor: '圆满', cultivation: 1600000 },
      PRODUCTION_REALM_LAWS,
      { successRoll: () => 0 },
    );
    expect(result.success).toBe(true);
    expect(result.ascended).toBe(true);
    expect(result.isMajorBreakthroughSuccess).toBe(false);
    expect(result.patch.realmMajor).toBe('渡劫期');
    expect(result.patch.realmMinor).toBe('飞升');
    expect(result.forcedOutcomeText).toContain('渡劫成仙');
  });

  it('正常路径：已在渡劫期·飞升再点突破，数值不变并锁成仙结局', () => {
    const result = resolveBreakthroughAttempt(
      { hp: 8000, maxHp: 8000, maxLifespan: 99999, daoHeart: 10, merit: 0, realmMajor: '渡劫期', realmMinor: '飞升', cultivation: 0 },
      PRODUCTION_REALM_LAWS,
    );
    expect(result.ascended).toBe(true);
    expect(result.patch.hp).toBe(8000);
    expect(result.patch.cultivation).toBe(0);
    expect(result.patch.realmMajor).toBe('渡劫期');
    expect(result.forcedOutcomeText).toContain('此世终局');
  });
});

describe('detectSeclusionMonths（闭关时长解析——防止 AI 随口决定“十年”到底是几个月）', () => {
  it('正常路径：未提到"闭关"的普通行动应返回 null，交由 AI 决定普通时间消耗', () => {
    expect(detectSeclusionMonths('出城历练，寻访机缘')).toBeNull();
    expect(detectSeclusionMonths('在坊市里逛逛')).toBeNull();
  });

  it('正常路径：阿拉伯数字 + 年', () => {
    expect(detectSeclusionMonths('闭关10年')).toBe(120);
    expect(detectSeclusionMonths('决定闭关 3 年潜心修炼')).toBe(36);
  });

  it('正常路径：中文数字 + 年（覆盖十/几十/百等常见写法）', () => {
    expect(detectSeclusionMonths('闭关十年')).toBe(120);
    expect(detectSeclusionMonths('闭关二十年')).toBe(240);
    expect(detectSeclusionMonths('闭关三十年')).toBe(360);
    expect(detectSeclusionMonths('闭关一百年')).toBe(1200);
    expect(detectSeclusionMonths('闭关一百二十年')).toBe(1440);
  });

  it('边界情况："半年/半载"应转换成 6 个月', () => {
    expect(detectSeclusionMonths('闭关半年')).toBe(6);
    expect(detectSeclusionMonths('准备闭关半载')).toBe(6);
  });

  it('正常路径：按月/按天指定时长', () => {
    expect(detectSeclusionMonths('闭关三个月')).toBe(3);
    expect(detectSeclusionMonths('闭关7天')).toBeCloseTo(7 / 30);
    expect(detectSeclusionMonths('闭关三十天')).toBeCloseTo(1);
  });

  it('边界情况：提到"闭关"但没有写明具体时长，应使用默认时长（1 年）', () => {
    expect(detectSeclusionMonths('找个洞府闭关修炼')).toBe(DEFAULT_SECLUSION_MONTHS);
    expect(DEFAULT_SECLUSION_MONTHS).toBe(12);
  });
});

describe('calculateSeclusionResourceRecovery（闭关调息：气血灵力随月恢复）', () => {
  it('正常路径：闭关 12 月应大幅恢复缺失气血与灵力', () => {
    const r = calculateSeclusionResourceRecovery(12, 45, 100, 17, 100);
    expect(r.hpDelta).toBe(53);
    expect(r.mpDelta).toBe(80);
  });

  it('边界情况：已满血满蓝时不恢复', () => {
    expect(calculateSeclusionResourceRecovery(12, 100, 100, 100, 100)).toEqual({ hpDelta: 0, mpDelta: 0 });
  });

  it('边界情况：0 月不恢复', () => {
    expect(calculateSeclusionResourceRecovery(0, 10, 100, 10, 100)).toEqual({ hpDelta: 0, mpDelta: 0 });
  });
});

describe('buildSeclusionRealmNarrativeLock（闭关出关禁止叙事乱写境界）', () => {
  const laws = {
    '炼气·中期': { next: '炼气·后期', reqCultivation: 200, isMajor: false },
  };

  it('正常路径：修为够下一小境时应提示须另发突破', () => {
    const text = buildSeclusionRealmNarrativeLock('炼气', '中期', 150, 60, laws);
    expect(text).toContain('炼气·中期');
    expect(text).toContain('禁止写已晋入');
    expect(text).toContain('突破');
  });
});

describe('getLifespanStatus（寿元危机预警——大限压迫感）', () => {
  it('正常路径：寿元充足时不应触发预警', () => {
    const status = getLifespanStatus(30, 100);
    expect(status.remainingYears).toBe(70);
    expect(status.isNearingLifespanLimit).toBe(false);
    expect(status.warningMessage).toBeNull();
  });

  it('核心场景：剩余寿元低于上限 10% 时应触发「大限将至」预警', () => {
    const status = getLifespanStatus(92, 100); // 剩余 8 年 <= 阈值 10 年
    expect(status.remainingYears).toBe(8);
    expect(status.isNearingLifespanLimit).toBe(true);
    expect(status.warningMessage).toContain('大限将至');
    expect(status.warningMessage).toContain('8');
  });

  it('边界情况：寿元已经耗尽（remainingYears=0）时不应再展示"大限将至"预警（应直接判定死亡，不是预警）', () => {
    const status = getLifespanStatus(101, 100);
    expect(status.remainingYears).toBe(0);
    expect(status.isNearingLifespanLimit).toBe(false);
    expect(status.warningMessage).toBeNull();
  });

  it('边界情况：高境界寿元动辄成千上万年时，预警阈值应封顶在 50 年，而不是荒谬的几千年前就开始警告', () => {
    const farFromDeath = getLifespanStatus(9000, 99999); // 剩余远超 50 年
    expect(farFromDeath.isNearingLifespanLimit).toBe(false);

    const nearDeath = getLifespanStatus(99999 - 40, 99999); // 剩余 40 年 <= 封顶阈值 50
    expect(nearDeath.isNearingLifespanLimit).toBe(true);
  });

  it('边界情况：低境界寿元很短时，预警阈值至少保底 3 年，避免形同虚设', () => {
    const status = getLifespanStatus(17, 20); // 上限 20 年的 10% 只有 2 年，应保底到 3 年
    expect(status.remainingYears).toBe(3);
    expect(status.isNearingLifespanLimit).toBe(true);
  });
});

describe('describeMonths（把月数格式化成人类可读的中文时长，供 forcedOutcome 使用）', () => {
  it('正常路径：整年', () => {
    expect(describeMonths(120)).toBe('10年');
    expect(describeMonths(12)).toBe('1年');
  });

  it('正常路径：年 + 月的组合', () => {
    expect(describeMonths(14)).toBe('1年2个月');
  });

  it('边界情况：不足一年，只有月份', () => {
    expect(describeMonths(3)).toBe('3个月');
  });

  it('边界情况：不足一个月，换算成天', () => {
    expect(describeMonths(0.2)).toBe('6天');
  });

  it('边界情况：0 或负数应返回"片刻"', () => {
    expect(describeMonths(0)).toBe('片刻');
    expect(describeMonths(-1)).toBe('片刻');
  });
});

describe('applyShichen（时辰累加 → 日段 → 日 → 月，纯函数不掷骰）', () => {
  it('正常路径：满 3 时辰换下一日段', () => {
    expect(applyShichen('dawn', 0, 0, 3)).toEqual({ phase: 'noon', shichen: 0, days: 0, monthsToAdd: 0 });
    expect(applyShichen('noon', 0, 0, 3)).toEqual({ phase: 'dusk', shichen: 0, days: 0, monthsToAdd: 0 });
  });

  it('边界情况：night 再满 3 时辰应进入下一天，回到 dawn，days +1', () => {
    expect(applyShichen('night', 0, 0, 3)).toEqual({ phase: 'dawn', shichen: 0, days: 1, monthsToAdd: 0 });
  });

  it('边界情况：不满 3 时辰只累加，不换段', () => {
    expect(applyShichen('dawn', 1, 0, 1)).toEqual({ phase: 'dawn', shichen: 2, days: 0, monthsToAdd: 0 });
  });

  it('边界情况：满 30 日折成 1 月', () => {
    expect(applyShichen('night', 0, 29, 3)).toEqual({ phase: 'dawn', shichen: 0, days: 0, monthsToAdd: 1 });
  });

  it('边界情况：一次跨多个日段（6 时辰）也能正确推进', () => {
    expect(applyShichen('dawn', 0, 0, 6)).toEqual({ phase: 'dusk', shichen: 0, days: 0, monthsToAdd: 0 });
  });
});

describe('openingShichen（开场 1～2 日段，可注入 rollFn）', () => {
  it('rollFn 返回 0 时应得 3 时辰（1 日段）', () => {
    expect(openingShichen(() => 0)).toBe(3);
  });

  it('rollFn 返回 0.99 时应得 6 时辰（2 日段）', () => {
    expect(openingShichen(() => 0.99)).toBe(6);
  });
});

describe('resolveActionClock（按场扣时优先级：闭关→炼制→历练→场内→开场→未命中）', () => {
  const base = {
    beat: 'none' as const,
    phase: 'dawn' as const,
    shichen: 0,
    days: 0,
    seclusionMonths: null,
    craftMonths: null,
  };

  it('正常路径：未在场 +「聊聊天」+ rollFn 0 → 置 talk，+3 时辰，不得进 1 月', () => {
    const r = resolveActionClock({ ...base, actionText: '我想找人聊聊天', rollFn: () => 0 });
    expect(r.beat).toBe('talk');
    expect(r.monthsPassed).toBe(0);
    expect(r.phase).toBe('noon'); // dawn 满 3 时辰 → noon
    expect(r.shichen).toBe(0);
  });

  it('正常路径：同句 + rollFn 0.99 → +6 时辰，仍不得进 1 月', () => {
    const r = resolveActionClock({ ...base, actionText: '聊聊天', rollFn: () => 0.99 });
    expect(r.beat).toBe('talk');
    expect(r.monthsPassed).toBe(0);
    expect(r.phase).toBe('dusk'); // 6 时辰 = 2 日段
  });

  it('边界情况：已在 talk 再点「聊聊天」→ 0 时辰，不连刷白天', () => {
    const r = resolveActionClock({ ...base, beat: 'talk', phase: 'noon', actionText: '再聊聊天', rollFn: () => 0 });
    expect(r.beat).toBe('talk');
    expect(r.monthsPassed).toBe(0);
    expect(r.phase).toBe('noon');
    expect(r.shichen).toBe(0);
  });

  it('边界情况：已在 talk +「我回答了一句好的」→ 0 时辰，日段不变', () => {
    const r = resolveActionClock({ ...base, beat: 'talk', phase: 'noon', actionText: '我回答了一句好的' });
    expect(r.beat).toBe('talk');
    expect(r.monthsPassed).toBe(0);
    expect(r.phase).toBe('noon');
    expect(r.shichen).toBe(0);
  });

  it('边界情况：已在 talk +「告辞，回府」→ beat 置 none，日段落到 dusk', () => {
    const r = resolveActionClock({ ...base, beat: 'talk', phase: 'noon', actionText: '告辞，回府' });
    expect(r.beat).toBe('none');
    expect(r.phase).toBe('dusk');
    expect(r.monthsPassed).toBe(0);
  });

  it('边界情况：未命中档「搜寻机缘」→ 1 时辰，不是 1 月', () => {
    const r = resolveActionClock({ ...base, actionText: '继续搜寻机缘' });
    expect(r.beat).toBe('none');
    expect(r.monthsPassed).toBe(0);
    expect(r.shichen).toBe(1);
  });

  it('边界情况：历练 → 1 月，日段落到 dusk', () => {
    const r = resolveActionClock({ ...base, actionText: '前往青岳山外历练' });
    expect(r.monthsPassed).toBe(1);
    expect(r.beat).toBe('none');
    expect(r.phase).toBe('dusk');
  });

  it('边界情况：交手 → 1 月', () => {
    const r = resolveActionClock({ ...base, actionText: '拔剑与他交手' });
    expect(r.monthsPassed).toBe(1);
  });

  it('边界情况：闭关走月数，日段重置 dawn、时辰归零，不采信模型月数', () => {
    const r = resolveActionClock({ ...base, beat: 'talk', phase: 'night', shichen: 2, actionText: '闭关十年', seclusionMonths: 120 });
    expect(r.monthsPassed).toBe(120);
    expect(r.beat).toBe('none');
    expect(r.phase).toBe('dawn');
    expect(r.shichen).toBe(0);
  });

  it('边界情况：炼制走配方月数，不动日段', () => {
    const r = resolveActionClock({ ...base, phase: 'noon', actionText: '炼制一炉聚气丹', craftMonths: 2 });
    expect(r.monthsPassed).toBe(2);
    expect(r.beat).toBe('none');
    expect(r.phase).toBe('noon');
  });

  it('边界情况：坊市开场词置 market（坊市优先于叙话）', () => {
    const r = resolveActionClock({ ...base, actionText: '去坊市逛逛坊市聊聊天', rollFn: () => 0 });
    expect(r.beat).toBe('market');
  });
});

describe('parseDayPhase / parseBeatScene（库列安全解析，未知值降级不 throw）', () => {
  it('正常路径：已知值原样返回', () => {
    expect(parseDayPhase('night')).toBe('night');
    expect(parseBeatScene('market')).toBe('market');
  });

  it('边界情况：未知值降级为 dawn / none，绝不 throw', () => {
    expect(parseDayPhase('子时')).toBe('dawn');
    expect(parseDayPhase(null)).toBe('dawn');
    expect(parseBeatScene('combat')).toBe('none');
    expect(parseBeatScene(undefined)).toBe('none');
  });
});

describe('describeDayPhase / describeShichen / pointedDayPhase（文案与点名日段）', () => {
  it('正常路径：日段文案', () => {
    expect(describeDayPhase('dawn')).toBe('晨');
    expect(describeDayPhase('noon')).toBe('午');
    expect(describeDayPhase('dusk')).toBe('晚');
    expect(describeDayPhase('night')).toBe('夜');
  });

  it('正常路径：时辰文案，0 应返回片刻', () => {
    expect(describeShichen(0)).toBe('片刻');
    expect(describeShichen(1)).toBe('一时辰');
    expect(describeShichen(3)).toBe('3时辰');
  });

  it('正常路径：点名「亥时动手」→ night；「午时」→ noon', () => {
    expect(pointedDayPhase('亥时动手偷营')).toBe('night');
    expect(pointedDayPhase('午时约见')).toBe('noon');
  });

  it('边界情况：未点名时辰返回 null（只锁叙事，不加钟）', () => {
    expect(pointedDayPhase('出门历练')).toBeNull();
  });
});
