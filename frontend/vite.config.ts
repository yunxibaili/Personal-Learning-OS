import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// ADR-029 §2.4：dev 期经 proxy 同源转发到后端（backend 无 CORS 中间件，零后端改动）。
// 后端端口可用 API_PORT 环境变量覆盖（默认 8000，与 AGENTS §17/§18 一致）。
const apiTarget = `http://127.0.0.1:${process.env.API_PORT ?? "8000"}`

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': { target: apiTarget, changeOrigin: false },
    },
  },
})
