import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService, sanitizeCustomEffects, CUSTOM_ITEM_LIMITS } from './inventory.service';
import type { InventoryRepository } from '../repositories/inventory.repository';

/** 构造一个方法全部被 vi.fn() 替代的 Repository 假对象，供 Service 单元测试注入 */
function createMockRepo(): InventoryRepository {
  return {
    findAllBySave: vi.fn(),
    findById: vi.fn(),
    findRegularEntry: vi.fn(),
    findTemplateByName: vi.fn(),
    listAllTemplateNames: vi.fn(),
    createRegularEntry: vi.fn(),
    createCustomEntry: vi.fn(),
    incrementQuantity: vi.fn(),
    setQuantity: vi.fn(),
    setEquipped: vi.fn(),
    deleteById: vi.fn(),
  } as unknown as InventoryRepository;
}

describe('sanitizeCustomEffects（自定义物品数值熔断）', () => {
  it('正常路径：范围内的数值原样保留', () => {
    const result = sanitizeCustomEffects({ cultivation_delta: 5, hp_delta: -10 });
    expect(result).toEqual({ cultivation_delta: 5, hp_delta: -10 });
  });

  it('边界情况：超出上限的数值会被夹紧到最大/最小值', () => {
    const result = sanitizeCustomEffects({
      cultivation_delta: 999,
      hp_delta: -999,
      merit_delta: 100,
      karma_delta: -100,
    });
    expect(result).toEqual({
      cultivation_delta: CUSTOM_ITEM_LIMITS.MAX_CULTIVATION_DELTA,
      hp_delta: -CUSTOM_ITEM_LIMITS.MAX_HP_DELTA,
      merit_delta: CUSTOM_ITEM_LIMITS.MAX_MERIT_DELTA,
      karma_delta: -CUSTOM_ITEM_LIMITS.MAX_KARMA_DELTA,
    });
  });

  it('边界情况：数值为 0 或未提供时不会写入结果对象', () => {
    const result = sanitizeCustomEffects({ cultivation_delta: 0 });
    expect(result).toEqual({});
  });
});

describe('InventoryService.addItem（增）', () => {
  let repo: InventoryRepository;
  let service: InventoryService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new InventoryService({} as any, repo);
  });

  it('正常路径：字典物品已存在时应叠加数量', async () => {
    (repo.findTemplateByName as any).mockResolvedValue({ id: 'tpl-1', name: '聚气丹' });
    (repo.findRegularEntry as any).mockResolvedValue({ id: 'inv-1', quantity: 3 });
    (repo.incrementQuantity as any).mockResolvedValue({ id: 'inv-1', quantity: 5 });

    const result = await service.addItem('save-1', { name: '聚气丹', change: 2 });

    expect(repo.incrementQuantity).toHaveBeenCalledWith('inv-1', 2);
    expect(repo.createRegularEntry).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'inv-1', quantity: 5 });
  });

  it('正常路径：字典物品首次获得时应新建条目', async () => {
    (repo.findTemplateByName as any).mockResolvedValue({ id: 'tpl-1', name: '聚气丹' });
    (repo.findRegularEntry as any).mockResolvedValue(null);
    (repo.createRegularEntry as any).mockResolvedValue({ id: 'inv-new', quantity: 1 });

    await service.addItem('save-1', { name: '聚气丹', change: 1 });

    expect(repo.createRegularEntry).toHaveBeenCalledWith('save-1', 'tpl-1', 1);
  });

  it('正常路径：数据库没有的物品应作为自定义物品创建，且数值被熔断', async () => {
    (repo.findTemplateByName as any).mockResolvedValue(null);
    (repo.createCustomEntry as any).mockResolvedValue({ id: 'inv-custom' });

    await service.addItem('save-1', {
      name: '上古骨片',
      change: 1,
      rarity: 99, // 超出上限，应被压到 4
      effects: { cultivation_delta: 999 }, // 超出上限，应被夹紧到 30
    });

    expect(repo.createCustomEntry).toHaveBeenCalledWith(
      'save-1',
      '上古骨片',
      expect.objectContaining({
        rarity: CUSTOM_ITEM_LIMITS.MAX_RARITY,
        effects: { cultivation_delta: CUSTOM_ITEM_LIMITS.MAX_CULTIVATION_DELTA },
      }),
      1,
    );
  });

  it('边界情况：物品名为空时应抛出异常', async () => {
    await expect(service.addItem('save-1', { name: '  ', change: 1 })).rejects.toThrow(
      '物品名称不能为空',
    );
  });

  it('边界情况：数量为 0 或负数时应抛出异常', async () => {
    await expect(service.addItem('save-1', { name: '聚气丹', change: 0 })).rejects.toThrow(
      '获得物品的数量必须为正数',
    );
    await expect(service.addItem('save-1', { name: '聚气丹', change: -1 })).rejects.toThrow(
      '获得物品的数量必须为正数',
    );
  });
});

