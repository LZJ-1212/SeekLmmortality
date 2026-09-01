import { describe, it, expect } from 'vitest';
import {
  getElementMultiplier,
  getBestElementMultiplier,
  resolveCombatModifiers,
  parseElementsFromSpiritualRoots,
  REALM_RANKS,
  type CombatParticipant,
} from './combat.service';

describe('getElementMultiplier（五行相生相克的单元素倍率）', () => {
  it('正常路径：相同元素应中立无加成', () => {
    expect(getElementMultiplier('火', '火')).toBe(1);
  });

  it('正常路径：五行相克应有攻击加成（木克土、火克金、水克火、金克木、土克水）', () => {
    expect(getElementMultiplier('木', '土')).toBeGreaterThan(1);
    expect(getElementMultiplier('火', '金')).toBeGreaterThan(1);
    expect(getElementMultiplier('水', '火')).toBeGreaterThan(1);
    expect(getElementMultiplier('金', '木')).toBeGreaterThan(1);
    expect(getElementMultiplier('土', '水')).toBeGreaterThan(1);
  });

  it('正常路径：被对方克制应有攻击减益（互为相反关系）', () => {
    expect(getElementMultiplier('土', '木')).toBeLessThan(1); // 木克土，土被克
    expect(getElementMultiplier('金', '火')).toBeLessThan(1); // 火克金，金被克
  });

  it('正常路径：五行相生（我方滋养对方）应有轻微减益', () => {
    expect(getElementMultiplier('木', '火')).toBeLessThan(1); // 木生火
    expect(getElementMultiplier('木', '火')).toBeGreaterThan(0.5);
  });

  it('正常路径：被对方滋养（借力打力）应有轻微加成', () => {
    expect(getElementMultiplier('火', '木')).toBeGreaterThan(1); // 木生火，火借木之力
    expect(getElementMultiplier('火', '木')).toBeLessThan(1.3); // 但不应超过"相克"的加成幅度
  });

  it('边界情况：任意一方不是标准五行（如凶兽无属性/数据缺失）应视为中立', () => {
    expect(getElementMultiplier('无属性', '火')).toBe(1);
    expect(getElementMultiplier('火', '')).toBe(1);
    expect(getElementMultiplier('', '')).toBe(1);
  });
});

describe('getBestElementMultiplier（多灵根属性时取最有利组合）', () => {
  it('正常路径：多属性灵根应挑选对敌方最有利的那个属性出手', () => {
    // 木火双灵根 vs 土属性敌人：木克土（加成），火生土（减益）——应该选克制更有利的"木"
    const multiplier = getBestElementMultiplier(['木', '火'], ['土']);
    expect(multiplier).toBeGreaterThan(1);
  });

  it('边界情况：没有五行属性的一方（空数组）应退化为中立倍率 1', () => {
    expect(getBestElementMultiplier([], ['火'])).toBe(1);
    expect(getBestElementMultiplier(['火'], [])).toBe(1);
    expect(getBestElementMultiplier([], [])).toBe(1);
  });
});

describe('resolveCombatModifiers（境界压制 + 五行相克的综合战斗结算，“绝非龙傲天”）', () => {
  const withElements = (realmMajor: string, elements: string[] = []): CombatParticipant => ({ realmMajor, elements });

  it('核心场景：敌人境界高出玩家两个大境界及以上，应直接判定敌人碾压获胜（秒杀），不再计算五行', () => {
    const result = resolveCombatModifiers(withElements('炼气'), withElements('金丹'));
    expect(result.outcome).toBe('enemy_instant_win');
    expect(result.playerDamageMultiplier).toBe(0);
    expect(result.enemyDamageMultiplier).toBe(1);
  });

  it('核心场景：玩家境界高出敌人两个大境界及以上，应直接判定玩家碾压获胜', () => {
    const result = resolveCombatModifiers(withElements('金丹'), withElements('炼气'));
    expect(result.outcome).toBe('player_instant_win');
    expect(result.playerDamageMultiplier).toBe(1);
    expect(result.enemyDamageMultiplier).toBe(0);
  });

  it('核心场景（"绝非龙傲天"）：敌人境界高出玩家一个大境界时，玩家伤害应被压制到四成左右，绝不能轻易反杀', () => {
    const result = resolveCombatModifiers(withElements('炼气'), withElements('筑基'));
    expect(result.outcome).toBe('normal');
    expect(result.playerDamageMultiplier).toBeCloseTo(0.4);
    expect(result.enemyDamageMultiplier).toBeCloseTo(1);
  });

  it('正常路径：玩家境界高出敌人一个大境界时，应占据攻守两端的压倒性优势', () => {
    const result = resolveCombatModifiers(withElements('筑基'), withElements('炼气'));
    expect(result.outcome).toBe('normal');
    expect(result.playerDamageMultiplier).toBeCloseTo(1.5);
    expect(result.enemyDamageMultiplier).toBeCloseTo(0.5);
  });

  it('正常路径：同境界时，境界压制不产生任何倍率影响，只剩五行加成', () => {
    const result = resolveCombatModifiers(withElements('炼气'), withElements('炼气'));
    expect(result.outcome).toBe('normal');
    expect(result.playerDamageMultiplier).toBe(1);
    expect(result.enemyDamageMultiplier).toBe(1);
  });

  it('核心场景：五行相克应叠加在境界压制之上（同境界 + 玩家克制敌人）', () => {
    const result = resolveCombatModifiers(withElements('炼气', ['木']), withElements('炼气', ['土']));
    expect(result.playerDamageMultiplier).toBeGreaterThan(1); // 木克土，同境界下应有明显加成
    expect(result.enemyDamageMultiplier).toBeLessThan(1); // 敌人被克制，反过来打玩家也吃亏
  });

  it('边界情况：境界名称未知（AI 瞎编或数据缺失）时应默认视为同级，不产生莫名其妙的碾压', () => {
    const result = resolveCombatModifiers(withElements('未知境界'), withElements('炼气'));
    expect(result.outcome).toBe('normal');
    expect(result.realmGap).toBe(0);
  });

  it('健全性检查：REALM_RANKS 应按境界由低到高严格递增排列', () => {
    const order = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫期'];
    for (let i = 1; i < order.length; i++) {
      expect(REALM_RANKS[order[i]!]).toBeGreaterThan(REALM_RANKS[order[i - 1]!]!);
    }
  });
});

describe('parseElementsFromSpiritualRoots（安全解析玩家灵根五行属性）', () => {
  it('正常路径：合法 JSON 字符串应正确解析出 elements 数组', () => {
    expect(parseElementsFromSpiritualRoots('{"quality":"地灵根","elements":["木","火"]}')).toEqual(['木', '火']);
  });

  it('正常路径：传入已经是对象（未序列化）时也应正确解析', () => {
    expect(parseElementsFromSpiritualRoots({ quality: '天灵根', elements: ['水'] })).toEqual(['水']);
  });

  it('边界情况：JSON 格式错误时应安全退化为空数组，不抛出异常', () => {
    expect(parseElementsFromSpiritualRoots('这不是JSON')).toEqual([]);
  });

  it('边界情况：elements 字段缺失或类型错误时应安全退化为空数组', () => {
    expect(parseElementsFromSpiritualRoots('{"quality":"伪灵根"}')).toEqual([]);
    expect(parseElementsFromSpiritualRoots('{"elements":"木"}')).toEqual([]);
  });

  it('边界情况：null/undefined 输入应安全退化为空数组', () => {
    expect(parseElementsFromSpiritualRoots(null)).toEqual([]);
    expect(parseElementsFromSpiritualRoots(undefined)).toEqual([]);
  });
});
