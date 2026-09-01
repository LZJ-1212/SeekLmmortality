import { ACTION_DAILY_LIMIT_ENV, DEFAULT_ACTION_DAILY_LIMIT } from './constants';
import { QuotaRepository } from './quota.repository';
import type { QuotaResult } from './types';

/** 读取环境变量里的每日行动上限，缺省 60，非正整数按缺省。 */
export function getActionDailyLimit(): number {
  const raw = process.env[ACTION_DAILY_LIMIT_ENV];
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_ACTION_DAILY_LIMIT;
}

/** 把任意时刻换算成北京时间（UTC+8）的自然日字符串 YYYY-MM-DD（与运行机时区无关）。 */
export function currentBeijingDay(now: Date = new Date()): string {
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = beijing.getUTCFullYear();
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0');
  const d = String(beijing.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export class QuotaService {
  constructor(private readonly repo: QuotaRepository) {}

  /**
   * 消耗一次每日行动：自增后读回计数，超过上限则拒绝（不抛异常、不调用 AI）。
   * now 与 limit 可注入，便于确定性单测。
   */
  async tryConsumeDailyAction(
    playerId: string,
    now: Date = new Date(),
    limit: number = getActionDailyLimit(),
  ): Promise<QuotaResult> {
    const day = currentBeijingDay(now);
    const count = await this.repo.incrementAndRead(playerId, day);
    if (count > limit) return { ok: false };
    return { ok: true, used: count };
  }
}
