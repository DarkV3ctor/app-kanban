import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — относительные пути, чтобы сайт работал на https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
