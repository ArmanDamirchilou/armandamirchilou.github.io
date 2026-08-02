import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves project repos from /<repo>/, user repos from /.
  // The deploy workflow sets VITE_BASE accordingly; local dev stays at /.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Generated speech WAVs are served by Express; without this the dev
      // server answers with index.html and audio playback fails silently.
      '/audio': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ['**/model.glb', '**/public/audio/**'],
    },
  },
  assetsInclude: ['**/*.glb'],
});
