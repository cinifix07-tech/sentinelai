import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const adminRoot = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(adminRoot, '../backend')

function backendDevServer() {
  return {
    name: 'sentinel-backend-dev-server',
    configureServer(server) {
      const backend = spawn(process.execPath, ['src/server.js'], {
        cwd: backendRoot,
        env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
        stdio: 'inherit',
      })

      const stopBackend = () => {
        if (!backend.killed) backend.kill()
      }
      server.httpServer?.once('close', stopBackend)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [backendDevServer(), react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (error) => {
            if (error.code !== 'ECONNREFUSED') console.error('[vite] API proxy error:', error.message)
          })
        },
      },
    },
  },
})
