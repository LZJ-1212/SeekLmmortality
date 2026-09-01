import { describe, it, expect } from 'vitest';
import {
  getMaxLifespanForRealm,
  getNpcCurrentAge,
  isNpcLifespanExhausted,
  calculateBirthYear,
  clampAffinityDelta,
  MAX_AFFINITY_DELTA_PER_ACTION,
  isDualCultivationAttempt,
  resolveDualCultivation,
  MIN_AFFINITY_FOR_DUAL_CULTIVATION,
  buildDeceasedFriendNotice,
} from './npc.service';

describe('getMaxLifespanForRealm（NPC 寿元上限与境界一一对应，规则与玩家一致）', () => {
  it('正常路径：境界越高寿元上限越高，严格递增', () => {
    const order = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫期'];
    for (let i = 1; i < order.length; i++) {
      expect(getMaxLifespanForRealm(order[i]!)).toBeGreaterThan(getMaxLifespanForRealm(order[i - 1]!));
    }
  });

  it('边界情况：未知境界名应退化为凡人寿元（100 岁），不给异常长寿', () => {
    expect(getMaxLifespanForRealm('未知境界')).toBe(100);
  });
});

describe('getNpcCurrentAge / calculateBirthYear（NPC 年龄由世界年份推算，无需逐回合更新）', () => {
  it('正常路径：当前年龄 = 世界年份 - 出生年份', () => {
    expect(getNpcCurrentAge(500, 470)).toBe(30);
  });

  it('边界情况：计算结果为负数时应夹到 0（防止脏数据导致年龄为负）', () => {
    expect(getNpcCurrentAge(400, 470)).toBe(0);
  });

  it('正常路径：calculateBirthYear 与 getNpcCurrentAge 应该互为逆运算', () => {
    const birthYear = calculateBirthYear(500, 30);
    expect(getNpcCurrentAge(500, birthYear)).toBe(30);
  });
});

describe('isNpcLifespanExhausted（NPC 寿元耗尽判定，规则与玩家一致）', () => {
  it('正常路径：年龄超过寿元上限应判定耗尽', () => {
    expect(isNpcLifespanExhausted(600, 470, 100)).toBe(true); // 年龄130 > 100
  });

  it('边界情况：年龄恰好等于寿元上限时不应判定耗尽（严格大于才算耗尽，与玩家规则一致）', () => {
    expect(isNpcLifespanExhausted(570, 470, 100)).toBe(false); // 年龄恰好100
  });

  it('正常路径：年龄远小于寿元上限时不应判定耗尽', () => {
    expect(isNpcLifespanExhausted(500, 470, 100)).toBe(false);
  });
});

describe('clampAffinityDelta（防止 AI 一次性给出离谱的好感度增量）', () => {
  it('正常路径：范围内的数值原样保留', () => {
    expect(clampAffinityDelta(10)).toBe(10);
  });

  it('边界情况：超出上限的数值应被夹紧', () => {
    expect(clampAffinityDelta(9999)).toBe(MAX_AFFINITY_DELTA_PER_ACTION);
    expect(clampAffinityDelta(-9999)).toBe(-MAX_AFFINITY_DELTA_PER_ACTION);
  });
});

describe('isDualCultivationAttempt（识别双修行动）', () => {
  it('正常路径：提到"双修"应判定为真', () => {
    expect(isDualCultivationAttempt('与道侣双修，增进感情')).toBe(true);
  });

  it('边界情况：普通行动不应误判', () => {
    expect(isDualCultivationAttempt('与朋友一起喝茶聊天')).toBe(false);
    expect(isDualCultivationAttempt('')).toBe(false);
  });
});

describe('resolveDualCultivation（双修增益的确定性结算，全性向——不检查任何性别信息）', () => {
  it('异常路径：好感度不足门槛时应判定失败，不产生任何增益', () => {
    const result = resolveDualCultivation('无名道友', {
      affinity: MIN_AFFINITY_FOR_DUAL_CULTIVATION - 1,
      playerMaxHp: 100,
      playerMaxMp: 100,
    });
    expect(result.success).toBe(false);
    expect(result.cultivationBonus).toBe(0);
    expect(result.hpRestore).toBe(0);
    expect(result.mpRestore).toBe(0);
  });

  it('正常路径：好感度达到门槛时应产生正向增益', () => {
    const result = resolveDualCultivation('心上人', {
      affinity: 80,
      playerMaxHp: 200,
      playerMaxMp: 300,
    });
    expect(result.success).toBe(true);
    expect(result.cultivationBonus).toBe(40); // 80*0.5
    expect(result.hpRestore).toBe(40); // 200*0.2
    expect(result.mpRestore).toBe(90); // 300*0.3
  });

  it('正常路径：好感度越高，双修增益越显著', () => {
    const lowAffinity = resolveDualCultivation('甲', { affinity: 60, playerMaxHp: 100, playerMaxMp: 100 });
    const highAffinity = resolveDualCultivation('乙', { affinity: 100, playerMaxHp: 100, playerMaxMp: 100 });
    expect(highAffinity.cultivationBonus).toBeGreaterThan(lowAffinity.cultivationBonus);
  });

  it('健全性检查：函数签名/实现中不存在任何与性别相关的输入或分支（全性向）', () => {
    // resolveDualCultivation 的输入类型里没有 gender 字段，调用时不传性别也能正常工作
    const result = resolveDualCultivation('任意性别的道侣', { affinity: 100, playerMaxHp: 100, playerMaxMp: 100 });
    expect(result.success).toBe(true);
  });
});

describe('buildDeceasedFriendNotice（旧友寿元耗尽的传音符讯息）', () => {
  it('正常路径：应包含 NPC 姓名与关系类型', () => {
    const notice = buildDeceasedFriendNotice('张三', '挚友');
    expect(notice).toContain('张三');
    expect(notice).toContain('挚友');
    expect(notice).toContain('传音符');
  });

  it('边界情况：关系类型缺失时应有兜底文案，不崩溃', () => {
    const notice = buildDeceasedFriendNotice('李四', null);
    expect(notice).toContain('旧友');
  });
});
