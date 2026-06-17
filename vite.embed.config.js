import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    lib: {
      entry: 'src/embed.jsx',
      name: 'SpecEmbed',
      formats: ['iife'],
      fileName: () => 'spec-embed.js',
    },
    outDir: 'dist-embed',
    emptyOutDir: true,
    cssCodeSplit: false,
  },
});
