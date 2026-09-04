/** 修订：2026-09-05 01:11 +08 lzj — 存档仓可见性单测 */
import { describe, it, expect } from 'vitest';
import { canAccessSave } from './saveAccess.service';

describe('canAccessSave（按口令仓隔离存档）', () => {
  it('正常路径：本机未带头可见任意档', () => {
    expect(canAccessSave('abc', null)).toBe(true);
    expect(canAccessSave(null, null)).toBe(true);
  });

  it('正常路径：口令仓只看见哈希相同的档', () => {
    expect(canAccessSave('aaa', 'aaa')).toBe(true);
  });

  it('失败/拒绝：别人的仓或旧档空哈希，公网口令看不见', () => {
    expect(canAccessSave('aaa', 'bbb')).toBe(false);
    expect(canAccessSave(null, 'bbb')).toBe(false);
  });
});
