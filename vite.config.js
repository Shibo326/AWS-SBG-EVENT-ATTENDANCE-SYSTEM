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
    include: ['jsqr', 'firebase/app', 'firebase/database', 'firebase/auth'],
  },
  // Unit tests. jsdom gives the pure-logic modules a real localStorage + crypto,
  // and jest-dom matchers for any component tests via the setup file.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}', '*.{test,spec}.{js,jsx}'],
  },
})
