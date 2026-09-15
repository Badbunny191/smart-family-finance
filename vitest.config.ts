import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [
    // Vite plugin for Next.js
  ],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
