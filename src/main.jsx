import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initNative } from '@/lib/native'
import { base44 } from '@/api/base44Client'
import { initResilientMode } from '@/lib/resilient-mode'
import { initPerfVitals } from '@/lib/perf-vitals'
import { initRoutePrefetch } from '@/lib/route-prefetch'
import { initLoadingSurvey } from '@/lib/loading-survey'

// Preconnect to the backend API origin (if it's a different origin) so the DNS + TLS handshake is already done
// by the time the first data call fires — shaving the network setup cost off the very first request.
try {
  const api = (import.meta.env?.VITE_NEXUS_API_URL || '').replace(/\/$/, '')
  if (api && typeof document !== 'undefined') {
    const o = new URL(api, window.location.href)
    if (o.origin !== window.location.origin) {
      for (const rel of ['preconnect', 'dns-prefetch']) {
        const l = document.createElement('link')
        l.rel = rel; l.href = o.origin; if (rel === 'preconnect') l.crossOrigin = 'anonymous'
        document.head.appendChild(l)
      }
    }
  }
} catch { /* non-fatal */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Initialize native wrapper behaviors (no-ops on web/PWA).
initNative()

// Real load-speed telemetry (Web Vitals + SPA route timing), beaconed to the backend so the AI load-time
// optimizer can keep the site under the ~100ms "instant" perception budget. Dependency-free; never blocks render.
try { initPerfVitals() } catch { /* telemetry must never break the app */ }

// Warm the next page's code before the click (hover/visibility), aggressiveness AI-tuned via perfConfig, so
// in-app navigation commits under the ~80ms perception budget. The eager list = the highest-traffic routes.
try { initRoutePrefetch(['myorders', 'rewardsmarketplace', 'surveymarketplace', 'notificationinbox', 'globalleaderboard']) } catch { /* non-fatal */ }

// Prime the "earn while it loads" survey (profiling questions shown during a predicted-slow load, paid in
// capped store credit). Config fetch happens during idle time so it's ready before the first slow load.
try { initLoadingSurvey() } catch { /* non-fatal */ }

// Auto on-device fallback: polls the server load signal and, under stress/outage, serves reads/UI/AI from the
// device + queues non-sensitive writes (sensitive actions stay online-only). No-op unless RESILIENT_MODE_ENABLED.
try { initResilientMode(base44) } catch { /* non-fatal */ }
