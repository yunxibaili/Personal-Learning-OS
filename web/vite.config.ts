import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 开发期：浏览器仅是前端视图；API 走 proxy 到本机 FastAPI（network-boundary：仅回环）
const apiPort = process.env.API_PORT ?? "8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1", // 显式 IPv4 回环；默认 localhost 可能解析为 ::1 导致代理/访问不一致
    port: 5173,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
