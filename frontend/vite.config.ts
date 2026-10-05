import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/', // Ensures the app handles routing from the root
  server: {
    proxy: {
      // ws: the producer studio's WebSocket lives under /api/v1/admin/...
      '/api': {
        target: 'http://localhost:8089',
        changeOrigin: true,
        ws: true,
      },
      // Only the overlay's backend endpoints — /broadcast/:id/overlay itself is a SPA page.
      '^/broadcast/[^/]+/overlay/(ws|state)$': {
        target: 'http://localhost:8089',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})

