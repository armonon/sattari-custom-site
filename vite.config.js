import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Prepare the score parser before its first worker import, avoiding a dev
  // dependency reload in the middle of the user's file selection.
  optimizeDeps: { include: ['@coderline/alphatab'] },
  // Strips the Sentry SDK's debug logging from production bundles.
  define: { __SENTRY_DEBUG__: false },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@context': path.resolve(__dirname, './src/context'),
      '@data': path.resolve(__dirname, './src/data'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  build: {
    manifest: true,
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    esbuild: {
      drop: ['console'],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          react_vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    open: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  },
});
