import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(import.meta.dirname, 'frontend'),
  test: {
    environment: 'jsdom',
    include: ['js/**/*.test.js'],
    setupFiles: [resolve(import.meta.dirname, 'test/frontend/setup.js')],
  },
  build: {
    outDir: resolve(import.meta.dirname, 'public'),
    emptyOutDir: true,
  },
})
