/**
 * 修订：2026-09-05 01:11 +08 lzj — 按口令哈希判断存档是否可见
 */
import type { PrismaClient } from '@prisma/client';

/** 无请求仓（本机未带头）可见全部；有仓则必须哈希一致（含旧档 null ≠ 公网仓） */
export function canAccessSave(saveOwnerHash: string | null | undefined, requesterHash: string | null): boolean {
  if (!requesterHash) return true;
  return saveOwnerHash === requesterHash;
}

export async function isSaveVisibleToOwner(
  prisma: PrismaClient,
  saveId: string,
  requesterHash: string | null,
): Promise<boolean> {
  const save = await prisma.saves.findUnique({
    where: { id: saveId },
    select: { owner_token_hash: true },
  });
  if (!save) return false;
  return canAccessSave(save.owner_token_hash, requesterHash);
}

export async function isPlayerVisibleToOwner(
  prisma: PrismaClient,
  playerId: string,
  requesterHash: string | null,
): Promise<boolean> {
  const player = await prisma.players.findUnique({
    where: { id: playerId },
    select: { save_id: true },
  });
  if (!player) return false;
  return isSaveVisibleToOwner(prisma, player.save_id, requesterHash);
}
