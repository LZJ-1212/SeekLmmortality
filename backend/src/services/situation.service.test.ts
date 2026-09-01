import { describe, it, expect } from 'vitest';
import {
  detectActionIntent,
  evaluateSituation,
  nextSceneContext,
  parseSceneContext,
} from './situation.service';

describe('detectActionIntent（从玩家输入识别硬结算意图）', () => {
  it('正常路径：闭关修炼识别为 seclusion', () => {
    expect(detectActionIntent('闭关修炼')).toBe('seclusion');
    expect(detectActionIntent('我要找个洞府闭关十年')).toBe('seclusion');
  });

  it('正常路径：挥剑交手为 other，不误伤', () => {
    expect(detectActionIntent('拔剑斩向眼前妖兽')).toBe('other');
  });

  it('边界：空串为 other', () => {
    expect(detectActionIntent('')).toBe('other');
  });
});

describe('evaluateSituation（交手中禁止抽身闭关）', () => {
  it('正常路径：无交手情境时闭关放行', () => {
    expect(evaluateSituation('none', '闭关修炼')).toEqual({ ok: true });
  });

  it('失败/拒绝：交手中输入闭关修炼应拒绝且给出入定文案', () => {
    const r = evaluateSituation('combat', '闭关修炼');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('刀剑未歇，岂能盘膝入定。');
  });

  it('失败/拒绝：交手中前往坊市应拒绝', () => {
    const r = evaluateSituation('combat', '前往坊市');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('坊市');
  });

  it('正常路径：交手中继续砍杀放行', () => {
    expect(evaluateSituation('combat', '侧身避让再刺一剑')).toEqual({ ok: true });
  });
});

describe('parseSceneContext / nextSceneContext', () => {
  it('边界：未知库值按 none', () => {
    expect(parseSceneContext('zzz')).toBe('none');
    expect(parseSceneContext(null)).toBe('none');
  });

  it('正常路径：交手未死则下一情境仍是 combat', () => {
    expect(nextSceneContext({ inCombat: true, isDead: false })).toBe('combat');
  });

  it('边界：死亡后清情境', () => {
    expect(nextSceneContext({ inCombat: true, isDead: true })).toBe('none');
  });
});
