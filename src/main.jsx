import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initNative } from '@/lib/native'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Initialize native wrapper behaviors (no-ops on web/PWA).
initNative()
