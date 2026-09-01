import { MAX_ACTION_CHARS } from './constants';
import type { SanitizeResult } from './types';

/** 允许的空白：空格、制表、换行、回车。其余 C0 控制符与 DEL 视为非法不可见字符。 */
function isBadChar(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false; // \t \n \r
  if (code >= 0x00 && code <= 0x1f) return true; // 其余控制符
  if (code === 0x7f) return true; // DEL
  if (code === 0x2028 || code === 0x2029) return true; // 行/段分隔符
  return false;
}

function containsBadChars(text: string): boolean {
  for (const ch of text) {
    if (isBadChar(ch.codePointAt(0) ?? 0)) return true;
  }
  return false;
}

/**
 * 行动文本净化：空串、非法不可见字符、超长一律拒绝，不静默截断（避免玩家以为指令发全了）。
 * 长度按 Unicode 码位计（中文 1 字 = 1 码位）。
 */
export function sanitizeAction(raw: unknown): SanitizeResult {
  if (typeof raw !== 'string') return { ok: false, code: 'empty' };
  const text = raw.trim();
  if (text.length === 0) return { ok: false, code: 'empty' };
  if (containsBadChars(text)) return { ok: false, code: 'bad_chars' };
  if (Array.from(text).length > MAX_ACTION_CHARS) return { ok: false, code: 'too_long' };
  return { ok: true, text };
}
