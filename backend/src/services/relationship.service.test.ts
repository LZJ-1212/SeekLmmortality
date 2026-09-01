import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelationshipService, deceasedNpcForcedOutcome } from './relationship.service';
import type { RelationshipRepository } from '../repositories/relationship.repository';
import { getMaxLifespanForRealm } from './npc.service';

function createMockRepo(): RelationshipRepository {
  return {
    findAllBySave: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    updateAffinity: vi.fn(),
    markDeceased: vi.fn(),
  } as unknown as RelationshipRepository;
}

describe('RelationshipService.recordNewRelationship（首次记录人际关系，NPC 寿元由境界换算）', () => {
  let repo: RelationshipRepository;
  let service: RelationshipService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new RelationshipService({} as any, repo);
  });

  it('正常路径：应正确换算 NPC 出生年份与寿元上限并落库', async () => {
    (repo.create as any).mockImplementation((data: any) => ({ id: 'rel-1', ...data }));

    await service.recordNewRelationship(
      'save-1',
      { npcName: '苏晴', relationType: '挚友', affinityDelta: 20, npcRealmMajor: '筑基', npcAgeYears: 30 },
      500, // 当前世界年份
    );

    expect(repo.create).toHaveBeenCalledWith({
      saveId: 'save-1',
      npcName: '苏晴',
      relationType: '挚友',
      affinity: 20,
      npcRealmMajor: '筑基',
      npcBirthYear: 470, // 500 - 30
      npcMaxLifespan: getMaxLifespanForRealm('筑基'), // 200
    });
  });

  it('边界情况：好感度增量不会导致初始好感度为负', async () => {
    (repo.create as any).mockImplementation((data: any) => ({ id: 'rel-1', ...data }));
    await service.recordNewRelationship(
      'save-1',
      { npcName: '仇人甲', relationType: '仇敌', affinityDelta: -50, npcRealmMajor: '炼气', npcAgeYears: 20 },
      500,
    );
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ affinity: 0 }));
  });
});

describe('RelationshipService.applyAffinityDelta（更新既有关系的好感度）', () => {
  it('正常路径：应在原有好感度基础上叠加夹紧后的增量', async () => {
    const repo = createMockRepo();
    (repo.updateAffinity as any).mockResolvedValue({ id: 'rel-1', affinity: 50 });
    const service = new RelationshipService({} as any, repo);

    const relationship = { id: 'rel-1', affinity: 40 } as any;
    await service.applyAffinityDelta(relationship, 10);

    expect(repo.updateAffinity).toHaveBeenCalledWith('rel-1', 50, undefined);
  });

  it('边界情况：好感度不会扣成负数', async () => {
    const repo = createMockRepo();
    (repo.updateAffinity as any).mockResolvedValue({ id: 'rel-1', affinity: 0 });
    const service = new RelationshipService({} as any, repo);

    const relationship = { id: 'rel-1', affinity: 5 } as any;
    await service.applyAffinityDelta(relationship, -20);

    expect(repo.updateAffinity).toHaveBeenCalledWith('rel-1', 0, undefined);
  });
});

describe('RelationshipService.checkForDeceasedFriends（旧友寿元耗尽的传音符检测）', () => {
  it('核心场景：寿元耗尽且尚未标记为已故的关系，应被标记并生成传音符讯息', async () => {
    const repo = createMockRepo();
    (repo.findAllBySave as any).mockResolvedValue([
      { id: 'rel-1', npc_name: '老张', relation_type: '挚友', npc_birth_year: 300, npc_max_lifespan: 100, is_deceased: false },
    ]);
    const service = new RelationshipService({} as any, repo);

    const notices = await service.checkForDeceasedFriends('save-1', 450); // 年龄150 > 100，寿元耗尽

    expect(repo.markDeceased).toHaveBeenCalledWith('rel-1');
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('老张');
  });

  it('正常路径：已经标记为已故的关系不应重复推送传音符', async () => {
    const repo = createMockRepo();
    (repo.findAllBySave as any).mockResolvedValue([
      { id: 'rel-1', npc_name: '老张', relation_type: '挚友', npc_birth_year: 300, npc_max_lifespan: 100, is_deceased: true },
    ]);
    const service = new RelationshipService({} as any, repo);

    const notices = await service.checkForDeceasedFriends('save-1', 450);

    expect(repo.markDeceased).not.toHaveBeenCalled();
    expect(notices).toHaveLength(0);
  });

  it('正常路径：寿元尚充足的关系不应触发传音符', async () => {
    const repo = createMockRepo();
    (repo.findAllBySave as any).mockResolvedValue([
      { id: 'rel-1', npc_name: '小李', relation_type: '道侣', npc_birth_year: 400, npc_max_lifespan: 200, is_deceased: false },
    ]);
    const service = new RelationshipService({} as any, repo);

    const notices = await service.checkForDeceasedFriends('save-1', 450);

    expect(repo.markDeceased).not.toHaveBeenCalled();
    expect(notices).toHaveLength(0);
  });

  it('边界情况：缺失出生年份/寿元数据的历史脏数据应安全跳过，不抛出异常', async () => {
    const repo = createMockRepo();
    (repo.findAllBySave as any).mockResolvedValue([
      { id: 'rel-1', npc_name: '神秘人', relation_type: null, npc_birth_year: null, npc_max_lifespan: null, is_deceased: false },
    ]);
    const service = new RelationshipService({} as any, repo);

    const notices = await service.checkForDeceasedFriends('save-1', 450);

    expect(notices).toHaveLength(0);
  });
});

describe('deceasedNpcForcedOutcome（已仙逝不得再拜访）', () => {
  it('失败/拒绝：拜访已故旧友必须落空', () => {
    const text = deceasedNpcForcedOutcome('拜访那位无名老修士，请教修行', [
      { npc_name: '无名老修士', is_deceased: true },
    ]);
    expect(text).toContain('已然仙逝');
  });

  it('正常路径：在世之人拜访不拦', () => {
    expect(
      deceasedNpcForcedOutcome('拜访苏晴', [
        { npc_name: '苏晴', is_deceased: false },
        { npc_name: '无名老修士', is_deceased: true },
      ]),
    ).toBeNull();
  });

  it('边界：行动未点名亡者则不拦', () => {
    expect(
      deceasedNpcForcedOutcome('出城历练', [{ npc_name: '无名老修士', is_deceased: true }]),
    ).toBeNull();
  });
});
