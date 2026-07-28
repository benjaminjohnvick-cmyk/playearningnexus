import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { initLiveVariants, getUiVariant, onVariantsLoaded, isLoaded } from '@/lib/liveVariants';

// VariantProvider + useVariant — lets any component opt a piece of UI into a live A/B experiment.
//
//   const cta = useVariant('marketplace_cta', 'control');
//   return <Button>{cta === 'variant' ? 'Grab this deal' : 'Buy now'}</Button>;
//
// Assignments are loaded once per session (quiet-swap — no mid-session flicker) and are sticky per
// user. When no experiment targets a name, useVariant returns the fallback, so wrapping UI in a
// variant is always safe even with nothing running. Promotion/rollback happen server-side as a config
// flip, so shipping the two branches here once is all a component ever needs.
const VariantCtx = createContext({ ready: false });

export function VariantProvider({ children }) {
  const [ready, setReady] = useState(isLoaded());
  useEffect(() => {
    const off = onVariantsLoaded(() => setReady(true));
    initLiveVariants().then(() => setReady(true));
    return off;
  }, []);
  return <VariantCtx.Provider value={{ ready }}>{children}</VariantCtx.Provider>;
}

export function useVariant(name, fallback = 'control') {
  const { ready } = useContext(VariantCtx);
  const read = useCallback(() => getUiVariant(name, fallback), [name, fallback]);
  const [v, setV] = useState(read);
  useEffect(() => { setV(read()); }, [ready, read]);
  return v;
}
