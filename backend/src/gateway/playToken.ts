import { timingSafeEqual } from 'crypto';
import { PLAY_ACCESS_TOKEN_ENV } from './constants';

/**
 * 游玩口令：服务端共享秘密。
 * 未配置 → 一律放行。
 * 已配置 → 仅对「经反代/隧道进来」的请求验令牌（朋友从公网打进来）；
 * 浏览器直连本机 3000（localhost 玩）不验，避免自己试玩还要抄口令。
 * 判定：带 Cf-Ray、X-Forwarded-For，或非本机的 X-Forwarded-Host，视为穿透流量。
 * 比较用 timingSafeEqual，避免逐字节时间差泄漏口令。
 */
export function isPlayTokenConfigured(): boolean {
  const token = process.env[PLAY_ACCESS_TOKEN_ENV];
  return typeof token === 'string' && token.trim().length > 0;
}

/** 是否像经 Cloudflare / ngrok / 反代转发（相对浏览器直连 localhost:3000） */
export function isProxiedIncomingRequest(header: (name: string) => string | undefined): boolean {
  if (header('cf-ray')?.trim()) return true;
  if (header('x-forwarded-for')?.trim()) return true;
  const forwardedHost = header('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase() ?? '';
  if (
    forwardedHost &&
    !forwardedHost.startsWith('localhost') &&
    !forwardedHost.startsWith('127.0.0.1')
  ) {
    return true;
  }
  return false;
}

/** 已配口令且请求来自穿透时，才强制校验令牌 */
export function mustEnforcePlayToken(header: (name: string) => string | undefined): boolean {
  return isPlayTokenConfigured() && isProxiedIncomingRequest(header);
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
