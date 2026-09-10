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
    include: ['jsqr'],
  },
  // Unit tests (scan queue, registration guard, CSV parsing). jsdom gives the
  // pure-logic modules a real localStorage + crypto without any DOM wiring.
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
