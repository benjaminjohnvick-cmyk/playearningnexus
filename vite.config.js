import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
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
  ],
  build: {
    // The heavy libraries below load first-time, so give each its own cacheable chunk. This lets a
    // returning user re-download only the app code that actually changed — the big vendors stay cached in
    // their browser between deploys. The size warning below is purely advisory (it doesn't affect whether
    // the build works or the site runs); the heaviest pages are already lazy-loaded into their own chunks
    // that load only when opened, so the limit is set past the main bundle to silence the cosmetic notice.
    chunkSizeWarningLimit: 2000,
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
        // Split the biggest dependencies into their own named chunks so no single file is huge and each
        // can be cached independently. Everything not listed stays in the default vendor/app chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/') || id.includes('/three-')) return 'vendor-three';
          if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory-')) return 'vendor-charts';
          if (id.includes('/leaflet') || id.includes('/react-leaflet')) return 'vendor-maps';
          if (id.includes('/react-quill') || id.includes('/quill')) return 'vendor-editor';
          if (id.includes('/jspdf') || id.includes('/html2canvas')) return 'vendor-pdf';
          if (id.includes('/framer-motion')) return 'vendor-motion';
          if (id.includes('/@radix-ui/')) return 'vendor-radix';
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/react-router')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
});
