/**
 * 修订：2026-09-05 01:39 +08 lzj — 仓库根 VERSION 为游玩版本号唯一来源
 */
import fs from 'node:fs';
import path from 'node:path';

const VERSION_LINE = /^\d+\.\d+\.\d+$/;

/** 从 VERSION 文件正文取出 x.y.z；空行与 # 注释忽略 */
export function parseGameVersionText(raw: string): string {
  const line = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0 && !s.startsWith('#'));
  if (line && VERSION_LINE.test(line)) return line;
  return '0.0.0';
}

export function getGameVersion(): string {
  const filePath = path.join(__dirname, '..', '..', 'VERSION');
  try {
    return parseGameVersionText(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return '0.0.0';
  }
}
