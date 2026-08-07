import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/remote/analytics-app/',
  build: {
    outDir: path.resolve(__dirname, '../remote/analytics-app'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/analytics.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/analytics[extname]',
      },
    },
  },
})
