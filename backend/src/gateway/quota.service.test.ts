/** 修订：2026-09-05 01:48 +08 lzj — 日限 0 不计数、缺省不限次 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QuotaService, getActionDailyLimit, currentBeijingDay } from './quota.service';
import type { QuotaRepository } from './quota.repository';

function createSeqRepo(seq: number[]): QuotaRepository {
  let i = 0;
  return { incrementAndRead: vi.fn(() => Promise.resolve(seq[Math.min(i++, seq.length - 1)] ?? 0)) } as unknown as QuotaRepository;
}

describe('QuotaService.tryConsumeDailyAction（有上限才计数；0 不限次）', () => {
  it('正常路径：计数未超限时返回 ok 与已用次数', async () => {
    const service = new QuotaService(createSeqRepo([1, 2]));
    expect(await service.tryConsumeDailyAction('p1', new Date(), 60)).toEqual({ ok: true, used: 1 });
    expect(await service.tryConsumeDailyAction('p1', new Date(), 60)).toEqual({ ok: true, used: 2 });
  });

  it('边界：第 61 次（超过上限 60）拒绝', async () => {
    const service = new QuotaService(createSeqRepo([60, 61]));
    expect(await service.tryConsumeDailyAction('p1', new Date(), 60)).toEqual({ ok: true, used: 60 });
    expect(await service.tryConsumeDailyAction('p1', new Date(), 60)).toEqual({ ok: false });
  });

  it('边界：不同玩家各自计数互不影响', async () => {
    const repo = createSeqRepo([3, 1]);
    const service = new QuotaService(repo);
    expect(await service.tryConsumeDailyAction('p-a', new Date(), 60)).toEqual({ ok: true, used: 3 });
    expect(await service.tryConsumeDailyAction('p-b', new Date(), 60)).toEqual({ ok: true, used: 1 });
    expect(repo.incrementAndRead).toHaveBeenNthCalledWith(1, 'p-a', expect.any(String));
    expect(repo.incrementAndRead).toHaveBeenNthCalledWith(2, 'p-b', expect.any(String));
  });

  it('正常路径：上限 0 不写库、永不拒绝', async () => {
    const repo = createSeqRepo([999]);
    const service = new QuotaService(repo);
    expect(await service.tryConsumeDailyAction('p1', new Date(), 0)).toEqual({ ok: true, used: 0 });
    expect(repo.incrementAndRead).not.toHaveBeenCalled();
  });
});

describe('getActionDailyLimit（环境变量缺省与非法值兜底）', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('正常路径：未配则为 0（不限次）', () => {
    vi.stubEnv('ACTION_DAILY_LIMIT', '');
    expect(getActionDailyLimit()).toBe(0);
  });

  it('边界：非法或非正整数也是 0（不限次）', () => {
    vi.stubEnv('ACTION_DAILY_LIMIT', 'abc');
    expect(getActionDailyLimit()).toBe(0);
    vi.stubEnv('ACTION_DAILY_LIMIT', '-5');
    expect(getActionDailyLimit()).toBe(0);
    vi.stubEnv('ACTION_DAILY_LIMIT', '0');
    expect(getActionDailyLimit()).toBe(0);
  });

  it('边界：合法覆盖值生效', () => {
    vi.stubEnv('ACTION_DAILY_LIMIT', '30');
    expect(getActionDailyLimit()).toBe(30);
  });
});

describe('currentBeijingDay（UTC 时刻换算北京自然日）', () => {
  it('正常路径：北京时间零点前的 UTC 时刻归入前一自然日', () => {
    // 2026-08-31T15:59:59Z = 北京 2026-08-31 23:59:59
    expect(currentBeijingDay(new Date('2026-08-31T15:59:59Z'))).toBe('2026-08-31');
    // 2026-08-31T16:00:00Z = 北京 2026-09-01 00:00:00
    expect(currentBeijingDay(new Date('2026-08-31T16:00:00Z'))).toBe('2026-09-01');
  });
});
