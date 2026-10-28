import { defineConfig } from 'vite';

// Keep Three.js in its own cacheable chunk so app code updates do not invalidate
// the renderer dependency. The source is still eagerly loaded by the game entry;
// this is a cache/bundle-boundary improvement, not a claim of lazy loading.
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-vendor';
        },
      },
    },
  },
});
