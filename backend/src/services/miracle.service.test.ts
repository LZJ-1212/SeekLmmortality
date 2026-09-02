import { describe, it, expect } from 'vitest';
import {
  detectMiracleClaim,
  calculateMiracleChance,
  rollMiracle,
  MAX_MIRACLE_CHANCE_PERCENT,
  MIN_MIRACLE_CHANCE_PERCENT,
  BASE_MIRACLE_CHANCE_PERCENT,
} from './miracle.service';

describe('detectMiracleClaim（封闭意图表，明文子串，禁止正则/模型分类）', () => {
  it('正常路径：捡神器反杀应命中 loot 或 reversal 之一', () => {
    const claim = detectMiracleClaim('我发现绝世武器，反杀了那个仇敌');
    expect(claim).not.toBeNull();
  });

  it('核心场景：一句命中多条时按优先级取最狂的宣称（秒杀 > 捡神器 > 反杀）', () => {
    expect(detectMiracleClaim('捡到剑，一招毙命反杀对方')?.id).toBe('miracle_instant_kill');
    expect(detectMiracleClaim('捡到剑反杀对方')?.id).toBe('miracle_loot');
    expect(detectMiracleClaim('绝地逢生，反杀了他')?.id).toBe('miracle_reversal');
  });

  it('正常路径：普通战斗句不掷本骰（再刺一剑不是宣称）', () => {
    expect(detectMiracleClaim('再刺一剑，砍向妖狼')).toBeNull();
  });

  it('边界：空串不命中', () => {
    expect(detectMiracleClaim('')).toBeNull();
  });

  it('边界：写诗/胡话不命中', () => {
    expect(detectMiracleClaim('我变成一只鸡，咯咯叫')).toBeNull();
  });

  it('边界：闭关句里的「反杀」二字不误伤——闭关走情境锁/闭关拦截器，不进本骰', () => {
    // 本函数只看子串，是否会误命中交由调用顺序保证（A5 在闭关拦截器之后）；
    // 这里只验证子串确实命中，调用顺序另在 ActionService 内把关。
    expect(detectMiracleClaim('闭关修炼，待出关后反杀仇敌')?.id).toBe('miracle_reversal');
  });
});

describe('calculateMiracleChance（仙缘换算奇迹骰概率）', () => {
  it('正常路径：仙缘基准值(10)时为基础概率', () => {
    expect(calculateMiracleChance(10)).toBe(BASE_MIRACLE_CHANCE_PERCENT);
  });

  it('核心场景：仙缘越高，概率越高', () => {
    expect(calculateMiracleChance(15)).toBeGreaterThan(calculateMiracleChance(10));
  });

  it('边界：概率封顶，仙缘极高也不超过上限', () => {
    expect(calculateMiracleChance(9999)).toBe(MAX_MIRACLE_CHANCE_PERCENT);
  });

  it('边界：概率不低于下限，仙缘极低也不低于 1', () => {
    expect(calculateMiracleChance(-9999)).toBe(MIN_MIRACLE_CHANCE_PERCENT);
  });
});

describe('rollMiracle（1d100 仙缘奇迹骰，成功也不发物品/不改伤害）', () => {
  it('核心场景：骰子落在门槛内时触发（rollFn 注入 0 → 1d100=1）', () => {
    const result = rollMiracle(15, { id: 'miracle_reversal' }, () => 0);
    expect(result.triggered).toBe(true);
    expect(result.roll).toBe(1);
  });

  it('核心场景：骰子超过门槛时不触发（rollFn 注入 0.99 → 1d100=100）', () => {
    const result = rollMiracle(10, { id: 'miracle_reversal' }, () => 0.99);
    expect(result.triggered).toBe(false);
    expect(result.roll).toBe(100);
  });

  it('成功文案：强调胜负仍以境界压制为准，不得发神兵或改数值', () => {
    const result = rollMiracle(15, { id: 'miracle_loot' }, () => 0);
    expect(result.triggered).toBe(true);
    expect(result.forcedOutcomeText).toContain('境界压制');
    expect(result.forcedOutcomeText).not.toContain('神兵天降');
  });

  it('失败文案：捡神器失败应写成断刃顽石、并无神兵天降', () => {
    const result = rollMiracle(10, { id: 'miracle_loot' }, () => 0.99);
    expect(result.forcedOutcomeText).toContain('断刃顽石');
    expect(result.forcedOutcomeText).toContain('并无神兵天降');
  });

  it('失败文案：反杀/秒杀失败应写成妄念落空、不得改变战局', () => {
    const result = rollMiracle(10, { id: 'miracle_instant_kill' }, () => 0.99);
    expect(result.triggered).toBe(false);
    expect(result.forcedOutcomeText).toContain('妄念落空');
    expect(result.forcedOutcomeText).toContain('不得让这一击改变战局');
  });

  it('边界：1d100 结果始终落在 1~100 范围', () => {
    const minRoll = rollMiracle(10, { id: 'miracle_reversal' }, () => 0);
    const maxRoll = rollMiracle(10, { id: 'miracle_reversal' }, () => 0.999999);
    expect(minRoll.roll).toBe(1);
    expect(maxRoll.roll).toBe(100);
  });
});
