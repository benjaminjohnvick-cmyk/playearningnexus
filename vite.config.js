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
    rollupOptions: {
      // Native-only Capacitor plugins that aren't installed for the web build. They're loaded via
      // guarded dynamic import(...).catch(() => null) and only ever run on the native app shell, so
      // marking them external lets the web bundle build without them present. On web these imports
      // never execute (they're behind Capacitor.isNativePlatform()); on native the shell provides them.
      external: [
        '@capgo/capacitor-updater',
        '@capacitor/network',
      ],
    },
  },
});
