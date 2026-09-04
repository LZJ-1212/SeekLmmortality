/** 修订：2026-09-05 00:53 +08 lzj — 开发服默认 --host，给朋友隧道用 */
/** 修订：2026-09-05 01:31 +08 lzj — 游玩仍 5174；更新服用 npm run dev:update → 5175 */
/** 修订：2026-09-05 01:39 +08 lzj — 把仓库 VERSION 打进前端 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const versionLine = fs
  .readFileSync(path.join(repoRoot, 'VERSION'), 'utf8')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .find((s) => /^\d+\.\d+\.\d+$/.test(s))
const gameVersion = versionLine ?? '0.0.0'

export default defineConfig({
  plugins: [react()],
  define: {
    __GAME_VERSION__: JSON.stringify(gameVersion),
  },
  server: {
    host: true,
    // 固定前端端口：避免 Vite 默认 5173 被占时静默跳到别的端口，导致书签/隧道失效
    port: 5174,
    strictPort: true,
    // 放行 Cloudflare quick tunnel 的公网 Host（I06 L1 穿透），否则 vite 会 403
    allowedHosts: ['.trycloudflare.com'],
  },
})
