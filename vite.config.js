import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  resolve: {
    alias: {
      // Map "@/..." imports to the src/ folder (the whole app uses this alias).
      // jsconfig.json only tells the editor; Vite needs it here to build.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    // PWA / service worker — caches the app SHELL (static assets) so the app loads and runs offline / when the
    // server is stressed, powering the resilient on-device fallback (src/lib/resilient-mode.js handles the data
    // side). Deliberately does NOT cache the /functions/ API (those are POSTs and often sensitive) — data
    // caching + the sensitive-action guard live in resilient-mode.js, not the service worker.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Get Goods Gratis (Free)',
        short_name: 'GetGoods',
        description: 'Play, earn, and get goods — free.',
        theme_color: '#0a142e',
        background_color: '#0a142e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'gg-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'gg-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/functions\//, /^\/api\//],   // never intercept API calls
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // The heavy libraries below get their own named, independently-cacheable chunk. Everything else is
    // left to Vite's default per-route splitting (return undefined) — deliberately NOT forced into one
    // catch-all "vendor" file, which would produce a single multi-MB monolith.
    //
    // The main "index" chunk is ~2.3 MB (≈600 kB gzipped over the wire) — that's the app's shared core,
    // eagerly loaded via the Layout shell that renders on every route. It downloads once and then caches.
    // Shrinking it further would mean lazy-loading large parts of that shared tree (a real refactor, not a
    // config change), so this ceiling is set above it: the warning is advisory only and never blocks a build.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      // Native-only Capacitor plugins that aren't installed for the web build. They're loaded via
      // guarded dynamic import(...).catch(() => null) and only ever run on the native app shell, so
      // marking them external lets the web bundle build without them present. On web these imports
      // never execute (they're behind Capacitor.isNativePlatform()); on native the shell provides them.
      external: [
        '@capgo/capacitor-updater',
        '@capacitor/network',
      ],
      output: {
        // Give ONLY the biggest libraries their own named chunk. Anything not matched returns undefined,
        // so Vite splits the rest with its smart default (shared code across routes gets its own small
        // chunks) instead of one giant "vendor" file.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory-')) return 'vendor-charts';
          if (id.includes('/leaflet') || id.includes('/react-leaflet')) return 'vendor-maps';
          if (id.includes('/react-quill') || id.includes('/quill')) return 'vendor-editor';
          if (id.includes('/jspdf') || id.includes('/html2canvas')) return 'vendor-pdf';
          if (id.includes('/framer-motion')) return 'vendor-motion';
          if (id.includes('/@radix-ui/')) return 'vendor-radix';
          // moment is monolithic (~290 kB, not tree-shakeable) — give it its own cached chunk so it isn't
          // dead weight inside the main index bundle. (date-fns is intentionally left to Vite's tree-shaking.)
          if (id.includes('/moment/')) return 'vendor-time';
          return undefined;
        },
      },
    },
  },
});
