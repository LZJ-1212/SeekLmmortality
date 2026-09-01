import { timingSafeEqual } from 'crypto';
import { PLAY_ACCESS_TOKEN_ENV } from './constants';

/**
 * 游玩口令：服务端共享秘密。未配置时本机开发放行；配置后所有受保护路由必须携带匹配的令牌。
 * 比较用 timingSafeEqual，避免逐字节时间差泄漏口令。
 */
export function isPlayTokenConfigured(): boolean {
  const token = process.env[PLAY_ACCESS_TOKEN_ENV];
  return typeof token === 'string' && token.trim().length > 0;
}

export function doesPlayTokenMatch(headerValue: string | undefined): boolean {
  if (!isPlayTokenConfigured()) return true;
  if (typeof headerValue !== 'string') return false;

  const expected = process.env[PLAY_ACCESS_TOKEN_ENV]!.trim();
  const provided = headerValue.trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
