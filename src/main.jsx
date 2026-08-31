import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initNative } from '@/lib/native'
import { base44 } from '@/api/base44Client'
import { initResilientMode } from '@/lib/resilient-mode'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Initialize native wrapper behaviors (no-ops on web/PWA).
initNative()

// Auto on-device fallback: polls the server load signal and, under stress/outage, serves reads/UI/AI from the
// device + queues non-sensitive writes (sensitive actions stay online-only). No-op unless RESILIENT_MODE_ENABLED.
try { initResilientMode(base44) } catch { /* non-fatal */ }
