/** 修订：2026-09-05 01:39 +08 lzj — 版本号解析单测 */
import { describe, it, expect } from 'vitest';
import { parseGameVersionText } from './gameVersion';

describe('parseGameVersionText（游玩版本号）', () => {
  it('正常路径：单行 x.y.z', () => {
    expect(parseGameVersionText('0.2.0\n')).toBe('0.2.0');
  });

  it('边界：允许注释与空行，取第一行数字版本', () => {
    expect(parseGameVersionText('# 说明\n\n1.0.0\n')).toBe('1.0.0');
  });

  it('失败/拒绝：空文件或非三段数字则 0.0.0', () => {
    expect(parseGameVersionText('')).toBe('0.0.0');
    expect(parseGameVersionText('v1')).toBe('0.0.0');
  });
});
