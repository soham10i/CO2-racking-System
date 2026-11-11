import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { Providers } from './app/Providers'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './index.css'
import { startSmoothScroll } from './lib/smoothScroll'

startSmoothScroll()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)

// Installable app shell; skipped in dev so Vite's hot reload is never served from a cache.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
