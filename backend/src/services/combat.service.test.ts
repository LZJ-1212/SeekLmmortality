/** 修订：2026-09-05 14:51 +08 lzj — 夹伤、本场气血、击毙与逃走
 * 修订：2026-09-05 15:27 +08 lzj — 交手底数改攻防速，估伤不再参与结算
 */
import { describe, it, expect } from 'vitest';
import {
  getElementMultiplier,
  getBestElementMultiplier,
  resolveCombatModifiers,
  parseElementsFromSpiritualRoots,
  REALM_RANKS,
  clampCombatBaseDamage,
  encounterMaxHpForRank,
  describeEncounterWound,
  detectCombatFleeIntent,
  resolveCombatTurn,
  skirmishBaseDamage,
  enemyCombatStatsForRank,
  playerCombatStats,
  relativeSpeedIncomingMultiplier,
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

  it('边界情况：空串敌境当与炼气同阶，不秒杀', () => {
    const result = resolveCombatModifiers(withElements('炼气'), withElements(''));
    expect(result.outcome).toBe('normal');
    expect(result.realmGap).toBe(0);
  });

  it('边界情况：太上境不在表内，当与炼气同阶', () => {
    const result = resolveCombatModifiers(withElements('炼气'), withElements('太上境'));
    expect(result.outcome).toBe('normal');
    expect(result.realmGap).toBe(0);
  });

  it('失败/拒绝：金丹期多一个期字不认作金丹，不当秒杀炼气', () => {
    const result = resolveCombatModifiers(withElements('炼气'), withElements('金丹期'));
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

describe('clampCombatBaseDamage（历史夹紧函数仍可用）', () => {
  it('正常路径：10 与 40 原样通过', () => {
    expect(clampCombatBaseDamage(10)).toBe(10);
    expect(clampCombatBaseDamage(40)).toBe(40);
  });

  it('边界情况：负数与超上限分别夹到 0 与 40', () => {
    expect(clampCombatBaseDamage(-1)).toBe(0);
    expect(clampCombatBaseDamage(9999)).toBe(40);
  });

  it('失败/拒绝：非数字当 0', () => {
    expect(clampCombatBaseDamage(Number.NaN)).toBe(0);
    expect(clampCombatBaseDamage(undefined)).toBe(0);
    expect(clampCombatBaseDamage('剑气')).toBe(0);
  });
});

describe('encounterMaxHpForRank / describeEncounterWound（本场气血）', () => {
  it('正常路径：炼气 80、渡劫期 400', () => {
    expect(encounterMaxHpForRank(0)).toBe(80);
    expect(encounterMaxHpForRank(8)).toBe(400);
  });

  it('边界情况：越阶夹在 0～8', () => {
    expect(encounterMaxHpForRank(-3)).toBe(80);
    expect(encounterMaxHpForRank(99)).toBe(400);
  });

  it('正常路径：满血未伤、过半轻创、低血残、0 绝', () => {
    expect(describeEncounterWound(80, 80)).toBe('未伤');
    expect(describeEncounterWound(50, 80)).toBe('轻创');
    expect(describeEncounterWound(20, 80)).toBe('残');
    expect(describeEncounterWound(0, 80)).toBe('绝');
  });
});

describe('detectCombatFleeIntent（抽身）', () => {
  it('正常路径：逃走识别为脱身', () => {
    expect(detectCombatFleeIntent('我转身逃走')).toBe(true);
    expect(detectCombatFleeIntent('落荒而逃')).toBe(true);
  });

  it('失败/拒绝：挥剑不算逃走', () => {
    expect(detectCombatFleeIntent('拔剑斩向眼前妖兽')).toBe(false);
  });
});

describe('resolveCombatTurn（击毙归气血，不采信模型已死）', () => {
  const identity = { damage: 1, defense: 1 };

  it('正常路径：同境一击未死则续场，无视模型把 in_combat 写成 false', () => {
    const turn = resolveCombatTurn(
      {
        playerRealmMajor: '炼气',
        playerElements: [],
        actionText: '挥剑',
        sceneWasCombat: false,
        stored: null,
        ai: {
          inCombat: true,
          enemyName: '野狼',
          enemyRealmMajor: '炼气',
          baseDamageToPlayer: 10,
          baseDamageToEnemy: 30,
        },
      },
      identity,
    );
    expect(turn.kind).toBe('ongoing');
    expect(turn.nextInCombat).toBe(true);
    expect(turn.encounter?.hp).toBe(68);
    expect(turn.encounter?.maxHp).toBe(80);
    expect(turn.damageDealt).toBe(12);
  });

  it('正常路径：扣完本场气血则气绝，即使模型仍填交手', () => {
    const turn = resolveCombatTurn(
      {
        playerRealmMajor: '炼气',
        playerElements: [],
        actionText: '全力一击',
        sceneWasCombat: true,
        stored: { name: '野狼', realmMajor: '炼气', element: '', hp: 10, maxHp: 80 },
        ai: { inCombat: true, enemyRealmMajor: '大乘', baseDamageToPlayer: 10, baseDamageToEnemy: 40 },
      },
      identity,
    );
    expect(turn.kind).toBe('enemy_slain');
    expect(turn.nextInCombat).toBe(false);
    expect(turn.encounter).toBeNull();
    expect(turn.resolution?.realmGap).toBe(0);
  });

  it('正常路径：续场锁对手，模型乱报大乘不能秒杀炼气玩家', () => {
    const turn = resolveCombatTurn(
      {
        playerRealmMajor: '炼气',
        playerElements: [],
        actionText: '再斩一剑',
        sceneWasCombat: true,
        stored: { name: '野狼', realmMajor: '炼气', element: '', hp: 50, maxHp: 80 },
        ai: { inCombat: true, enemyRealmMajor: '大乘', baseDamageToPlayer: 10, baseDamageToEnemy: 10 },
      },
      identity,
    );
    expect(turn.kind).toBe('ongoing');
    expect(turn.playerSlainByRealm).toBe(false);
    expect(turn.encounter?.realmMajor).toBe('炼气');
  });

  it('核心场景：炼气对金丹仍秒杀玩家，逃走无效', () => {
    const turn = resolveCombatTurn(
      {
        playerRealmMajor: '炼气',
        playerElements: [],
        actionText: '逃走',
        sceneWasCombat: false,
        stored: null,
        ai: { inCombat: true, enemyName: '长老', enemyRealmMajor: '金丹', baseDamageToPlayer: 10, baseDamageToEnemy: 10 },
      },
      identity,
    );
    expect(turn.kind).toBe('enemy_instant_win');
    expect(turn.playerSlainByRealm).toBe(true);
    expect(turn.nextInCombat).toBe(false);
  });

  it('正常路径：同境逃走可脱身并清遭遇，仍可能挨打', () => {
    const turn = resolveCombatTurn(
      {
        playerRealmMajor: '炼气',
        playerElements: [],
        actionText: '我逃走',
        sceneWasCombat: true,
        stored: { name: '野狼', realmMajor: '炼气', element: '', hp: 50, maxHp: 80 },
        ai: { inCombat: true, baseDamageToPlayer: 10, baseDamageToEnemy: 10 },
      },
      identity,
    );
    expect(turn.kind).toBe('fled');
    expect(turn.nextInCombat).toBe(false);
    expect(turn.damageDealt).toBe(0);
    expect(turn.damageTakenIncoming).toBe(8);
  });

  it('失败/拒绝：无交手旗且无存档遭遇则不开战', () => {
    const turn = resolveCombatTurn(
      {
        playerRealmMajor: '炼气',
        playerElements: [],
        actionText: '看看天色',
        sceneWasCombat: false,
        stored: null,
        ai: { inCombat: false },
      },
      identity,
    );
    expect(turn.kind).toBe('none');
  });

  it('失败/拒绝：模型报 9999 点伤不参与结算，底数只认攻防', () => {
    const turn = resolveCombatTurn(
      {
        playerRealmMajor: '炼气',
        playerElements: [],
        actionText: '一拳',
        sceneWasCombat: false,
        stored: null,
        ai: {
          inCombat: true,
          enemyName: '野狼',
          enemyRealmMajor: '炼气',
          baseDamageToPlayer: 9999,
          baseDamageToEnemy: 9999,
        },
      },
      identity,
    );
    expect(turn.kind).toBe('ongoing');
    expect(turn.damageDealt).toBe(12);
    expect(turn.damageTakenIncoming).toBe(8);
    expect(turn.encounter?.hp).toBe(68);
  });

  it('正常路径：攻高于敌防则打出更重', () => {
    const turn = resolveCombatTurn(
      {
        playerRealmMajor: '炼气',
        playerElements: [],
        actionText: '全力',
        sceneWasCombat: false,
        stored: null,
        playerCombat: { attack: 15, defense: 10, speed: 10 },
        ai: { inCombat: true, enemyName: '野狼', enemyRealmMajor: '炼气' },
      },
      identity,
    );
    expect(turn.damageDealt).toBe(17);
  });
});

describe('交手攻防速（底数公式）', () => {
  it('正常路径：神识即攻、道心即防、遁速即速', () => {
    expect(playerCombatStats({ divineSense: 12, daoHeart: 8, speed: 11 })).toEqual({
      attack: 12, defense: 8, speed: 11,
    });
  });

  it('正常路径：炼气敌三维 8，金丹 12', () => {
    expect(enemyCombatStatsForRank(0).attack).toBe(8);
    expect(enemyCombatStatsForRank(2).defense).toBe(12);
  });

  it('正常路径：10 攻对 8 防底数 12', () => {
    expect(skirmishBaseDamage(10, 8)).toBe(12);
  });

  it('正常路径：己方遁速更高则承伤倍率小于 1', () => {
    expect(relativeSpeedIncomingMultiplier(15, 8)).toBeLessThan(1);
  });
});
