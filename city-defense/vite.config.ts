import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Relative base so the build works when hosted from a subfolder
  // (raw.githack.com, GitHub Pages with a project path, etc.).
  base: './',
  server: { port: 5173, open: false },
  build: { target: 'es2022', outDir: 'dist', sourcemap: false },
});
