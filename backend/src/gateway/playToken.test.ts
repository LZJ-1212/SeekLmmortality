/** 修订：2026-09-05 01:11 +08 lzj — 多口令与仓哈希单测 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { doesPlayTokenMatch, isPlayTokenConfigured, isProxiedIncomingRequest, mustEnforcePlayToken, hashSaveOwnerToken, resolveSaveOwnerHash } from './playToken';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('playToken（口令配置判定 + 时序安全比较）', () => {
  it('正常路径：未配置时 isPlayTokenConfigured=false 且 doesPlayTokenMatch 恒真', () => {
    vi.stubEnv('PLAY_ACCESS_TOKEN', '');
    expect(isPlayTokenConfigured()).toBe(false);
    expect(doesPlayTokenMatch(undefined)).toBe(true);
    expect(doesPlayTokenMatch('anything')).toBe(true);
  });

  it('正常路径：配置后完全一致的头放行', () => {
    vi.stubEnv('PLAY_ACCESS_TOKEN', 'secret-token');
    expect(isPlayTokenConfigured()).toBe(true);
    expect(doesPlayTokenMatch('secret-token')).toBe(true);
  });

  it('失败/拒绝：错误口令拒绝；逗号列表中只有完全一致的一条能过', () => {
    vi.stubEnv('PLAY_ACCESS_TOKEN', 'secret-token');
    expect(doesPlayTokenMatch(undefined)).toBe(false);
    expect(doesPlayTokenMatch('wrong-token')).toBe(false);
    expect(doesPlayTokenMatch('secret-token-x')).toBe(false);
  });

  it('正常路径：逗号分隔的多个口令各自可过，且哈希不同', () => {
    vi.stubEnv('PLAY_ACCESS_TOKEN', 'alice-key, bob-key');
    expect(doesPlayTokenMatch('alice-key')).toBe(true);
    expect(doesPlayTokenMatch('bob-key')).toBe(true);
    expect(doesPlayTokenMatch('alice-key, bob-key')).toBe(false);
    expect(hashSaveOwnerToken('alice-key')).not.toBe(hashSaveOwnerToken('bob-key'));
    expect(resolveSaveOwnerHash('alice-key')).toBe(hashSaveOwnerToken('alice-key'));
  });

  it('边界：首尾空白不影响匹配（容忍客户端意外空格）', () => {
    vi.stubEnv('PLAY_ACCESS_TOKEN', 'secret-token');
    expect(doesPlayTokenMatch('  secret-token  ')).toBe(true);
  });
});

function headerMap(map: Record<string, string | undefined>): (name: string) => string | undefined {
  return (name: string) => {
    const key = Object.keys(map).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? map[key] : undefined;
  };
}

describe('isProxiedIncomingRequest / mustEnforcePlayToken（本机直连不验令牌）', () => {
  it('正常路径：浏览器直连本机无转发头，不视为穿透', () => {
    expect(isProxiedIncomingRequest(headerMap({}))).toBe(false);
    vi.stubEnv('PLAY_ACCESS_TOKEN', 'secret-token');
    expect(mustEnforcePlayToken(headerMap({}))).toBe(false);
  });

  it('正常路径：Cloudflare 隧道带 cf-ray，必须验令牌', () => {
    vi.stubEnv('PLAY_ACCESS_TOKEN', 'secret-token');
    const h = headerMap({ 'cf-ray': 'abc123', 'x-forwarded-for': '1.2.3.4' });
    expect(isProxiedIncomingRequest(h)).toBe(true);
    expect(mustEnforcePlayToken(h)).toBe(true);
  });

  it('边界：未配口令时即使像穿透也不强制', () => {
    vi.stubEnv('PLAY_ACCESS_TOKEN', '');
    expect(mustEnforcePlayToken(headerMap({ 'cf-ray': 'abc' }))).toBe(false);
  });

  it('失败/拒绝：仅有本机 X-Forwarded-Host 不当成公网穿透', () => {
    expect(isProxiedIncomingRequest(headerMap({ 'x-forwarded-host': 'localhost:3000' }))).toBe(false);
  });
});
