import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/health': 'http://127.0.0.1:5055',
      '/remove': 'http://127.0.0.1:5055',
    },
  },
})
