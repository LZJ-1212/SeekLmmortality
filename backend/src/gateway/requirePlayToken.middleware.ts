import type { NextFunction, Request, Response } from 'express';
import { PLAY_TOKEN_HEADER } from './constants';
import { doesPlayTokenMatch, mustEnforcePlayToken, resolveSaveOwnerHash } from './playToken';

/**
 * 修订：2026-09-05 01:11 +08 lzj — 把匹配口令的存档仓哈希挂到 req
 *
 * 游玩口令中间件：未配置、或本机直连 3000 → 放行；
 * 已配置且请求经隧道/反代进来 → 必须带匹配令牌，否则 401。
 * 无论是否强制校验，只要头能对上某一口令，就写入 saveOwnerHash 供列表隔离。
 */
export function requirePlayToken(req: Request, res: Response, next: NextFunction): void {
  req.saveOwnerHash = resolveSaveOwnerHash(req.header(PLAY_TOKEN_HEADER));
  if (!mustEnforcePlayToken((name) => req.header(name))) {
    next();
    return;
  }
  if (doesPlayTokenMatch(req.header(PLAY_TOKEN_HEADER))) {
    next();
    return;
  }
  res.status(401).json({ status: 'error', message: '天机有封，须持令牌。' });
}
