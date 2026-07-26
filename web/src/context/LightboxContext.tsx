import {createContext, useCallback, useContext, useEffect, useState} from 'react';
import Icon from '../components/Icon';

interface LightboxCtx {
  open: (url: string) => void;
}

const Ctx = createContext<LightboxCtx>({open: () => {}});

export function LightboxProvider({children}: {children: React.ReactNode}) {
  const [url, setUrl] = useState<string | null>(null);
  const open = useCallback((u: string) => setUrl(u), []);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setUrl(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [url]);

  return (
    <Ctx.Provider value={{open}}>
      {children}
      {url && (
        <div className="lightbox" onClick={() => setUrl(null)}>
          <button className="lightbox-close" onClick={() => setUrl(null)} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
          <img src={url} alt="" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useLightbox = () => useContext(Ctx);
