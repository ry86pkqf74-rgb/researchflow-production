import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Dynamic imports for optional production plugins
let productionPlugins = [];

// Only load production plugins in production mode to improve dev performance
if (process.env.NODE_ENV === 'production' || process.env.ANALYZE === 'true') {
  // Lazy load compression plugin for production (gzip + brotli)
  try {
    const compressionPlugin = require('vite-plugin-compression').default;

    // Gzip compression
    productionPlugins.push(
      compressionPlugin({
        verbose: true,
        disable: false,
        threshold: 10240, // 10KB - only compress files larger than 10KB
        algorithm: 'gzip',
        ext: '.gz',
        deleteOriginFile: false
      })
    );

    // Brotli compression (better compression ratio than gzip)
    productionPlugins.push(
      compressionPlugin({
        verbose: true,
        disable: false,
        threshold: 10240,
        algorithm: 'brotli',
        ext: '.br',
        deleteOriginFile: false
      })
    );
  } catch (e) {
    // Plugin not installed, will be optional
  }

  // Lazy load visualizer plugin for bundle analysis
  try {
    const { visualizer } = require('rollup-plugin-visualizer');
    productionPlugins.push(
      visualizer({
        open: process.env.ANALYZE === 'true',
        gzipSize: true,
        brotliSize: true,
        filename: 'dist/stats.html',
        title: 'ResearchFlow Bundle Analysis',
        template: 'treemap' // or 'sunburst', 'table'
      })
    );
  } catch (e) {
    // Plugin not installed, will be optional
  }
}

// Detect if running in Docker (packages at ./packages) or local dev (packages at ../../packages)
const packagesPath = fs.existsSync(path.resolve(__dirname, './packages/core'))
  ? './packages'
  : '../../packages';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), ...productionPlugins] as any,
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
    // Minification settings with all optimizations
    minify: 'esbuild',
    // Define esbuild minify options
    esbuild: {
      // Drop console logs in production
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : undefined,
      // Pure functions for better tree-shaking
      pure: ['console.log'],
    },
    // Rollup options for code splitting and optimization
    rollupOptions: {
      // Mark optional/backend-only dependencies as external to prevent build failures
      // - @sentry/react: Optional, only needed if VITE_SENTRY_DSN is set
      // - drizzle-orm: Backend ORM, should not be in frontend bundle
      // - pg, postgres: Database drivers, backend only
      external: ['@sentry/react', 'drizzle-orm', 'drizzle-orm/pg-core', 'pg', 'postgres'],
      output: {
        // Handle external modules gracefully at runtime
        globals: {
          '@sentry/react': 'Sentry'
        },
        // Ensure proper file naming for cache busting
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|svg/.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          } else if (/woff|woff2|eot|ttf|otf/.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        // Manual chunks for optimal caching and code splitting
        // Vendor chunk strategy: split by library to enable granular caching
        manualChunks: (id, { getModuleInfo }) => {
          // Skip node_modules for entry points
          if (!id.includes('node_modules')) {
            return;
          }

          // React core - changes rarely (high benefit from separate chunk)
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }

          // Router - changes with React
          if (id.includes('react-router') || id.includes('wouter')) {
            return 'vendor-react';
          }

          // Radix UI components library
          if (id.includes('@radix-ui')) {
            return 'vendor-ui';
          }

          // TanStack Query for data fetching (large library)
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query')) {
            return 'vendor-query';
          }

          // Rich text editor and ProseMirror (large, specialized)
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'vendor-editor';
          }

          // Charts (large visualization library)
          if (id.includes('recharts')) {
            return 'vendor-charts';
          }

          // D3 utilities (if included)
          if (id.includes('d3')) {
            return 'vendor-d3';
          }

          // Date utilities (commonly used, stable)
          if (id.includes('date-fns')) {
            return 'vendor-date';
          }

          // React day picker
          if (id.includes('react-day-picker')) {
            return 'vendor-date';
          }

          // Collaborative editing - Yjs and websocket
          if (id.includes('yjs')) {
            return 'vendor-collab';
          }

          if (id.includes('y-websocket') || id.includes('y-prosemirror')) {
            return 'vendor-collab';
          }

          // Flow visualization (specialized, large)
          if (id.includes('reactflow')) {
            return 'vendor-flow';
          }

          // Form handling libraries
          if (id.includes('react-hook-form')) {
            return 'vendor-forms';
          }

          // Schema validation
          if (id.includes('zod') || id.includes('drizzle-zod')) {
            return 'vendor-validation';
          }

          // Animations
          if (id.includes('framer-motion')) {
            return 'vendor-anim';
          }

          // Utility libraries
          if (id.includes('class-variance-authority') || id.includes('clsx') || id.includes('classnames')) {
            return 'vendor-utils';
          }

          // Lodash
          if (id.includes('lodash')) {
            return 'vendor-lodash';
          }

          // All other vendor libraries in a common vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor-common';
          }
        }
      }
    },
    // Chunk size warnings at 500KB
    chunkSizeWarningLimit: 500,
    // Report compressed size for all chunks
    reportCompressedSize: true,
    // Enable dynamic imports for route-based code splitting
    dynamicImportVarsOptions: {
      warnOnError: true,
      exclude: ['node_modules']
    },
    // Optimize CSS
    cssCodeSplit: true,
    // Pre-compress assets
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log'],
        passes: 3, // More aggressive minification
      },
      mangle: {
        properties: {
          keep_quoted: true
        }
      }
    }
  },
  // Environment variables configuration
  define: {
    'import.meta.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  }
});
