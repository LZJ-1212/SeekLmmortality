/**
 * 修订：2026-09-05 01:22 +08 lzj — 本机打开页面时强制打 localhost:3000
 * 修订：2026-09-05 01:31 +08 lzj — 本机 5175 打更新服 3001
 *
 * I06 托管：前端 API 基址（单一来源，禁止在组件里再拼一套 fetch 地址）。
 *
 * 规则：
 * - 地址栏 localhost:5175 → http://localhost:3001（更新服，不碰朋友正在玩的 3000）
 * - 地址栏其它 localhost / 127.0.0.1 → http://localhost:3000（游玩服；不受 VITE_API_BASE 隧道影响）
 * - 未设 `VITE_API_BASE`             → 本机开发，回到 http://localhost:3000
 * - 显式设为空字符串 `''`           → 拓扑 A 同源反代，走相对路径 `/api/...`
 * - 设为公网 Origin（如 https://api.example.tld）→ 拓扑 B 双隧道（仅公网页面）
 *
 * 改动只影响前端拼 URL；口令、CORS、日限仍由后端 gateway 负责。
 */
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      if (window.location.port === '5175') return 'http://localhost:3001';
      return 'http://localhost:3000';
    }
  }
  const raw: string | undefined = import.meta.env.VITE_API_BASE;
  if (raw === undefined) return 'http://localhost:3000'; // 未定义 → 本机
  const trimmed = raw.trim();
  if (trimmed === '') return ''; // 显式空 → 同源相对路径
  return trimmed.replace(/\/+$/, ''); // 去尾斜杠
}

/** 把相对路径 `/api/...` 拼成完整 URL；基址为空时原样返回（同源）。 */
export function buildApiUrl(path: string): string {
  const base = getApiBase();
  if (base === '') return path;
  return `${base}${path}`;
}
