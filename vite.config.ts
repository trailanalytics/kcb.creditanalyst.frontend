import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY || 'http://localhost:8080'

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: true,
      port: 5173,
      // Same-origin in every environment: the SPA always calls /api and the proxy (dev) or nginx (prod) forwards it.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/actuator': { target: apiTarget, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.spec.ts'],
    },
  }
})
