import type { PrismaClient, Prisma, player_inventory, items_template } from '@prisma/client';
import { InventoryRepository } from '../repositories/inventory.repository';

/** 自定义物品数值熔断上限（与 backend/ai.ts 里的造化铁律保持一致，防止 AI 越界发明数值） */
export const CUSTOM_ITEM_LIMITS = {
  MAX_RARITY: 4, // 最高地阶，仙阶(5)禁止 AI 生成
  MAX_CULTIVATION_DELTA: 30,
  MAX_HP_DELTA: 50,
  MAX_MP_DELTA: 50,
  MAX_MERIT_DELTA: 5,
  MAX_KARMA_DELTA: 5,
} as const;

export interface CustomItemEffects {
  cultivation_delta?: number;
  hp_delta?: number;
  mp_delta?: number;
  merit_delta?: number;
  karma_delta?: number;
}

/** 自定义物品的 custom_data JSON 结构（写入时由 addItem 落库，读取时安全解析） */
export interface CustomItemData {
  name?: string;
  category?: string;
  rarity?: number;
  description?: string;
  effects?: CustomItemEffects;
}

/** AI 推演或坊市交易产生的一条物品变更请求 */
export interface ItemChangeInput {
  name: string;
  change: number; // 正数为获得，负数为消耗
  category?: string;
  rarity?: number;
  description?: string;
  effects?: CustomItemEffects;
}

/** 提供给前端展示的统一背包条目格式 */
export interface InventoryEntryDTO {
  inventoryId: string;
  name: string;
  quantity: number;
  isEquipped: boolean;
  type: 'template' | 'custom';
  rarity: number;
  description: string;
  category?: string;
  effects?: CustomItemEffects;
}

function clamp(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value));
}

/** 对 AI 生成的自定义物品数值做防作弊熔断，绝不相信外部输入的原始数值 */
export function sanitizeCustomEffects(effects: CustomItemEffects = {}): CustomItemEffects {
  const bounded: CustomItemEffects = {};
  if (effects.cultivation_delta) {
    bounded.cultivation_delta = clamp(effects.cultivation_delta, CUSTOM_ITEM_LIMITS.MAX_CULTIVATION_DELTA);
  }
  if (effects.hp_delta) {
    bounded.hp_delta = clamp(effects.hp_delta, CUSTOM_ITEM_LIMITS.MAX_HP_DELTA);
  }
  if (effects.mp_delta) {
    bounded.mp_delta = clamp(effects.mp_delta, CUSTOM_ITEM_LIMITS.MAX_MP_DELTA);
  }
  if (effects.merit_delta) {
    bounded.merit_delta = clamp(effects.merit_delta, CUSTOM_ITEM_LIMITS.MAX_MERIT_DELTA);
  }
  if (effects.karma_delta) {
    bounded.karma_delta = clamp(effects.karma_delta, CUSTOM_ITEM_LIMITS.MAX_KARMA_DELTA);
  }
  return bounded;
}

/** 自定义物品效果数值的字段名集合（与 CustomItemEffects 一一对应） */
const CUSTOM_EFFECT_KEYS = ['cultivation_delta', 'hp_delta', 'mp_delta', 'merit_delta', 'karma_delta'] as const;

/** 安全解析 custom_data.effects：只保留有限数值字段，其余类型一律丢弃，绝不抛异常 */
function parseCustomEffects(raw: unknown): CustomItemEffects | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const data = raw as Record<string, unknown>;
  const effects: CustomItemEffects = {};
  for (const key of CUSTOM_EFFECT_KEYS) {
    const value = data[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      effects[key] = value;
    }
  }
  return Object.keys(effects).length > 0 ? effects : undefined;
}

/**
 * 安全解析 custom_data JSON 字段（Prisma Json 类型在运行时是 unknown）。
 * 任何非对象、字段类型不符都退化为空对象或省略该字段，绝不抛异常——
 * 这样历史脏数据 / AI 越界写入都不会让背包格式化流程崩溃。
 */
function parseCustomData(raw: unknown): CustomItemData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const data = raw as Record<string, unknown>;
  const effects = parseCustomEffects(data.effects);
  return {
    ...(typeof data.name === 'string' ? { name: data.name } : {}),
    ...(typeof data.category === 'string' ? { category: data.category } : {}),
    ...(typeof data.rarity === 'number' && Number.isFinite(data.rarity) ? { rarity: data.rarity } : {}),
    ...(typeof data.description === 'string' ? { description: data.description } : {}),
    ...(effects ? { effects } : {}),
  };
}

