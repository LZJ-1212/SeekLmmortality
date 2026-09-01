/**
 * 宗门势力运转（凡尘地位）。
 * 设定核心：从试炼入门到外门弟子，再到真传、长老、甚至一宗之主；宗门提供庇护与专属资源。
 * 技术落地：
 *   1. 状态卡上的宗门职位完全由声望值（贡献度）在代码中依据阈值表晋升，绝不由 AI 决定职位名称。
 *   2. 叛宗标记一旦触发即永久生效，此后每一次行动都必须强制在 AI 的叙事里织入
 *      "被原宗门执法堂追杀"的因果，这是持续性的天罚式压力，不是一次性事件。
 */

import type { PrismaClient, player_sect } from '@prisma/client';
import { SectRepository } from '../repositories/sect.repository';

/** 单次行动里，AI 给出的宗门声望增量上限，防止 AI 一次性给出离谱的贡献度 */
export const MAX_SECT_REPUTATION_DELTA_PER_ACTION = 50;

export function clampSectReputationDelta(delta: number): number {
  return Math.max(-MAX_SECT_REPUTATION_DELTA_PER_ACTION, Math.min(MAX_SECT_REPUTATION_DELTA_PER_ACTION, delta));
}

/** 宗门职位晋升阈值表：声望达到对应门槛即视为该职位，完全由代码判定，AI 无权指定职位名称 */
export interface SectRankTier {
  name: string;
  minReputation: number;
}

export const SECT_RANK_TIERS: SectRankTier[] = [
  { name: '试炼弟子', minReputation: 0 },
  { name: '外门弟子', minReputation: 100 },
  { name: '内门弟子', minReputation: 500 },
  { name: '真传弟子', minReputation: 1500 },
  { name: '长老', minReputation: 5000 },
  { name: '掌门', minReputation: 15000 },
];

export const TRAITOR_RANK_LABEL = '叛徒（已被逐出师门）';

/** 依据声望值查表得出职位；声望越高，职位越高，严格按阈值从高到低匹配 */
export function getSectRankByReputation(reputation: number): string {
  let matched = SECT_RANK_TIERS[0]!.name;
  for (const tier of SECT_RANK_TIERS) {
    if (reputation >= tier.minReputation) matched = tier.name;
  }
  return matched;
}

const BETRAYAL_KEYWORDS = ['叛宗', '背叛师门', '背叛宗门', '倒戈', '叛出师门', '出卖宗门', '弃宗'];

/** 从行动文本里判定玩家是否明确选择了叛宗——这是需要 100% 由后端硬性判定的重大分支，不能靠 AI 自行拿主意 */
export function detectBetrayalIntent(actionText: string): boolean {
  if (!actionText) return false;
  return BETRAYAL_KEYWORDS.some((k) => actionText.includes(k));
}

/** 叛宗一旦触发后，每次行动都必须注入的"被执法堂追杀"持续性指令 */
export function buildHuntedByEnforcersDirective(sectName: string): string {
  const name = sectName || '原宗门';
  return `玩家已叛出「${name}」，被打上叛徒烙印，此后天道生成的一切事件都必须强制织入"被${name}执法堂缉杀"的因果——哪怕只是路人的风声、墙上的缉杀令、暗处尾随的杀气，也绝不能让玩家彻底安宁，这是长期持续的追杀压力，不是一次性事件，直到剧情有合理的转折（如金盆洗手、手刃执法堂来使等）才可能改变。`;
}

export interface SectStatus {
  sectName: string | null;
  rank: string;
  reputation: number;
  isTraitor: boolean;
}

export function toSectStatus(record: player_sect | null): SectStatus {
  if (!record) {
    return { sectName: null, rank: '散修（未入宗门）', reputation: 0, isTraitor: false };
  }
  return {
    sectName: record.sect_name ?? null,
    rank: record.rank ?? '试炼弟子',
    reputation: record.reputation ?? 0,
    isTraitor: !!record.is_traitor,
  };
}

/**
 * 宗门业务逻辑层（Service）。负责：加入宗门、声望驱动的职位晋升、叛宗的永久标记。
 * 具体数据库读写全部委托给 SectRepository。
 */
export class SectService {
  private readonly repo: SectRepository;

  constructor(prisma: PrismaClient, repo?: SectRepository) {
    this.repo = repo ?? new SectRepository(prisma);
  }

  /** 查询玩家当前的宗门档案；尚未加入任何宗门时返回 null（不做懒加载兜底，因为“未入宗”本身是合法状态） */
  async getSect(saveId: string): Promise<player_sect | null> {
    return this.repo.findBySaveId(saveId);
  }

  /** 首次加入宗门；如果玩家已经有宗门档案（包括已叛宗的），不会重复创建或覆盖 */
  async joinSect(saveId: string, sectName: string): Promise<player_sect> {
    return this.repo.create(saveId, sectName);
  }

  /**
   * 依据声望增量重新计算职位并落库；返回是否发生了晋升（供前端/剧情展示"恭喜晋升"式反馈）。
   * @throws Error 当玩家尚未加入任何宗门时
   */
  async applyReputationDelta(
    saveId: string,
    current: player_sect,
    reputationDelta: number,
  ): Promise<{ record: player_sect; promoted: boolean; fromRank: string; toRank: string }> {
    if (current.is_traitor) {
      // 叛徒不再有宗门声望可言，任何声望变动都应被忽略
      return { record: current, promoted: false, fromRank: current.rank ?? TRAITOR_RANK_LABEL, toRank: current.rank ?? TRAITOR_RANK_LABEL };
    }
    const fromRank = current.rank ?? getSectRankByReputation(current.reputation ?? 0);
    const newReputation = Math.max(0, (current.reputation ?? 0) + clampSectReputationDelta(reputationDelta));
    const toRank = getSectRankByReputation(newReputation);
    const record = await this.repo.updateReputationAndRank(saveId, newReputation, toRank);
    return { record, promoted: toRank !== fromRank, fromRank, toRank };
  }

  /** 叛宗：打上永久标记，职位归零为叛徒 */
  async betraySect(saveId: string): Promise<player_sect> {
    return this.repo.markAsTraitor(saveId, TRAITOR_RANK_LABEL);
  }
}
