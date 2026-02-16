import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // No base path for Vercel (deploys at root)
  // For GitHub Pages deployment, build with base: '/rise/' manually
  plugins: [react()],
  server: {
    proxy: {
      '/api/markets': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => '/markets?closed=false&limit=50&order=volume24hr&ascending=false'
      },
      '/api/stocks': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          const symbols = new URLSearchParams(path.split('?')[1]).get('symbols') || 'AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA';
          return `/v7/finance/quote?symbols=${symbols}`;
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          });
        }
      }
    }
  }
})