describe('InventoryService.removeItemByName（删/消耗）', () => {
  let repo: InventoryRepository;
  let service: InventoryService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new InventoryService({} as any, repo);
  });

  it('正常路径：库存充足时应扣减数量', async () => {
    (repo.findTemplateByName as any).mockResolvedValue({ id: 'tpl-1', name: '聚气丹' });
    (repo.findRegularEntry as any).mockResolvedValue({ id: 'inv-1', quantity: 5 });

    await service.removeItemByName('save-1', '聚气丹', 2);

    expect(repo.setQuantity).toHaveBeenCalledWith('inv-1', 3);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('边界情况：扣减后数量为 0 时应删除条目而非置零保留', async () => {
    (repo.findTemplateByName as any).mockResolvedValue({ id: 'tpl-1', name: '聚气丹' });
    (repo.findRegularEntry as any).mockResolvedValue({ id: 'inv-1', quantity: 2 });

    await service.removeItemByName('save-1', '聚气丹', 2);

    expect(repo.deleteById).toHaveBeenCalledWith('inv-1');
    expect(repo.setQuantity).not.toHaveBeenCalled();
  });

  it('异常抛出：库存不足时应抛出异常且不修改数据', async () => {
    (repo.findTemplateByName as any).mockResolvedValue({ id: 'tpl-1', name: '聚气丹' });
    (repo.findRegularEntry as any).mockResolvedValue({ id: 'inv-1', quantity: 1 });

    await expect(service.removeItemByName('save-1', '聚气丹', 5)).rejects.toThrow('数量不足');
    expect(repo.setQuantity).not.toHaveBeenCalled();
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('异常抛出：物品不在字典中时应抛出异常', async () => {
    (repo.findTemplateByName as any).mockResolvedValue(null);
    await expect(service.removeItemByName('save-1', '不存在的物品', 1)).rejects.toThrow(
      '不存在于物品字典中',
    );
  });

  it('异常抛出：背包里没有该物品时应抛出异常', async () => {
    (repo.findTemplateByName as any).mockResolvedValue({ id: 'tpl-1', name: '聚气丹' });
    (repo.findRegularEntry as any).mockResolvedValue(null);
    await expect(service.removeItemByName('save-1', '聚气丹', 1)).rejects.toThrow(
      '背包中没有物品',
    );
  });
});

describe('InventoryService 供坊市/拍卖场景使用的查询方法', () => {
  let repo: InventoryRepository;
  let service: InventoryService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new InventoryService({} as any, repo);
  });

  it('listAllTemplateNames：应返回物品字典里全部物品的名称列表', async () => {
    (repo.listAllTemplateNames as any).mockResolvedValue([{ name: '聚气丹' }, { name: '筑基丹' }]);
    const result = await service.listAllTemplateNames();
    expect(result).toEqual(['聚气丹', '筑基丹']);
  });

  it('getTemplateByName：应返回完整的物品字典模板（含 base_price）', async () => {
    (repo.findTemplateByName as any).mockResolvedValue({ id: 'tpl-1', name: '聚气丹', base_price: 20 });
    const result = await service.getTemplateByName('聚气丹');
    expect(result?.base_price).toBe(20);
  });

  it('getOwnedQuantityByName：字典物品存在且已持有时应返回真实数量', async () => {
    (repo.findTemplateByName as any).mockResolvedValue({ id: 'tpl-1', name: '聚气丹' });
    (repo.findRegularEntry as any).mockResolvedValue({ id: 'inv-1', quantity: 5 });
    expect(await service.getOwnedQuantityByName('save-1', '聚气丹')).toBe(5);
  });

  it('getOwnedQuantityByName：物品不在字典中或背包里没有时应返回 0', async () => {
    (repo.findTemplateByName as any).mockResolvedValue(null);
    expect(await service.getOwnedQuantityByName('save-1', '不存在的物品')).toBe(0);

    (repo.findTemplateByName as any).mockResolvedValue({ id: 'tpl-1', name: '聚气丹' });
    (repo.findRegularEntry as any).mockResolvedValue(null);
    expect(await service.getOwnedQuantityByName('save-1', '聚气丹')).toBe(0);
  });
});

