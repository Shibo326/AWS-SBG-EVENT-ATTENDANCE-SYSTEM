/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    host: true,   // exposes on LAN so you can open on phone: http://<laptop-ip>:8081
  },
  optimizeDeps: {
    include: ['html5-qrcode', 'jspdf', 'jspdf-autotable', 'firebase/app', 'firebase/database', 'firebase/auth'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}', '*.{test,spec}.{js,jsx}'],
  },
})
