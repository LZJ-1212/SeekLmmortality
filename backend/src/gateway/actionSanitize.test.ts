import { describe, it, expect } from 'vitest';
import { sanitizeAction } from './actionSanitize';

describe('sanitizeAction（空串/非法字符/超长拒绝，不静默截断）', () => {
  it('正常路径：合法行动返回净化后文本', () => {
    const result = sanitizeAction('  闭关修炼  ');
    expect(result).toEqual({ ok: true, text: '闭关修炼' });
  });

  it('正常路径：恰好 200 码位通过', () => {
    const text = '修'.repeat(200);
    const result = sanitizeAction(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text.length).toBe(200);
  });

  it('边界：空串与纯空白拒绝', () => {
    expect(sanitizeAction('')).toEqual({ ok: false, code: 'empty' });
    expect(sanitizeAction('   ')).toEqual({ ok: false, code: 'empty' });
    expect(sanitizeAction(null)).toEqual({ ok: false, code: 'empty' });
    expect(sanitizeAction(123)).toEqual({ ok: false, code: 'empty' });
  });

  it('边界：201 码位拒绝', () => {
    expect(sanitizeAction('修'.repeat(201))).toEqual({ ok: false, code: 'too_long' });
  });

  it('失败/拒绝：嵌入 NUL 等不可见控制符拒绝', () => {
    expect(sanitizeAction('闭关\u0000修炼')).toEqual({ ok: false, code: 'bad_chars' });
    expect(sanitizeAction('闭关\u0007修炼')).toEqual({ ok: false, code: 'bad_chars' });
  });
});
