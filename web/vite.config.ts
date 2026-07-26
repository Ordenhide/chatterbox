import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {port: 5173},
  build: {
    // Split the big Firebase SDK (and React) into cacheable vendor chunks so the
    // main app chunk stays small and the SDK is cached across deploys.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/firebase/') || id.includes('/@firebase/')) {
            if (id.includes('firestore')) return 'firebase-firestore';
            if (id.includes('auth')) return 'firebase-auth';
            if (id.includes('storage')) return 'firebase-storage';
            if (id.includes('messaging')) return 'firebase-messaging';
            if (id.includes('app-check')) return 'firebase-appcheck';
            if (id.includes('remote-config')) return 'firebase-remote-config';
            return 'firebase-core';
          }
          if (id.includes('/react') || id.includes('/react-dom') || id.includes('/scheduler')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
