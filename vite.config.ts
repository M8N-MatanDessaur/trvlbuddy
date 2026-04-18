import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html'
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      // Places API (new) v1 — gives us primaryTypeDisplayName so cards show
      // the actual Google category ("Fresh food market") instead of a bucket
      // from a hand-rolled label table.
      '/api/placesv1': {
        target: 'https://places.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/placesv1/, '/v1'),
      },
      // Legacy Places API — still used for Place Details photo fetch and the
      // broad type-count scan that feeds Gemini chip suggestions.
      '/api/places': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/places/, '/maps/api/place'),
      },
    },
  },
});