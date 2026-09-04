import { createHash, timingSafeEqual } from 'crypto';
import { PLAY_ACCESS_TOKEN_ENV } from './constants';

/**
 * 修订：2026-09-05 01:11 +08 lzj — 多口令逗号分隔；存档按口令哈希隔离
 *
 * 游玩口令：服务端共享秘密。
 * 未配置 → 一律放行。
 * 已配置 → 仅对「经反代/隧道进来」的请求验令牌（朋友从公网打进来）；
 * 浏览器直连本机 3000（localhost 玩）不验，避免自己试玩还要抄口令。
 * 判定：带 Cf-Ray、X-Forwarded-For，或非本机的 X-Forwarded-Host，视为穿透流量。
 * 比较用 timingSafeEqual，避免逐字节时间差泄漏口令。
 * PLAY_ACCESS_TOKEN 可逗号分隔多个口令：每个朋友一个，存档互不可见。
 */
export function isPlayTokenConfigured(): boolean {
  return parseConfiguredPlayTokens().length > 0;
}

/** 口令列表：逗号分隔，去空白；口令本身不要含逗号 */
export function parseConfiguredPlayTokens(): string[] {
  const raw = process.env[PLAY_ACCESS_TOKEN_ENV];
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

export function hashSaveOwnerToken(token: string): string {
  return createHash('sha256').update(`wendaocs-save-owner:${token}`, 'utf8').digest('hex');
}

/** 头与某一配置口令完全一致时返回该口令，否则 null */
export function matchPlayToken(headerValue: string | undefined): string | null {
  const tokens = parseConfiguredPlayTokens();
  if (tokens.length === 0) return null;
  if (typeof headerValue !== 'string') return null;
  const provided = headerValue.trim();
  const providedBuf = Buffer.from(provided);
  let found: string | null = null;
  for (const expected of tokens) {
    const expectedBuf = Buffer.from(expected);
    if (expectedBuf.length !== providedBuf.length) continue;
    if (timingSafeEqual(expectedBuf, providedBuf)) found = expected;
  }
  return found;
}

/** 已配口令时：请求头能对上其中一条则为该口令的存档仓；对不上或未带头 → null（本机服主看全部） */
export function resolveSaveOwnerHash(headerValue: string | undefined): string | null {
  const matched = matchPlayToken(headerValue);
  return matched ? hashSaveOwnerToken(matched) : null;
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
  return matchPlayToken(headerValue) !== null;
}
