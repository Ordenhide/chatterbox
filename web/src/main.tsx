import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import {ThemeProvider} from './context/ThemeContext';
import {ToastProvider} from './context/ToastContext';
import {LightboxProvider} from './context/LightboxContext';
import {LanguageProvider} from './i18n';
import {registerServiceWorker} from './pwa';
import {initInstallCapture} from './hooks/useInstallPrompt';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <LightboxProvider>
              <App />
            </LightboxProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();
initInstallCapture();
