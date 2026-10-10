import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:3000',
      '/ready': 'http://localhost:3000',
      '/services': 'http://localhost:3000',
      '/dashboard': 'http://localhost:3000',
      '/alert-rules': 'http://localhost:3000',
      '/alerts': 'http://localhost:3000',
      '/incidents': 'http://localhost:3000',
    },
  },
})
