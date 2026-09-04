/**
 * 修订：2026-09-05 01:31 +08 lzj — 放行更新服用的 5175
 *
 * 本机 Vite：5174 游玩；5175 更新；5173 历史书签。
 */
export const LOCAL_DEV_ORIGINS: readonly string[] = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
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
 * 有配置时：列表命中，或本机 5174 / 5175 / 5173。
 */
export function isAllowedCorsOrigin(requestOrigin: string, configuredRaw: string | undefined): boolean {
  if (LOCAL_DEV_ORIGINS.includes(requestOrigin)) return true;
  return parseCorsOriginList(configuredRaw).includes(requestOrigin);
}
