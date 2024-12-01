import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import topLevelAwait from 'vite-plugin-top-level-await';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
export default defineConfig(() => {
  return {
    publicDir: 'public',
    assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf'],
    build: {
      assetsDir: 'assets'
    },
    plugins: [
      react(),
      topLevelAwait({
        // The export name of top-level await promise for each chunk module
        promiseExportName: '__tla',
        // The function to generate import names of top-level await promise in each chunk module
        promiseImportName: (i) => `__tla_${i}`,
      }),
    ],
    server: {
      proxy: {
        '/backend': {
          target: 'http://localhost:8001',
          changeOrigin: true,
        },
      },
    },
  };
});
