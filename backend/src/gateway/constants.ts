/**
 * 修订：2026-09-05 01:48 +08 lzj — 每日行动上限缺省 0（朋友试玩不限次）
 * 网关常量：阈值、环境变量名、创角字段上限。改阈值只改这里，改词表去 injectionBlocklist.ts。
 */

export const MAX_ACTION_CHARS = 200;
export const DEFAULT_ACTION_DAILY_LIMIT = 0;

export const PLAY_TOKEN_HEADER = 'X-Play-Token';
export const PLAY_ACCESS_TOKEN_ENV = 'PLAY_ACCESS_TOKEN';
export const ACTION_DAILY_LIMIT_ENV = 'ACTION_DAILY_LIMIT';
export const PLAY_CORS_ORIGIN_ENV = 'PLAY_CORS_ORIGIN';

/** 创角各字段上限（Unicode 码位）。 */
export const CREATE_PLAYER_LIMITS = {
  name: 16,
  gender: 8,
  origin: 24,
  daoPursuit: 24,
  constitution: 24,
  rootsMax: 5,
  rootItem: 4,
  talentsMax: 8,
  talentItem: 16,
} as const;
