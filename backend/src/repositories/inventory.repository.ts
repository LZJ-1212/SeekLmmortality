import type { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';

/**
 * 背包数据访问层（Repository）。
 * 职责单一：只负责与 player_inventory / items_template 表的读写，
 * 不包含任何业务规则（叠加、熔断、格式化等），业务规则一律交由 Service 层处理。
 */
export class InventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** 查询某个存档下的全部背包条目（含物品字典关联） */
  findAllBySave(saveId: string) {
    return this.prisma.player_inventory.findMany({
      where: { save_id: saveId },
      include: { items_template: true },
    });
  }

  /** 按主键查询单个背包条目 */
  findById(inventoryId: string) {
    return this.prisma.player_inventory.findUnique({
      where: { id: inventoryId },
      include: { items_template: true },
    });
  }

  /** 查询某存档下，某个字典物品（item_id）对应的背包条目（用于判断是否需要叠加） */
  findRegularEntry(saveId: string, itemId: string) {
    return this.prisma.player_inventory.findFirst({
      where: { save_id: saveId, item_id: itemId },
    });
  }

  /** 按名称查询单个物品字典模板 */
  findTemplateByName(name: string) {
    return this.prisma.items_template.findFirst({ where: { name } });
  }

  /** 查询物品字典中的全部物品名称（用于校验玩家行动文本中提到的物品是否真实存在） */
  listAllTemplateNames() {
    return this.prisma.items_template.findMany({ select: { name: true } });
  }

  /** 新建一条“字典物品”背包条目 */
  createRegularEntry(saveId: string, itemId: string, quantity: number) {
    return this.prisma.player_inventory.create({
      data: {
        id: crypto.randomUUID(),
        save_id: saveId,
        item_id: itemId,
        quantity,
        is_equipped: false,
      },
    });
  }

  /** 新建一条“AI 自定义物品”背包条目 */
  createCustomEntry(
    saveId: string,
    customName: string,
    customData: Prisma.InputJsonValue,
    quantity: number,
  ) {
    return this.prisma.player_inventory.create({
      data: {
        id: crypto.randomUUID(),
        save_id: saveId,
        item_id: null,
        custom_name: customName,
        custom_data: customData,
        quantity,
        is_equipped: false,
      },
    });
  }

  /** 在现有数量基础上增减（正数为增加，负数为减少） */
  incrementQuantity(inventoryId: string, amount: number) {
    return this.prisma.player_inventory.update({
      where: { id: inventoryId },
      data: { quantity: { increment: amount } },
    });
  }

  /** 直接设置数量为某个值 */
  setQuantity(inventoryId: string, quantity: number) {
    return this.prisma.player_inventory.update({
      where: { id: inventoryId },
      data: { quantity },
    });
  }

  /** 设置装备状态 */
  setEquipped(inventoryId: string, isEquipped: boolean) {
    return this.prisma.player_inventory.update({
      where: { id: inventoryId },
      data: { is_equipped: isEquipped },
    });
  }

  /** 删除一条背包条目 */
  deleteById(inventoryId: string) {
    return this.prisma.player_inventory.delete({ where: { id: inventoryId } });
  }
}
