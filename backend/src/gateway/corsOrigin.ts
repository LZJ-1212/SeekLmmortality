/** 本机 Vite 默认 Origin；配了公网 CORS 时仍放行，避免 L1 隧道配置把本机创角卡死。 */
export const LOCAL_DEV_ORIGINS: readonly string[] = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

/** 把 PLAY_CORS_ORIGIN 拆成列表（逗号分隔，去空白）。 */
export function parseCorsOriginList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * 浏览器 Origin 是否放行。
 * 无配置（开发未设 PLAY_CORS_ORIGIN）由调用方走 cors() 全放，不走本函数。
 * 有配置时：列表命中，或本机 5173。
 */
export function isAllowedCorsOrigin(requestOrigin: string, configuredRaw: string | undefined): boolean {
  if (LOCAL_DEV_ORIGINS.includes(requestOrigin)) return true;
  return parseCorsOriginList(configuredRaw).includes(requestOrigin);
}
