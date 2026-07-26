import {createContext, useCallback, useContext, useRef, useState} from 'react';
import {colors} from '../theme';

type ToastKind = 'info' | 'success' | 'error';
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastCtx {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const Ctx = createContext<ToastCtx>({show: () => {}, success: () => {}, error: () => {}});

const DOT: Record<ToastKind, string> = {
  info: colors.primary,
  success: colors.success,
  error: colors.danger,
};

export function ToastProvider({children}: {children: React.ReactNode}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, {id, message, kind}]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4200);
  }, []);

  const value: ToastCtx = {
    show,
    success: m => show(m, 'success'),
    error: m => show(m, 'error'),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind}`} role="status">
            <span className="toast-dot" style={{background: DOT[t.kind]}} />
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
