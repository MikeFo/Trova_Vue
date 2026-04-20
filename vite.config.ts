/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'
import { defineConfig } from 'vite'

const keyPath = path.resolve(__dirname, './.cert/key.pem')
const certPath = path.resolve(__dirname, './.cert/cert.pem')

/** Local HTTPS for `vite dev` only; certs are gitignored and absent on CI (e.g. Netlify). */
function getLocalHttps(): { key: Buffer; cert: Buffer } | undefined {
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return undefined
  }
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const https = command === 'serve' ? getLocalHttps() : undefined

  return {
    plugins: [
      vue(),
      legacy()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      ...(https ? { https } : {}),
      host: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none'
      },
      proxy: {
        '/api': {
          target: process.env.VITE_API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          secure: false, // Set to false for localhost
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom'
    }
  }
})