describe('InventoryService 其他增删改查方法', () => {
  let repo: InventoryRepository;
  let service: InventoryService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new InventoryService({} as any, repo);
  });

  it('getInventory：应将字典物品与自定义物品格式化为统一结构', async () => {
    (repo.findAllBySave as any).mockResolvedValue([
      {
        id: 'inv-1',
        quantity: 2,
        is_equipped: false,
        items_template: { name: '聚气丹', rarity: 1, description: '恢复灵力', category: 'consumable' },
      },
      {
        id: 'inv-2',
        quantity: 1,
        is_equipped: true,
        items_template: null,
        custom_name: '上古骨片',
        custom_data: { rarity: 3, description: '来历不明', category: 'material' },
      },
    ]);

    const result = await service.getInventory('save-1');

    expect(result).toEqual([
      {
        inventoryId: 'inv-1',
        name: '聚气丹',
        quantity: 2,
        isEquipped: false,
        type: 'template',
        rarity: 1,
        description: '恢复灵力',
        category: 'consumable',
      },
      {
        inventoryId: 'inv-2',
        name: '上古骨片',
        quantity: 1,
        isEquipped: true,
        type: 'custom',
        rarity: 3,
        description: '来历不明',
        category: 'material',
        effects: undefined,
      },
    ]);
  });

  it('getInventoryPromptString：背包为空时应返回“空无一物”', async () => {
    (repo.findAllBySave as any).mockResolvedValue([]);
    const result = await service.getInventoryPromptString('save-1');
    expect(result).toBe('空无一物');
  });

  it('getInventoryPromptString：应拼接为“名称 x数量”的字符串，自定义物品带阶位标签', async () => {
    (repo.findAllBySave as any).mockResolvedValue([
      { items_template: { name: '聚气丹' }, quantity: 2 },
      { items_template: null, custom_name: '上古骨片', custom_data: { rarity: 3 }, quantity: 1 },
    ]);
    const result = await service.getInventoryPromptString('save-1');
    expect(result).toBe('聚气丹 x2，上古骨片(3阶) x1');
  });

  it('deleteEntry：条目不存在时应抛出异常', async () => {
    (repo.findById as any).mockResolvedValue(null);
    await expect(service.deleteEntry('inv-missing')).rejects.toThrow('背包条目不存在');
  });

  it('deleteEntry：条目存在时应调用仓库删除', async () => {
    (repo.findById as any).mockResolvedValue({ id: 'inv-1' });
    await service.deleteEntry('inv-1');
    expect(repo.deleteById).toHaveBeenCalledWith('inv-1');
  });

  it('setQuantity：数量 <= 0 时应删除条目而不是设置为 0', async () => {
    (repo.findById as any).mockResolvedValue({ id: 'inv-1' });
    await service.setQuantity('inv-1', 0);
    expect(repo.deleteById).toHaveBeenCalledWith('inv-1');
    expect(repo.setQuantity).not.toHaveBeenCalled();
  });

  it('setEquipped：条目不存在时应抛出异常', async () => {
    (repo.findById as any).mockResolvedValue(null);
    await expect(service.setEquipped('inv-missing', true)).rejects.toThrow('背包条目不存在');
  });
});

describe('InventoryService.detectFabricatedItemUsage（物品真实性校验，防止 AI 编造玩家使用了没有的道具）', () => {
  let repo: InventoryRepository;
  let service: InventoryService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new InventoryService({} as any, repo);
  });

  it('正常路径：行动文本未提及任何字典物品时应放行（返回 null）', async () => {
    (repo.listAllTemplateNames as any).mockResolvedValue([{ name: '聚气丹' }, { name: '传音符' }]);
    (repo.findAllBySave as any).mockResolvedValue([]);

    const result = await service.detectFabricatedItemUsage('save-1', '谨慎进入洞府查看情况');
    expect(result).toBeNull();
  });

  it('正常路径：行动文本提及的字典物品玩家确实拥有时应放行', async () => {
    (repo.listAllTemplateNames as any).mockResolvedValue([{ name: '传音符' }]);
    (repo.findAllBySave as any).mockResolvedValue([
      { quantity: 1, items_template: { name: '传音符' }, custom_name: null },
    ]);

    const result = await service.detectFabricatedItemUsage('save-1', '捏碎传音符呼救');
    expect(result).toBeNull();
  });

  it('异常路径（核心 Bug 复现）：玩家没有该字典物品却在行动中声称使用，应返回拦截说明', async () => {
    (repo.listAllTemplateNames as any).mockResolvedValue([{ name: '传音符' }]);
    (repo.findAllBySave as any).mockResolvedValue([]); // 背包为空

    const result = await service.detectFabricatedItemUsage('save-1', '捏碎随身传音符逃窜');
    expect(result).not.toBeNull();
    expect(result).toContain('传音符');
    expect(result).toContain('并无此物');
  });

  it('边界情况：字典物品数量为 0 时，视为“没有”，同样应拦截', async () => {
    (repo.listAllTemplateNames as any).mockResolvedValue([{ name: '聚气丹' }]);
    (repo.findAllBySave as any).mockResolvedValue([
      { quantity: 0, items_template: { name: '聚气丹' }, custom_name: null },
    ]);

    const result = await service.detectFabricatedItemUsage('save-1', '服下聚气丹恢复灵力');
    expect(result).toContain('聚气丹');
  });
});

