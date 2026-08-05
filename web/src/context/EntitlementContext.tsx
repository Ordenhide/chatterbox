import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {isProActive, listenEntitlement, type Entitlement} from '../services/entitlement';

interface EntitlementCtx {
  entitlement: Entitlement | null;
  isPro: boolean;
  /** True until the first snapshot lands — so the UI can avoid flashing a
   * paywall at someone who has actually paid. */
  loading: boolean;
}

const Ctx = createContext<EntitlementCtx>({entitlement: null, isPro: false, loading: true});

export function EntitlementProvider({uid, children}: {uid: string; children: React.ReactNode}) {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setEntitlement(null); // reset first — this provider is reused across accounts
    return listenEntitlement(uid, next => {
      setEntitlement(next);
      setLoading(false);
    });
  }, [uid]);

  // Recomputed per render rather than stored: an entitlement expires by the
  // passage of time, not by an event, so a cached boolean would keep saying
  // "Pro" after currentPeriodEnd until something unrelated re-rendered.
  const value = useMemo<EntitlementCtx>(
    () => ({entitlement, isPro: isProActive(entitlement), loading}),
    [entitlement, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useEntitlement = () => useContext(Ctx);
