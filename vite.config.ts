/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  /** Local HTTPS only for `vite dev`. Never read .cert/* during `vite build` (CI has no certs). */
  const server: Record<string, unknown> = {
    port: 5173,
    strictPort: true,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api/, ''),
        secure: false,
        configure: (proxy: import('http-proxy').ProxyServer) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err)
          })
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('Sending Request to the Target:', req.method, req.url)
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url)
          })
        },
      },
    },
  }

  if (command === 'serve') {
    const keyPath = path.resolve(__dirname, '.cert/key.pem')
    const certPath = path.resolve(__dirname, '.cert/cert.pem')
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      server.https = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    } else {
      console.warn('[vite] .cert/key.pem or .cert/cert.pem not found — dev server without HTTPS')
    }
  }

  return {
    plugins: [vue(), legacy()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: server as import('vite').ServerOptions,
    test: {
      globals: true,
      environment: 'jsdom',
    },
  }
})
