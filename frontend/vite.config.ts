import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '4040'),
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}) 