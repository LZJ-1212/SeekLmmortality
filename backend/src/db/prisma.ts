import { PrismaClient } from '@prisma/client';

/**
 * 全局唯一 PrismaClient 实例。
 * 避免在 server.ts、脚本、测试中各自 new PrismaClient() 导致连接池膨胀。
 */
export const prisma = new PrismaClient();
