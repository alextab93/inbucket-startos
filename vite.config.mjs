import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname, 'frontend'),
  build: {
    outDir: resolve(import.meta.dirname, 'public'),
    emptyOutDir: true,
  },
});
