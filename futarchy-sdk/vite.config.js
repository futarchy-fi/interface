import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // Serve from current directory
  server: {
    port: 3000,
    open: '/futarchy.html' // Auto-open the futarchy interface
  },
  optimizeDeps: {
    exclude: ['viem'], // Don't bundle viem, use CDN
    include: ['@cowprotocol/cow-sdk'] // Force CoW SDK to be pre-bundled
  },
  define: {
    global: 'globalThis',
    'process.env': {}
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process',
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      path: 'path-browserify',
      os: 'os-browserify',
      url: 'url',
      util: 'util'
    }
  },
  build: {
    rollupOptions: {
      plugins: []
    }
  }
}); 