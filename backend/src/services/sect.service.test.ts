import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSectRankByReputation,
  clampSectReputationDelta,
  detectBetrayalIntent,
  buildHuntedByEnforcersDirective,
  toSectStatus,
  SectService,
  SECT_RANK_TIERS,
  TRAITOR_RANK_LABEL,
  MAX_SECT_REPUTATION_DELTA_PER_ACTION,
} from './sect.service';
import type { SectRepository } from '../repositories/sect.repository';

describe('getSectRankByReputation（职位完全由代码依据声望阈值判定，绝不由 AI 决定）', () => {
  it('正常路径：声望为 0 时应为最低职位"试炼弟子"', () => {
    expect(getSectRankByReputation(0)).toBe('试炼弟子');
  });

  it('正常路径：声望达到各档阈值时应正确晋升', () => {
    expect(getSectRankByReputation(100)).toBe('外门弟子');
    expect(getSectRankByReputation(500)).toBe('内门弟子');
    expect(getSectRankByReputation(1500)).toBe('真传弟子');
    expect(getSectRankByReputation(5000)).toBe('长老');
    expect(getSectRankByReputation(15000)).toBe('掌门');
  });

  it('边界情况：刚好差 1 点未达到门槛时不应晋升', () => {
    expect(getSectRankByReputation(99)).toBe('试炼弟子');
    expect(getSectRankByReputation(499)).toBe('外门弟子');
  });

  it('健全性检查：阈值表应严格按声望由低到高排列', () => {
    for (let i = 1; i < SECT_RANK_TIERS.length; i++) {
      expect(SECT_RANK_TIERS[i]!.minReputation).toBeGreaterThan(SECT_RANK_TIERS[i - 1]!.minReputation);
    }
  });
});

describe('clampSectReputationDelta（防止 AI 一次性给出离谱的声望增量）', () => {
  it('正常路径：范围内的数值原样保留', () => {
    expect(clampSectReputationDelta(20)).toBe(20);
  });

  it('边界情况：超出上限的数值应被夹紧', () => {
    expect(clampSectReputationDelta(9999)).toBe(MAX_SECT_REPUTATION_DELTA_PER_ACTION);
    expect(clampSectReputationDelta(-9999)).toBe(-MAX_SECT_REPUTATION_DELTA_PER_ACTION);
  });
});

describe('detectBetrayalIntent（叛宗是重大分支，必须由后端硬性判定，不能靠 AI 自行拿主意）', () => {
  it('正常路径：明确提到叛宗关键词时应判定为真', () => {
    expect(detectBetrayalIntent('我决定叛宗，从此与师门恩断义绝')).toBe(true);
    expect(detectBetrayalIntent('一怒之下背叛师门，投靠魔道')).toBe(true);
  });

  it('边界情况：普通行动不应误判为叛宗', () => {
    expect(detectBetrayalIntent('完成宗门交代的任务')).toBe(false);
    expect(detectBetrayalIntent('')).toBe(false);
  });
});

describe('buildHuntedByEnforcersDirective（叛宗后的持续性追杀指令）', () => {
  it('正常路径：应生成包含宗门名称与执法堂缉杀字样的指令文案', () => {
    const directive = buildHuntedByEnforcersDirective('青云宗');
    expect(directive).toContain('青云宗');
    expect(directive).toContain('执法堂');
  });

  it('边界情况：宗门名称缺失时应有兜底文案，不崩溃', () => {
    const directive = buildHuntedByEnforcersDirective('');
    expect(directive).toContain('原宗门');
  });
});

describe('toSectStatus（把数据库记录格式化为统一的状态卡展示结构）', () => {
  it('正常路径：有宗门档案时应正确格式化', () => {
    const status = toSectStatus({ save_id: 's1', sect_name: '青云宗', rank: '外门弟子', reputation: 150, is_traitor: false } as any);
    expect(status).toEqual({ sectName: '青云宗', rank: '外门弟子', reputation: 150, isTraitor: false });
  });

  it('边界情况：尚未加入任何宗门（null）时应返回"散修"状态', () => {
    const status = toSectStatus(null);
    expect(status.sectName).toBeNull();
    expect(status.isTraitor).toBe(false);
    expect(status.rank).toContain('散修');
  });
});

