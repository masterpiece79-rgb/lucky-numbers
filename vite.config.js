import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      external: ['@apps-in-toss/web-framework']
    }
  },
  server: {
    port: 5180
  }
})