function formatEntry(entry: player_inventory & { items_template?: items_template | null }): InventoryEntryDTO {
  if (entry.items_template) {
    return {
      inventoryId: entry.id,
      name: entry.items_template.name,
      quantity: entry.quantity ?? 0,
      isEquipped: !!entry.is_equipped,
      type: 'template',
      rarity: entry.items_template.rarity ?? 1,
      description: entry.items_template.description ?? '',
      category: entry.items_template.category,
    };
  }
  const custom = parseCustomData(entry.custom_data);
  return {
    inventoryId: entry.id,
    name: entry.custom_name ?? '未知物品',
    quantity: entry.quantity ?? 0,
    isEquipped: !!entry.is_equipped,
    type: 'custom',
    rarity: custom.rarity ?? 1,
    description: custom.description ?? '',
    ...(custom.category !== undefined ? { category: custom.category } : {}),
    ...(custom.effects !== undefined ? { effects: custom.effects } : {}),
  };
}

/**
 * 背包业务逻辑层（Service）。
 * 负责：物品叠加规则、自定义物品数值熔断、库存不足校验、格式化输出。
 * 具体数据库读写全部委托给 InventoryRepository，Service 本身不直接拼 Prisma 查询。
 */
export class InventoryService {
  private readonly repo: InventoryRepository;

  constructor(private readonly prisma: PrismaClient, repo?: InventoryRepository) {
    this.repo = repo ?? new InventoryRepository(prisma);
  }

  /** [查] 获取某存档的完整背包，格式化为前端可直接展示的结构 */
  async getInventory(saveId: string): Promise<InventoryEntryDTO[]> {
    const entries = await this.repo.findAllBySave(saveId);
    return entries.map(formatEntry);
  }

  /** [查] 生成用于喂给 AI 的背包摘要字符串，如「聚气丹 x2，上古骨片(3阶) x1」 */
  async getInventoryPromptString(saveId: string): Promise<string> {
    const entries = await this.repo.findAllBySave(saveId);
    if (entries.length === 0) return '空无一物';
    return entries
      .map((entry) => {
        if (entry.items_template) {
          return `${entry.items_template.name} x${entry.quantity}`;
        }
        const custom = parseCustomData(entry.custom_data);
        const rarityTag = custom.rarity ? `(${custom.rarity}阶)` : '';
        return `${entry.custom_name || '未知物品'}${rarityTag} x${entry.quantity}`;
      })
      .join('，');
  }

  /**
   * [防作弊校验] 检测玩家的行动文本里是否提到了“物品字典中真实存在、但玩家当前并未持有（或数量为 0）”的物品。
   * 用于在调用 AI 推演前生成 forcedOutcome，杜绝 AI 凭空让玩家“使用”背包里根本没有的道具
   * （例如玩家没有符箓，AI 却编出“捏碎随身符箓逃脱”的剧情）。
   *
   * 注意：这只能覆盖“物品字典里已登记的真实物品名称”，无法识别 AI 临时编造的泛称物品
   * （如笼统的“符箓”“法宝”），后者需要依赖系统提示词里的物品真实性铁律来约束。
   *
   * @returns 命中时返回一条可直接拼进 forcedOutcome 的说明文本；未命中返回 null
   */
  async detectFabricatedItemUsage(saveId: string, actionText: string): Promise<string | null> {
    const [allTemplates, ownedEntries] = await Promise.all([
      this.repo.listAllTemplateNames(),
      this.repo.findAllBySave(saveId),
    ]);

    const ownedNames = new Set(
      ownedEntries
        .filter((entry) => (entry.quantity ?? 0) > 0)
        .map((entry) => entry.items_template?.name ?? entry.custom_name)
        .filter((name): name is string => !!name),
    );

    for (const template of allTemplates) {
      const mentioned = actionText.includes(template.name);
      const owned = ownedNames.has(template.name);
      if (mentioned && !owned) {
        return `玩家声称使用「${template.name}」，但背包中并无此物（或数量为 0）。凡涉及「${template.name}」的行动效果一律判定为落空，剧情必须体现玩家两手空空、临时找不到该物品，只能依靠自身或另想他法应对，绝不可让该物品真的生效。`;
      }
    }
    return null;
  }

  /** [查] 获取物品字典中的全部物品名称，供坊市/拍卖等场景匹配玩家提到的具体物品 */
  async listAllTemplateNames(): Promise<string[]> {
    const templates = await this.repo.listAllTemplateNames();
    return templates.map((t) => t.name);
  }

  /** [查] 按名称查询物品字典模板（含 base_price/rarity 等定价信息） */
  async getTemplateByName(name: string): Promise<items_template | null> {
    return this.repo.findTemplateByName(name);
  }

  /** [查] 查询玩家当前持有某个字典物品的数量（未持有返回 0），供坊市出售场景校验库存 */
  async getOwnedQuantityByName(saveId: string, name: string): Promise<number> {
    const template = await this.repo.findTemplateByName(name);
    if (!template) return 0;
    const existing = await this.repo.findRegularEntry(saveId, template.id);
    return existing?.quantity ?? 0;
  }