function createMockRepo(): SectRepository {
  return {
    findBySaveId: vi.fn(),
    create: vi.fn(),
    updateReputationAndRank: vi.fn(),
    markAsTraitor: vi.fn(),
  } as unknown as SectRepository;
}

describe('SectService.applyReputationDelta（声望驱动的职位晋升，核心技术落地点）', () => {
  let repo: SectRepository;
  let service: SectService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new SectService({} as any, repo);
  });

  it('核心场景：声望增量导致跨越晋升门槛时，应正确落库新职位并标记 promoted=true', async () => {
    const current = { save_id: 's1', sect_name: '青云宗', rank: '试炼弟子', reputation: 90, is_traitor: false } as any;
    (repo.updateReputationAndRank as any).mockImplementation((saveId: string, reputation: number, rank: string) => ({
      save_id: saveId, sect_name: '青云宗', rank, reputation, is_traitor: false,
    }));

    const result = await service.applyReputationDelta('s1', current, 20); // 90+20=110 -> 外门弟子

    expect(repo.updateReputationAndRank).toHaveBeenCalledWith('s1', 110, '外门弟子');
    expect(result.promoted).toBe(true);
    expect(result.fromRank).toBe('试炼弟子');
    expect(result.toRank).toBe('外门弟子');
  });

  it('正常路径：声望增量不足以跨越门槛时，职位不变，promoted=false', async () => {
    const current = { save_id: 's1', sect_name: '青云宗', rank: '试炼弟子', reputation: 10, is_traitor: false } as any;
    (repo.updateReputationAndRank as any).mockImplementation((saveId: string, reputation: number, rank: string) => ({
      save_id: saveId, sect_name: '青云宗', rank, reputation, is_traitor: false,
    }));

    const result = await service.applyReputationDelta('s1', current, 5);

    expect(result.promoted).toBe(false);
    expect(result.toRank).toBe('试炼弟子');
  });

  it('边界情况：声望不会扣成负数', async () => {
    const current = { save_id: 's1', sect_name: '青云宗', rank: '试炼弟子', reputation: 5, is_traitor: false } as any;
    (repo.updateReputationAndRank as any).mockImplementation((saveId: string, reputation: number) => ({
      save_id: saveId, reputation, rank: getSectRankByReputation(reputation), is_traitor: false,
    }));

    await service.applyReputationDelta('s1', current, -20);

    expect(repo.updateReputationAndRank).toHaveBeenCalledWith('s1', 0, '试炼弟子');
  });

  it('异常路径：已经是叛徒的玩家，任何声望增量都应被忽略，不调用数据库更新', async () => {
    const current = { save_id: 's1', sect_name: '青云宗', rank: TRAITOR_RANK_LABEL, reputation: 0, is_traitor: true } as any;

    const result = await service.applyReputationDelta('s1', current, 100);

    expect(repo.updateReputationAndRank).not.toHaveBeenCalled();
    expect(result.promoted).toBe(false);
  });
});

describe('SectService.betraySect（叛宗：永久标记，职位归零）', () => {
  it('应调用仓库将玩家标记为叛徒', async () => {
    const repo = createMockRepo();
    (repo.markAsTraitor as any).mockResolvedValue({ save_id: 's1', is_traitor: true, rank: TRAITOR_RANK_LABEL, reputation: 0 });
    const service = new SectService({} as any, repo);

    const result = await service.betraySect('s1');

    expect(repo.markAsTraitor).toHaveBeenCalledWith('s1', TRAITOR_RANK_LABEL);
    expect(result.is_traitor).toBe(true);
  });
});
