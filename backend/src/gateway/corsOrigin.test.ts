import { describe, it, expect } from 'vitest';
import { isAllowedCorsOrigin, parseCorsOriginList } from './corsOrigin';

describe('CORS Origin 白名单（本机开发端口 5174/5173 + 逗号分隔公网）', () => {
  it('正常路径：公网 Origin 在列表里则放行', () => {
    expect(isAllowedCorsOrigin('https://front.example.tld', 'https://front.example.tld')).toBe(true);
  });

  it('正常路径：逗号分隔多 Origin，命中其一', () => {
    const raw = 'https://a.example.tld, https://b.example.tld';
    expect(parseCorsOriginList(raw)).toEqual(['https://a.example.tld', 'https://b.example.tld']);
    expect(isAllowedCorsOrigin('https://b.example.tld', raw)).toBe(true);
  });

  it('边界：本机固定端口 5174 在已配公网 CORS 时仍放行', () => {
    expect(isAllowedCorsOrigin('http://localhost:5174', 'https://front.example.tld')).toBe(true);
    expect(isAllowedCorsOrigin('http://127.0.0.1:5174', 'https://front.example.tld')).toBe(true);
  });

  it('边界：历史默认端口 5173 在已配公网 CORS 时仍放行（兼容旧书签）', () => {
    expect(isAllowedCorsOrigin('http://localhost:5173', 'https://front.example.tld')).toBe(true);
    expect(isAllowedCorsOrigin('http://127.0.0.1:5173', 'https://front.example.tld')).toBe(true);
  });

  it('失败/拒绝：未在列表且非本机开发端口则拒绝', () => {
    expect(isAllowedCorsOrigin('https://evil.example', 'https://front.example.tld')).toBe(false);
    expect(isAllowedCorsOrigin('http://localhost:3000', 'https://front.example.tld')).toBe(false);
  });
});
