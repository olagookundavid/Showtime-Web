import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Regression guard: compresses anything copied from public/ or imported
    // from src/ at build time, so a future unoptimized image doesn't quietly
    // ship at full size again.
    ViteImageOptimizer({
      png: { quality: 85 },
      jpeg: { quality: 80 },
      jpg: { quality: 80 },
      webp: { quality: 85 },
    }),
  ],
  base: '/', // Ensures the app handles routing from the root
  server: {
    proxy: {
      // ws: the producer studio's WebSocket lives under /api/v1/admin/...
      '/api': {
        target: 'http://localhost:8089',
        changeOrigin: true,
        ws: true,
      },
      // Only the overlays' backend endpoints (per match and per event day) —
      // the /broadcast/.../overlay pages themselves are SPA routes.
      '^/broadcast/(day/)?[^/]+/overlay/(ws|state)$': {
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
            // The rich-text editor engine, loaded only when an admin opens an
            // editor (RichTextEditor lazy-loads it), never on public pages.
            if (/[\\/](@tiptap|prosemirror-[^\\/]+|@floating-ui|orderedmap|rope-sequence|w3c-keyname|linkifyjs)[\\/]/.test(id)) {
              return 'vendor-editor';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})

