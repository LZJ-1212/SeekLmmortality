/**
 * 修订：2026-09-05 01:11 +08 lzj — Express 请求挂存档仓哈希
 */
declare namespace Express {
  interface Request {
    /** 当前请求口令对应的存档仓；未带头或未匹配则为 null（本机服主） */
    saveOwnerHash?: string | null;
  }
}
