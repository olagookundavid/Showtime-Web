import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

/**
 * Clubs Arena is a second site built from this same folder: `vite --mode arena`
 * (or `npm run dev:arena` / `build:arena`) uses arena.html as its entry and
 * public-arena/ for its static files, so nothing of Showtime ships with it and
 * nothing of Arena ships with Showtime.
 */
function arenaEntry(): Plugin {
  return {
    name: 'arena-entry',
    enforce: 'post',
    // Dev: every page route is served by arena.html (Vite would pick index.html).
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '').split('?')[0]
        const isFile = /\.[a-z0-9]+$/i.test(path)
        const isInternal = path.startsWith('/@') || path.startsWith('/api') || path.startsWith('/src/') || path.startsWith('/node_modules/')
        if (!isFile && !isInternal && req.headers.accept?.includes('text/html')) {
          req.url = '/arena.html'
        }
        next()
      })
    },
    // Build: publish the page as index.html so the host serves it at "/".
    generateBundle(_options, bundle) {
      const page = bundle['arena.html']
      if (page && page.type === 'asset') {
        this.emitFile({ type: 'asset', fileName: 'index.html', source: page.source })
        delete bundle['arena.html']
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isArena = mode === 'arena'
  return {
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
      ...(isArena ? [arenaEntry()] : []),
    ],
    base: '/', // Ensures the app handles routing from the root
    publicDir: isArena ? 'public-arena' : 'public',
    server: {
      ...(isArena ? { port: 5174 } : {}),
      proxy: {
        // ws: the producer studio's WebSocket lives under /api/v1/admin/...
        '/api': {
          target: 'http://localhost:8089',
          changeOrigin: true,
          ws: true,
        },
        // Only the overlays' backend endpoints (per match and per event day) —
        // the /broadcast/.../overlay pages themselves are SPA routes.
        '^/broadcast/(day/)?[^/]+/overlay/(ws|state|scenes)$': {
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
        ...(isArena ? { input: 'arena.html' } : {}),
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
              // Heavy libraries that only a few screens use get their own chunks, so
              // the one every page loads stays small. heic2any is imported on demand
              // (photo uploads from an iPhone); html5-qrcode is the camera scanner.
              if (id.includes('heic2any')) return 'vendor-heic';
              if (id.includes('html5-qrcode')) return 'vendor-qr';
              return 'vendor';
            }
          }
        }
      }
    }
  }
})
