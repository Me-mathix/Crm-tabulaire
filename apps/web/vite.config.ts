import { defaultClientConditions, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Lit directement les sources TypeScript de @crm/shared (export "source") :
    // pas de compilation préalable côté front, et rechargement à chaud.
    conditions: ['source', ...defaultClientConditions],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: process.env.VITE_USE_POLLING === 'true',
    },
    // Le front appelle /api/... ; Vite relaie vers NestJS (pas de CORS à gérer)
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
