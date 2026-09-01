/** 网关层公共类型（无逻辑）。 */

export type SanitizeRejectCode = 'empty' | 'too_long' | 'bad_chars';

export type SanitizeResult =
  | { ok: true; text: string }
  | { ok: false; code: SanitizeRejectCode };

export type CreatePlayerValidation =
  | { ok: true }
  | { ok: false; message: string };

export type QuotaResult = { ok: true; used: number } | { ok: false };

export interface ActionDailyQuotaRow {
  player_id: string;
  day: string;
  count: number;
}