describe('InventoryService.applyItemChanges（批量事务处理，供 AI 推演结果使用）', () => {
  it('正常路径：混合获得与消耗，应在同一次事务内全部生效', async () => {
    /**
     * 构造一个最小化的“伪 Prisma”：$transaction 直接把自身当作 tx 传给回调，
     * 内部用一个数组模拟 player_inventory 表，从而验证 applyItemChanges
     * 内部对 InventoryRepository/InventoryService 的组合调用是否正确。
     */
    const templates = [{ id: 'tpl-1', name: '聚气丹' }];
    const inventoryRows: any[] = [
      { id: 'inv-1', save_id: 'save-1', item_id: 'tpl-1', quantity: 3, items_template: templates[0] },
    ];

    const fakePrisma: any = {
      items_template: {
        findFirst: vi.fn(({ where: { name } }: any) =>
          Promise.resolve(templates.find((t) => t.name === name) ?? null),
        ),
      },
      player_inventory: {
        findFirst: vi.fn(({ where }: any) =>
          Promise.resolve(
            inventoryRows.find((r) => r.save_id === where.save_id && r.item_id === where.item_id) ?? null,
          ),
        ),
        findUnique: vi.fn(({ where: { id } }: any) =>
          Promise.resolve(inventoryRows.find((r) => r.id === id) ?? null),
        ),
        create: vi.fn(({ data }: any) => {
          const row = { ...data };
          inventoryRows.push(row);
          return Promise.resolve(row);
        }),
        update: vi.fn(({ where: { id }, data }: any) => {
          const row = inventoryRows.find((r) => r.id === id);
          if (data.quantity?.increment !== undefined) {
            row.quantity += data.quantity.increment;
          } else if (data.quantity !== undefined) {
            row.quantity = data.quantity;
          }
          return Promise.resolve(row);
        }),
        delete: vi.fn(({ where: { id } }: any) => {
          const idx = inventoryRows.findIndex((r) => r.id === id);
          const [removed] = inventoryRows.splice(idx, 1);
          return Promise.resolve(removed);
        }),
      },
      $transaction: vi.fn((callback: any) => callback(fakePrisma)),
    };

    const service = new InventoryService(fakePrisma);

    await service.applyItemChanges('save-1', [
      { name: '聚气丹', change: -1 }, // 消耗
      { name: '天材地宝', change: 1, rarity: 5, effects: { hp_delta: 9999 } }, // 自定义物品，需熔断
    ]);

    expect(inventoryRows.find((r) => r.id === 'inv-1')?.quantity).toBe(2);
    const custom = inventoryRows.find((r) => r.custom_name === '天材地宝');
    expect(custom).toBeDefined();
    expect(custom.custom_data.rarity).toBe(CUSTOM_ITEM_LIMITS.MAX_RARITY);
    expect(custom.custom_data.effects.hp_delta).toBe(CUSTOM_ITEM_LIMITS.MAX_HP_DELTA);
  });

  it('异常抛出：消耗数量超过库存时，整个事务应失败', async () => {
    const templates = [{ id: 'tpl-1', name: '聚气丹' }];
    const inventoryRows: any[] = [
      { id: 'inv-1', save_id: 'save-1', item_id: 'tpl-1', quantity: 1 },
    ];
    const fakePrisma: any = {
      items_template: {
        findFirst: vi.fn(({ where: { name } }: any) =>
          Promise.resolve(templates.find((t) => t.name === name) ?? null),
        ),
      },
      player_inventory: {
        findFirst: vi.fn(({ where }: any) =>
          Promise.resolve(
            inventoryRows.find((r) => r.save_id === where.save_id && r.item_id === where.item_id) ?? null,
          ),
        ),
      },
      $transaction: vi.fn((callback: any) => callback(fakePrisma)),
    };

    const service = new InventoryService(fakePrisma);

    await expect(
      service.applyItemChanges('save-1', [{ name: '聚气丹', change: -5 }]),
    ).rejects.toThrow('数量不足');
  });

  it('边界情况：change 为 0 的条目应被忽略，且空数组直接跳过事务', async () => {
    const fakePrisma: any = { $transaction: vi.fn() };
    const service = new InventoryService(fakePrisma);

    await service.applyItemChanges('save-1', [{ name: '聚气丹', change: 0 }]);

    expect(fakePrisma.$transaction).not.toHaveBeenCalled();
  });
});
