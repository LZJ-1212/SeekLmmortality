/**
 * I06 托管：前端 API 基址（单一来源，禁止在组件里再拼一套 fetch 地址）。
 *
 * 规则：
 * - 未设 `VITE_API_BASE`             → 本机开发，回到 http://localhost:3000
 * - 显式设为空字符串 `''`           → 拓扑 A 同源反代，走相对路径 `/api/...`
 * - 设为公网 Origin（如 https://api.example.tld）→ 拓扑 B 双隧道
 *
 * 改动只影响前端拼 URL；口令、CORS、日限仍由后端 gateway 负责。
 */
export function getApiBase(): string {
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
