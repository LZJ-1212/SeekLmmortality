import { describe, it, expect } from 'vitest';
import { assertCreatePlayerBody } from './createPlayerLimits';

function validBody() {
  return {
    name: '云逸',
    gender: '男',
    attributes: { aptitude: 10 },
    roots: ['木', '火'],
    origin: '农家子',
    daoPursuit: '问道飞升',
    constitution: '凡体',
    talents: ['天资聪颖'],
  };
}

describe('assertCreatePlayerBody（创角字段长度上限，超限 400 不写库）', () => {
  it('正常路径：合法创角体通过', () => {
    expect(assertCreatePlayerBody(validBody())).toEqual({ ok: true });
  });

  it('边界：name 恰好 16 字通过', () => {
    expect(assertCreatePlayerBody({ ...validBody(), name: '道'.repeat(16) }).ok).toBe(true);
  });

  it('边界：name 17 字失败', () => {
    const result = assertCreatePlayerBody({ ...validBody(), name: '道'.repeat(17) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('尊名');
  });

  it('边界：空 name 拒绝', () => {
    expect(assertCreatePlayerBody({ ...validBody(), name: '' }).ok).toBe(false);
  });

  it('边界：roots 超 5 项、talents 超 8 项均拒绝', () => {
    expect(assertCreatePlayerBody({ ...validBody(), roots: ['金', '木', '水', '火', '土', '雷'] }).ok).toBe(false);
    expect(assertCreatePlayerBody({ ...validBody(), talents: Array.from({ length: 9 }, (_, i) => `天赋${i}`) }).ok).toBe(false);
  });

  it('失败/拒绝：出身超 24 字拒绝', () => {
    expect(assertCreatePlayerBody({ ...validBody(), origin: '甲'.repeat(25) }).ok).toBe(false);
  });

  it('失败/拒绝：非对象体（null）也安全返回拒绝', () => {
    expect(assertCreatePlayerBody(null).ok).toBe(false);
    expect(assertCreatePlayerBody(undefined).ok).toBe(false);
  });

  it('失败/拒绝：缺灵根数组不得进创角写库（会 500 的路径）', () => {
    const { roots: _omit, ...withoutRoots } = validBody();
    expect(assertCreatePlayerBody(withoutRoots).ok).toBe(false);
    expect(assertCreatePlayerBody({ ...validBody(), roots: [] }).ok).toBe(false);
  });
});
