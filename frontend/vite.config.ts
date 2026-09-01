import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 放行 Cloudflare quick tunnel 的公网 Host（I06 L1 穿透），否则 vite 会 403
    allowedHosts: ['.trycloudflare.com'],
  },
})
