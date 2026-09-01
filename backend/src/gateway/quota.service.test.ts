import { describe, it, expect, vi } from 'vitest';
import { QuotaService, getActionDailyLimit, currentBeijingDay } from './quota.service';
import type { QuotaRepository } from './quota.repository';

function createSeqRepo(seq: number[]): QuotaRepository {
  let i = 0;
  return { incrementAndRead: vi.fn(() => Promise.resolve(seq[Math.min(i++, seq.length - 1)] ?? 0)) } as unknown as QuotaRepository;
}

describe('QuotaService.tryConsumeDailyAction（第 60 次放行、第 61 次拒绝）', () => {
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
});

describe('getActionDailyLimit（环境变量缺省与非法值兜底）', () => {
  it('正常路径：缺省 60', () => {
    vi.stubEnv('ACTION_DAILY_LIMIT', '');
    expect(getActionDailyLimit()).toBe(60);
  });

  it('边界：非法/非正整数值回退缺省', () => {
    vi.stubEnv('ACTION_DAILY_LIMIT', 'abc');
    expect(getActionDailyLimit()).toBe(60);
    vi.stubEnv('ACTION_DAILY_LIMIT', '-5');
    expect(getActionDailyLimit()).toBe(60);
    vi.stubEnv('ACTION_DAILY_LIMIT', '0');
    expect(getActionDailyLimit()).toBe(60);
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
