import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Chrome, Sparkles } from 'lucide-react';

// ExtensionInstallPrompt — shown right after signup. A PRE-CHECKED (default-on, opt-out) option to add the
// browser extension. Chrome does NOT allow a website to auto-install an extension (inline install was removed
// in 2018), so the compliant maximum is: pre-select the intent, and on Continue open the Chrome Web Store
// listing in a new tab (one click from "Add to Chrome") + record the opt-in so you can nudge later. If the
// extension isn't enabled or no store URL is set, it no-ops and continues.
export default function ExtensionInstallPrompt({ redirectTo = '/' }) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(true); // default-on (opt-out)
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const go = () => { if (String(redirectTo).startsWith('http')) window.location.href = redirectTo; else navigate(redirectTo, { replace: true }); };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('extensionConfig', {});
        const d = res?.data;
        // Only show if the extension is live AND a Web Store URL is configured; otherwise skip straight through.
        if (!alive) return;
        if (d?.enabled && d?.webstore_url) setCfg(d);
        else go();
      } catch { go(); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke('extensionEnroll', { install_intent: checked });
      if (checked && cfg?.webstore_url) window.open(cfg.webstore_url, '_blank', 'noopener');
    } catch { /* non-fatal */ }
    go();
  };

  if (loading || !cfg) return null;

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 via-white to-violet-50 p-4">
      <div className="max-w-md w-full rounded-2xl border border-gray-100 bg-white p-6 shadow-sm text-center">
        <span className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 items-center justify-center text-white mx-auto">
          <Sparkles className="w-6 h-6" />
        </span>
        <h1 className="mt-4 text-xl font-black text-gray-900">Earn more with the browser add-on</h1>
        <p className="mt-2 text-sm text-gray-500">
          Get Site Cash on your new-tab page and cashback when you shop. On-platform rewards, non-cashable — and
          you can turn it off anytime.
        </p>

        <label className="mt-5 flex items-start gap-3 text-left rounded-xl border border-gray-200 p-3 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
          <span className="text-sm text-gray-700">
            <span className="font-semibold">Add the browser extension</span> — we'll open the Chrome Web Store so you
            can add it in one click. (Recommended)
          </span>
        </label>

        <button onClick={finish} disabled={busy} className="mt-4 w-full rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-white text-sm font-semibold py-2.5 disabled:opacity-60 inline-flex items-center justify-center gap-2">
          <Chrome className="w-4 h-4" /> {busy ? 'One moment…' : checked ? 'Add it & continue' : 'Continue'}
        </button>
        <button onClick={() => { setChecked(false); setTimeout(finish, 0); }} disabled={busy} className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600">
          Skip for now
        </button>
        <p className="mt-3 text-[11px] text-gray-400">
          Chrome requires you to click "Add to Chrome" yourself — no site can install an extension automatically.
        </p>
      </div>
    </div>
  );
}
