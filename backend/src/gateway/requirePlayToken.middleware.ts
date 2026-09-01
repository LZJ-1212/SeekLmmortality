import type { NextFunction, Request, Response } from 'express';
import { PLAY_TOKEN_HEADER } from './constants';
import { doesPlayTokenMatch, mustEnforcePlayToken } from './playToken';

/**
 * 游玩口令中间件：未配置、或本机直连 3000 → 放行；
 * 已配置且请求经隧道/反代进来 → 必须带匹配令牌，否则 401。
 */
export function requirePlayToken(req: Request, res: Response, next: NextFunction): void {
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
