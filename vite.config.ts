import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    // The GeoJSON snapshots live in public/ and are copied verbatim; only the
    // app bundle is chunked.
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
  },
});
