import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Detect if running in Docker (packages at ./packages) or local dev (packages at ../../packages)
const packagesPath = fs.existsSync(path.resolve(__dirname, './packages/core'))
  ? './packages'
  : '../../packages';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()] as any,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@packages/core': path.resolve(__dirname, packagesPath, 'core'),
      '@packages/design-system': path.resolve(__dirname, packagesPath, 'design-system'),
      // Ensure date-fns is resolved from web's node_modules for react-day-picker
      'date-fns': path.resolve(__dirname, 'node_modules/date-fns')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
