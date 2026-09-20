import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 43123,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
