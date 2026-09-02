import { Router, type Request, type Response } from 'express';
import { requirePlayToken, sanitizeAction, hitsInjectionBlocklist } from '../gateway';
import { ActionService } from '../services/action.service';

/**
 * 天道推演路由：/api/action。
 * 网关层职责（净化 / 注入黑名单）在此完成，推演编排逻辑全部在 ActionService。
 */
const router = Router();
const actionService = new ActionService();

/** 天道推演：处理玩家行动 */
router.post('/action', requirePlayToken, async (req: Request, res: Response) => {
  const { playerId } = req.body;

  // S21 层 C：行动文本净化（空串/非法不可见字符/超长一律 400，不静默截断）
  const sanitized = sanitizeAction(req.body.action);
  if (!sanitized.ok) {
    const message = sanitized.code === 'empty'
      ? '请先述说所行之事。'
      : sanitized.code === 'too_long'
        ? '所言过繁，请精简至二百字内。'
        : '所言含天机不容之字符。';
    return res.status(400).json({ status: 'error', message });
  }
  const action = sanitized.text;

  // S21 层 D：注入黑名单（命令模型改数值/泄密），命中即拒绝，不调 DeepSeek
  if (hitsInjectionBlocklist(action)) {
    return res.status(400).json({ status: 'error', message: '此言大逆天道，天机不予推演。' });
  }

  const result = await actionService.execute(playerId, action);
  if (!result.ok) {
    return res.status(result.status).json({ status: 'error', message: result.message });
  }
  res.json({ status: 'success', data: result.data });
});

export default router;
