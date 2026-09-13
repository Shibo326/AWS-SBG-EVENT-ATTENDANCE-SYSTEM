import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import './index.css'

// Mount the app immediately — nothing blocks the first paint.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

// Best-effort, fire-and-forget cleanup: this dev port may have previously hosted
// another PWA whose service worker/cache could shadow this app. Unregister and
// clear them AFTER mount. This never reloads the page, so it can never loop.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => {})
}
if (typeof window !== 'undefined' && 'caches' in window) {
  caches
    .keys()
    .then((keys) => keys.forEach((k) => caches.delete(k)))
    .catch(() => {})
}
