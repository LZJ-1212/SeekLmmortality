import { describe, it, expect, afterEach, vi } from 'vitest';
import { doesPlayTokenMatch, isPlayTokenConfigured } from './playToken';

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

  it('边界：配置后错误/缺失头拒绝', () => {
    vi.stubEnv('PLAY_ACCESS_TOKEN', 'secret-token');
    expect(doesPlayTokenMatch(undefined)).toBe(false);
    expect(doesPlayTokenMatch('wrong-token')).toBe(false);
    expect(doesPlayTokenMatch('secret-token-x')).toBe(false);
  });

  it('边界：首尾空白不影响匹配（容忍客户端意外空格）', () => {
    vi.stubEnv('PLAY_ACCESS_TOKEN', 'secret-token');
    expect(doesPlayTokenMatch('  secret-token  ')).toBe(true);
  });
});
