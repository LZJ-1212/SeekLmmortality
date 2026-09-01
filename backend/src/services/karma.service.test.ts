import { describe, it, expect } from 'vitest';
import {
  resolveKarmaRetribution,
  clampMeritDelta,
  clampKarmaDelta,
  MAX_MERIT_DELTA_PER_ACTION,
  MAX_KARMA_DELTA_PER_ACTION,
} from './karma.service';

describe('clampMeritDelta / clampKarmaDelta（防止 AI 一次性给出离谱的功德/业力增量）', () => {
  it('正常路径：范围内的数值原样保留', () => {
    expect(clampMeritDelta(10)).toBe(10);
    expect(clampKarmaDelta(-5)).toBe(-5);
  });

  it('边界情况：超出上限的数值应被夹紧', () => {
    expect(clampMeritDelta(9999)).toBe(MAX_MERIT_DELTA_PER_ACTION);
    expect(clampMeritDelta(-9999)).toBe(-MAX_MERIT_DELTA_PER_ACTION);
    expect(clampKarmaDelta(9999)).toBe(MAX_KARMA_DELTA_PER_ACTION);
    expect(clampKarmaDelta(-9999)).toBe(-MAX_KARMA_DELTA_PER_ACTION);
  });
});

describe('resolveKarmaRetribution（业力天罚——"捷径往往伴随代价"的真实机制）', () => {
  const baseInput = { hp: 100, maxHp: 100, cultivation: 1000 };

  it('正常路径：业力很低时，无论骰子结果如何都不应触发天罚', () => {
    const result = resolveKarmaRetribution(
      { ...baseInput, karma: 10, merit: 0 },
      { triggerRoll: () => 0 }, // 骰子给到最容易触发的值
    );
    expect(result.triggered).toBe(false);
    expect(result.patch.hp).toBe(100);
  });

  it('核心场景：业力达到"小天罚"门槛且命中概率时，应扣减气血', () => {
    const result = resolveKarmaRetribution(
      { ...baseInput, karma: 60, merit: 0 },
      { triggerRoll: () => 0 }, // 0 <= 任何门槛的触发概率，必定命中
    );
    expect(result.triggered).toBe(true);
    expect(result.tier).toBe('小天罚');
    expect(result.fatal).toBe(false);
    expect(result.patch.hp).toBe(88); // 100 - round(100*0.12=12)
  });

  it('边界情况：命中触发判定但骰子没有落在触发概率区间内时，不应触发', () => {
    const result = resolveKarmaRetribution(
      { ...baseInput, karma: 60, merit: 0 },
      { triggerRoll: () => 0.99 }, // 远超小天罚 3% 的触发概率
    );
    expect(result.triggered).toBe(false);
  });

  it('正常路径：功德可以抵消业力（每 1 点功德抵 0.5 点业力），足够的功德能让原本会触发天罚的业力值降到安全区间', () => {
    // karma=60, merit=100 -> effectiveKarma = max(0, 60 - 50) = 10，低于最低门槛 50
    const result = resolveKarmaRetribution(
      { ...baseInput, karma: 60, merit: 100 },
      { triggerRoll: () => 0 },
    );
    expect(result.triggered).toBe(false);
  });

  it('核心场景：业力达到"大天罚"门槛时，伤害应显著提升且伴随修为损失', () => {
    const result = resolveKarmaRetribution(
      { ...baseInput, karma: 500, merit: 0 },
      { triggerRoll: () => 0 },
    );
    expect(result.triggered).toBe(true);
    expect(result.tier).toBe('大天罚');
    expect(result.patch.hp).toBe(60); // 100 - round(100*0.4=40)
    expect(result.patch.cultivation).toBe(850); // 1000 - round(1000*0.15=150)
  });

  it('核心场景（九死一生的因果对应）：业力达到"灭顶天罚"门槛且命中致命判定时，应直接陨落（气血归零）', () => {
    const result = resolveKarmaRetribution(
      { ...baseInput, karma: 900, merit: 0 },
      { triggerRoll: () => 0, fatalRoll: () => 0 }, // 先命中触发，再命中 25% 的致命判定
    );
    expect(result.triggered).toBe(true);
    expect(result.fatal).toBe(true);
    expect(result.patch.hp).toBe(0);
  });

  it('边界情况：灭顶天罚触发但未命中致命判定时，应退化为大额但非致命的重创', () => {
    const result = resolveKarmaRetribution(
      { ...baseInput, karma: 900, merit: 0 },
      { triggerRoll: () => 0, fatalRoll: () => 0.99 }, // 触发天罚，但没有命中致命判定
    );
    expect(result.triggered).toBe(true);
    expect(result.fatal).toBe(false);
    expect(result.patch.hp).toBe(40); // 100 - round(100*0.6=60)
  });

  it('边界情况：气血扣减不会变成负数（哪怕造成的伤害远超当前气血）', () => {
    const result = resolveKarmaRetribution(
      { hp: 5, maxHp: 100, cultivation: 3, karma: 500, merit: 0 },
      { triggerRoll: () => 0 },
    );
    expect(result.patch.hp).toBe(0);
    expect(result.patch.cultivation).toBeGreaterThanOrEqual(0);
  });
});
