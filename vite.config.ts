import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — relative asset paths so the site works at https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
