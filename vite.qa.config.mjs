import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.js';

// Separate origin without HMR: long audio checks must not reload mid-take.
export default mergeConfig(
  base,
  defineConfig({
    server: {
      host: '127.0.0.1',
      port: 4192,
      strictPort: true,
      open: false,
      hmr: false,
      watch: null,
    },
  })
);
