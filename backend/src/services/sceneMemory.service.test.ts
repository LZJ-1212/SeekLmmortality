import { describe, it, expect } from 'vitest';
import {
  buildSceneMemoryPrompt,
  detectPendingLeave,
  nextPendingScene,
  parsePendingScene,
  truncateNarrativeDigest,
  DIGEST_MAX_CODE_POINTS,
} from './sceneMemory.service';

describe('truncateNarrativeDigest（截断上一回叙事，最多 120 码位）', () => {
  it('正常路径：短于上限的原样返回', () => {
    expect(truncateNarrativeDigest('你救下了一位重伤老者')).toBe('你救下了一位重伤老者');
  });

  it('边界：空串得空串', () => {
    expect(truncateNarrativeDigest('')).toBe('');
  });

  it('边界：第 121 个码位被丢掉，只留 120', () => {
    const long = '修'.repeat(DIGEST_MAX_CODE_POINTS + 5);
    const result = truncateNarrativeDigest(long);
    expect(Array.from(result).length).toBe(DIGEST_MAX_CODE_POINTS);
    expect(result).toBe('修'.repeat(DIGEST_MAX_CODE_POINTS));
  });

  it('边界：按码位截断不拆半个 emoji（代理对按 1 码位计）', () => {
    const text = '🙏'.repeat(DIGEST_MAX_CODE_POINTS) + '龙';
    const result = truncateNarrativeDigest(text);
    expect(Array.from(result).length).toBe(DIGEST_MAX_CODE_POINTS);
    expect(result.endsWith('龙')).toBe(false);
  });
});

describe('parsePendingScene（未知值当 none，不抛）', () => {
  it('正常路径：合法值原样保留', () => {
    expect(parsePendingScene('wounded_expert')).toBe('wounded_expert');
    expect(parsePendingScene('secret_realm')).toBe('secret_realm');
    expect(parsePendingScene('none')).toBe('none');
  });

  it('边界：未知值（combat/乱串/null/undefined）一律降级 none', () => {
    expect(parsePendingScene('combat')).toBe('none');
    expect(parsePendingScene('随便写的')).toBe('none');
    expect(parsePendingScene(null)).toBe('none');
    expect(parsePendingScene(undefined)).toBe('none');
  });
});

describe('detectPendingLeave（离开未收束场景，明文子串，禁止正则/模型）', () => {
  it('核心场景：救完人写「继续前行，搜寻机缘」不算离开', () => {
    expect(detectPendingLeave('继续前行，搜寻机缘', 'wounded_expert')).toBe(false);
    expect(detectPendingLeave('前行，另寻他处', 'wounded_expert')).toBe(false);
  });

  it('核心场景：弃之不顾 / 转身离去命中离开词', () => {
    expect(detectPendingLeave('弃之不顾，转身离去', 'wounded_expert')).toBe(true);
  });

  it('正常路径：闭关 / 回府 / 离开此地都算离开', () => {
    expect(detectPendingLeave('我闭关修炼去了', 'wounded_expert')).toBe(true);
    expect(detectPendingLeave('就此别过，回府歇息', 'secret_realm')).toBe(true);
    expect(detectPendingLeave('离开此地，另寻机缘', 'wounded_expert')).toBe(true);
  });

  it('边界：pending 为 none 时任何句都不判离开', () => {
    expect(detectPendingLeave('闭关', 'none')).toBe(false);
  });

  it('边界：空串不是离开', () => {
    expect(detectPendingLeave('', 'wounded_expert')).toBe(false);
  });
});

describe('nextPendingScene（成功落库后写回的 pending_scene）', () => {
  it('核心场景：本回合探索骰触发重伤大能，覆盖旧 pending', () => {
    expect(nextPendingScene({ pending: 'none', encounterType: 'wounded_expert', action: '出门历练', leave: false })).toBe('wounded_expert');
  });

  it('核心场景：pending 未收束且未离开，保持原状（下一句仍是同一场）', () => {
    expect(nextPendingScene({ pending: 'wounded_expert', encounterType: 'none', action: '继续前行，搜寻机缘', leave: false })).toBe('wounded_expert');
  });

  it('核心场景：离开后清 none', () => {
    expect(nextPendingScene({ pending: 'wounded_expert', encounterType: 'none', action: '弃之不顾，转身离去', leave: true })).toBe('none');
  });

  it('秘境了结：进入/放弃秘境都清 secret_realm（即使 leave 为 false）', () => {
    expect(nextPendingScene({ pending: 'secret_realm', encounterType: 'none', action: '踏入秘境', leave: false })).toBe('none');
    expect(nextPendingScene({ pending: 'secret_realm', encounterType: 'none', action: '放弃秘境', leave: false })).toBe('none');
  });

  it('边界：无 pending 且无触发，仍是 none', () => {
    expect(nextPendingScene({ pending: 'none', encounterType: 'none', action: '再刺一剑', leave: false })).toBe('none');
  });
});

describe('buildSceneMemoryPrompt（注入块，与 A5 forcedOutcome 分段）', () => {
  it('边界：无 digest 的第一动含「上一回：无」，且没有未收束句', () => {
    const prompt = buildSceneMemoryPrompt('', 'none');
    expect(prompt).toContain('上一回：无');
    expect(prompt).not.toContain('未收束');
  });

  it('正常路径：写入 digest 后下一动含该截断句，不是空白', () => {
    const prompt = buildSceneMemoryPrompt('你救下一位重伤老者', 'none');
    expect(prompt).toContain('你救下一位重伤老者');
    expect(prompt).not.toContain('上一回：无');
  });

  it('核心场景：wounded_expert 注入块含「禁止另开」', () => {
    const prompt = buildSceneMemoryPrompt('你救下一位重伤老者', 'wounded_expert');
    expect(prompt).toContain('禁止另开');
    expect(prompt).toContain('未收束');
  });

  it('核心场景：secret_realm 注入块点明秘境未决', () => {
    const prompt = buildSceneMemoryPrompt('秘境轰然现世', 'secret_realm');
    expect(prompt).toContain('秘境仍在眼前未决');
  });

  it('核心场景：pending 为 none（如「再刺一剑」）不插入未收束句', () => {
    const prompt = buildSceneMemoryPrompt('你与妖狼缠斗', 'none');
    expect(prompt).not.toContain('未收束');
  });

  it('不调用第二次 LLM：拼接是同步纯字符串，不产生网络/模型调用', () => {
    const prompt = buildSceneMemoryPrompt('上一回', 'wounded_expert');
    expect(typeof prompt).toBe('string');
    expect(prompt.startsWith('【近事】')).toBe(true);
  });
});
