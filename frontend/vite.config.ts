import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 固定前端端口：避免 Vite 默认 5173 被占时静默跳到别的端口，导致书签/隧道失效
    port: 5174,
    strictPort: true,
    // 放行 Cloudflare quick tunnel 的公网 Host（I06 L1 穿透），否则 vite 会 403
    allowedHosts: ['.trycloudflare.com'],
  },
})
