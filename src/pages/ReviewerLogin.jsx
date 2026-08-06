import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Reviewer / demo one-tap login. An App Store or Play reviewer (or a tester) opens /ReviewerLogin
// and lands straight in a populated app — no signup. Backed by the gated `demoLogin` function
// (only works when the backend has REVIEWER_DEMO=1). Give this URL to reviewers in the store notes.
export default function ReviewerLogin() {
  const [status, setStatus] = useState('Signing you in to the demo…');
  useEffect(() => {
    (async () => {
      try {
        const r = await base44.functions.invoke('demoLogin', {});
        const token = r?.data?.token ?? r?.token;
        if (!token) throw new Error(r?.data?.error || r?.error || 'Demo login unavailable');
        if (typeof localStorage !== 'undefined') localStorage.setItem('nexus_token', token);
        setStatus('Success — loading the app…');
        window.location.assign('/');
      } catch (e) {
        setStatus(`Demo login is not available: ${e.message}`);
      }
    })();
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 mx-auto mb-4 flex items-center justify-center text-2xl font-black">G</div>
        <h1 className="text-xl font-bold mb-2">Grandia Granaria — Reviewer Demo</h1>
        <p className="text-gray-300 text-sm">{status}</p>
      </div>
    </div>
  );
}
