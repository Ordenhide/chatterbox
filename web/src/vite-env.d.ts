/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  // App Check
  readonly VITE_RECAPTCHA_V3_SITE_KEY?: string;
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  // TURN (calls)
  readonly VITE_TURN_URL?: string;
  readonly VITE_TURN_USERNAME?: string;
  readonly VITE_TURN_CREDENTIAL?: string;
  // Web push
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  // GIPHY GIF search
  readonly VITE_GIPHY_API_KEY?: string;
  // Native app download links (Profile → Get the app). macOS installs as a PWA.
  readonly VITE_DOWNLOAD_IOS?: string;
  readonly VITE_DOWNLOAD_ANDROID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
