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
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
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
    // Disable sourcemaps in production for security and smaller bundles
    sourcemap: process.env.NODE_ENV !== 'production',
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Minification settings
    minify: 'esbuild',
    rollupOptions: {
      // Mark optional dependencies as external to prevent build failures
      // when they're not installed (Sentry is optional - only needed if VITE_SENTRY_DSN is set)
      external: ['@sentry/react'],
      output: {
        // Handle external modules gracefully at runtime
        globals: {
          '@sentry/react': 'Sentry'
        },
        // Manual chunks for optimal caching and code splitting
        manualChunks: (id) => {
          // React core - changes rarely
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // Router - changes with React
          if (id.includes('react-router')) {
            return 'vendor-react';
          }
          // Radix UI components
          if (id.includes('@radix-ui')) {
            return 'vendor-ui';
          }
          // TanStack Query for data fetching
          if (id.includes('@tanstack')) {
            return 'vendor-query';
          }
          // TipTap editor
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'vendor-editor';
          }
          // Charts
          if (id.includes('recharts') || id.includes('d3')) {
            return 'vendor-charts';
          }
          // Date utilities
          if (id.includes('date-fns') || id.includes('react-day-picker')) {
            return 'vendor-date';
          }
        }
      }
    },
    // Chunk size warnings at 500KB
    chunkSizeWarningLimit: 500
  }
});