  /**
   * [增] 获得一件物品（可为字典物品，也可为 AI 新发明的自定义物品）。
   * - 字典物品：若已存在则叠加数量，否则新建条目。
   * - 自定义物品：数值与稀有度会被强制熔断到安全范围内。
   * @throws Error 当 quantity <= 0 时
   */
  async addItem(saveId: string, input: ItemChangeInput): Promise<player_inventory> {
    if (!input.name || !input.name.trim()) {
      throw new Error('物品名称不能为空');
    }
    const quantity = input.change;
    if (!quantity || quantity <= 0) {
      throw new Error('获得物品的数量必须为正数');
    }

    const template = await this.repo.findTemplateByName(input.name);

    if (template) {
      const existing = await this.repo.findRegularEntry(saveId, template.id);
      if (existing) {
        return this.repo.incrementQuantity(existing.id, quantity);
      }
      return this.repo.createRegularEntry(saveId, template.id, quantity);
    }

    // 数据库里没有的物品，视为 AI/剧情自定义物品，需要熔断数值防作弊
    const rarity = Math.min(input.rarity ?? 1, CUSTOM_ITEM_LIMITS.MAX_RARITY);
    const customData: CustomItemData = {
      name: input.name,
      category: input.category || 'misc',
      rarity,
      description: input.description || '一件来历不明的物品。',
      effects: sanitizeCustomEffects(input.effects),
    };
    // 强类型接口（CustomItemData）→ Prisma Json 字段的跨边界转换，需经 unknown 中转
    return this.repo.createCustomEntry(saveId, input.name, customData as unknown as Prisma.InputJsonValue, quantity);
  }

  /**
   * [删] 消耗/移除一件字典物品（自定义物品目前只支持获得，不支持定向按名消耗）。
   * @throws Error 当物品不存在或库存不足时
   */
  async removeItemByName(saveId: string, name: string, quantity: number): Promise<void> {
    if (!quantity || quantity <= 0) {
      throw new Error('移除物品的数量必须为正数');
    }
    const template = await this.repo.findTemplateByName(name);
    if (!template) {
      throw new Error(`物品 "${name}" 不存在于物品字典中，无法定向消耗`);
    }
    const existing = await this.repo.findRegularEntry(saveId, template.id);
    if (!existing) {
      throw new Error(`背包中没有物品 "${name}"`);
    }
    const remaining = (existing.quantity ?? 0) - quantity;
    if (remaining < 0) {
      throw new Error(`物品 "${name}" 数量不足`);
    }
    if (remaining === 0) {
      await this.repo.deleteById(existing.id);
    } else {
      await this.repo.setQuantity(existing.id, remaining);
    }
  }

  /** [改] 直接删除一条背包条目（无论字典物品还是自定义物品） */
  async deleteEntry(inventoryId: string): Promise<void> {
    const existing = await this.repo.findById(inventoryId);
    if (!existing) {
      throw new Error('背包条目不存在');
    }
    await this.repo.deleteById(inventoryId);
  }

  /** [改] 设置某条背包物品的装备状态 */
  async setEquipped(inventoryId: string, isEquipped: boolean): Promise<player_inventory> {
    const existing = await this.repo.findById(inventoryId);
    if (!existing) {
      throw new Error('背包条目不存在');
    }
    return this.repo.setEquipped(inventoryId, isEquipped);
  }

  /** [改] 直接设置某条背包物品的数量；数量 <= 0 时等价于删除 */
  async setQuantity(inventoryId: string, quantity: number): Promise<player_inventory | void> {
    const existing = await this.repo.findById(inventoryId);
    if (!existing) {
      throw new Error('背包条目不存在');
    }
    if (quantity <= 0) {
      return this.repo.deleteById(inventoryId);
    }
    return this.repo.setQuantity(inventoryId, quantity);
  }

  /**
   * [批量增删] 供 AI 推演结果（/api/action）使用：一次性处理多条 item_changes。
   * 内部会自动区分字典物品与自定义物品，并对自定义物品做数值熔断。
   * 使用 $transaction 保证批量变更的原子性。
   */
  async applyItemChanges(saveId: string, changes: ItemChangeInput[]): Promise<void> {
    const meaningfulChanges = changes.filter((c) => (c.change || 0) !== 0);
    if (meaningfulChanges.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      const txRepo = new InventoryRepository(tx as unknown as PrismaClient);
      const txService = new InventoryService(tx as unknown as PrismaClient, txRepo);

      for (const change of meaningfulChanges) {
        if (change.change > 0) {
          await txService.addItem(saveId, change);
        } else {
          await txService.removeItemByName(saveId, change.name, Math.abs(change.change));
        }
      }
    });
  }
}
