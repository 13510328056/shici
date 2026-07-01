import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 15174,
    proxy: {
      '/api': { target: 'http://localhost:18003', changeOrigin: true },
    },
  },
})
