/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    // The CSP allows fonts only from 'self', so KaTeX's small fonts must not be inlined as data: URIs.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf)$/.test(file) ? false : undefined),
  },
  server: {
    port: 5173,
    // Same-origin API in dev: no CORS needed, refresh cookie stays first-party.
    proxy: { '/api': 'http://localhost:8080' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
