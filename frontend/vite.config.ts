import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/', // Ensures the app handles routing from the root
  build: {
    chunkSizeWarningLimit: 1000,
    // This helps with "after a while" 404s by ensuring assets are handled cleanly
    outDir: 'dist',
  }
})

