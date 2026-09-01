import type { NextFunction, Request, Response } from 'express';
import { PLAY_TOKEN_HEADER } from './constants';
import { doesPlayTokenMatch, isPlayTokenConfigured } from './playToken';

/**
 * 游玩口令中间件：未配置口令时放行（本机开发）；配置后所有受保护路由必须携带匹配令牌，否则 401。
 */
export function requirePlayToken(req: Request, res: Response, next: NextFunction): void {
  if (!isPlayTokenConfigured()) {
    next();
    return;
  }
  if (doesPlayTokenMatch(req.header(PLAY_TOKEN_HEADER))) {
    next();
    return;
  }
  res.status(401).json({ status: 'error', message: '天机有封，须持令牌。' });
}
