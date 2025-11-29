import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Walrus Publisher API proxy - Primary (Mysten Labs)
      '/walrus-api': {
        target: 'https://publisher.walrus-testnet.walrus.space',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/walrus-api/, ''),
        secure: true,
      },
      // Walrus Publisher API proxy - Backup 1
      '/walrus-api-2': {
        target: 'https://wal-publisher-testnet.staketab.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/walrus-api-2/, ''),
        secure: true,
      },
      // Walrus Publisher API proxy - Backup 2
      '/walrus-api-3': {
        target: 'https://walrus-testnet-publisher.nodes.guru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/walrus-api-3/, ''),
        secure: true,
      },
      // Walrus Publisher API proxy - Backup 3
      '/walrus-api-4': {
        target: 'https://testnet-publisher.walrus.graphyte.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/walrus-api-4/, ''),
        secure: true,
      },
    },
  },
})
