import React, { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// Renders Google Identity Services "Sign in with Google". Requires VITE_GOOGLE_CLIENT_ID.
// On credential, exchanges the Google ID token for our JWT via base44.auth.googleLogin,
// then calls onSuccess (usually navigate to the redirect target).
export default function GoogleSignInButton({ onSuccess, onError }) {
  const ref = useRef(null);
  const clientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return; // silently hidden when not configured
    const SCRIPT = 'https://accounts.google.com/gsi/client';

    const handleCredential = async (response) => {
      try {
        await base44.auth.googleLogin(response.credential);
        onSuccess?.();
      } catch (e) {
        onError?.(e?.data?.error || e?.message || 'Google sign-in failed');
      }
    };

    const init = () => {
      if (!window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
    };

    if (window.google?.accounts?.id) { init(); return; }
    let script = document.querySelector(`script[src="${SCRIPT}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT; script.async = true; script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', init);
    return () => script?.removeEventListener('load', init);
  }, [clientId]);

  if (!clientId) return null;
  return <div className="flex justify-center"><div ref={ref} /></div>;
}
