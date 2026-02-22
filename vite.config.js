import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PROD_API = 'https://rise-production.vercel.app';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VERCEL ? '/' : (process.env.NODE_ENV === 'production' ? '/rise/' : '/'),
  plugins: [react()],
  server: {
    proxy: {
      '/api/markets': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => '/markets?closed=false&limit=50&order=volume24hr&ascending=false'
      },
      '/api/stocks-free': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api/stocks': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api/commodities': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api/latest': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api/history': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
    }
  }
})
