import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// One-time cleanup: this dev port (5173) previously hosted another PWA (a portfolio
// site) whose service worker keeps serving its cached pages here. Unregister any
// leftover service worker and clear cache storage for this origin so THIS app loads.
// Safe no-op once nothing is cached. Runs only in the browser.
async function purgeStaleServiceWorkers() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      let removed = 0
      for (const reg of regs) {
        // eslint-disable-next-line no-await-in-loop
        await reg.unregister()
        removed++
      }
      if (removed > 0 && 'caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
        // A hard reload is needed once so the page is served fresh, not from the SW.
        window.location.reload()
        return true
      }
    }
  } catch {
    // ignore — cleanup is best-effort
  }
  return false
}

purgeStaleServiceWorkers().then((reloading) => {
  if (reloading) return // page is reloading; skip mounting to avoid a flash
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
})
