/**
 * 游玩口令（S21 安全网关）：只存 sessionStorage，随会话失效。
 * 默认口令绝不写进仓库；真实值由服主口头/私下发放。
 */
import { buildApiUrl } from './apiBase';

const PLAY_TOKEN_KEY = 'wendaocs.playToken';
const PLAY_TOKEN_HEADER = 'X-Play-Token';

export function getPlayToken(): string {
  try {
    return sessionStorage.getItem(PLAY_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setPlayToken(token: string): void {
  try {
    if (token) {
      sessionStorage.setItem(PLAY_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(PLAY_TOKEN_KEY);
    }
  } catch {
    // sessionStorage 不可用（隐私模式等）时静默忽略
  }
}

/**
 * 统一请求入口：自动附带口令头；未设口令时不带头（本机开发态）。
 * url 传相对路径 `/api/...`，由 apiBase 决定打到哪个 Origin；
 * 若传绝对 http(s) URL 则原样透传（向后兼容，不推荐）。
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getPlayToken();
  const headers = new Headers(init.headers);
  if (token) headers.set(PLAY_TOKEN_HEADER, token);
  const fullUrl = /^https?:\/\//i.test(url) ? url : buildApiUrl(url);
  return fetch(fullUrl, { ...init, headers });
}
