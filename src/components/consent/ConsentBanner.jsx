import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getConsent, setConsent, hasDecided, acceptAll, rejectNonEssential } from '@/lib/consent';

// ConsentBanner — global cookie/tracking consent, built to the STRICTEST standard so it satisfies as many
// regimes as possible at once (EU GDPR + ePrivacy, UK GDPR, Brazil LGPD, etc. = prior opt-in for non-essential,
// with "Reject" as easy and prominent as "Accept", granular categories, no pre-ticked boxes; plus US
// CCPA/CPRA = a real "Do Not Sell or Share" + "Limit Use of Sensitive PI" opt-out). Applied to ALL visitors
// (strictest-for-everyone), so it holds up regardless of where the user is. Choice is recorded to the consent
// ledger (best-effort) for auditability.
//
// Shows on first visit until a choice is made; re-openable any time via the footer link (window 'gg-open-consent').

function recordServerSide(consent, action) {
  try {
    base44.functions.invoke('recordCookieConsent', {
      analytics: consent.analytics === true,
      sale_share_optout: consent.sale_share_optout === true,
      sensitive_limit: consent.sensitive_limit === true,
      action,
    }).catch(() => {});
  } catch { /* best-effort */ }
}

export default function ConsentBanner() {
  const [show, setShow] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState(getConsent());

  useEffect(() => {
    if (!hasDecided()) setShow(true);
    const openPrefs = () => { setDraft(getConsent()); setPrefsOpen(true); setShow(true); };
    window.addEventListener('gg-open-consent', openPrefs);
    return () => window.removeEventListener('gg-open-consent', openPrefs);
  }, []);

  const finish = (consent, action) => { recordServerSide(consent, action); setShow(false); setPrefsOpen(false); };
  const onAcceptAll = () => finish(acceptAll(), 'accept_all');
  const onRejectAll = () => finish(rejectNonEssential(), 'reject_non_essential');
  const onSavePrefs = () => finish(setConsent(draft), 'save_preferences');

  if (!show) return null;

  const Toggle = ({ checked, onChange, disabled, label, desc }) => (
    <label className={`flex items-start gap-3 py-2 ${disabled ? 'opacity-70' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-600" />
      <span className="min-w-0">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500 leading-snug">{desc}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4" role="dialog" aria-modal="false" aria-label="Privacy choices">
      <div className="max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {!prefsOpen ? (
          <div className="p-4 sm:p-5">
            <h2 className="text-sm font-bold text-gray-900">Your privacy choices</h2>
            <p className="text-xs text-gray-600 mt-1 leading-snug">
              We use essential cookies to run the site. With your permission we also use analytics to improve it.
              You can accept, reject non-essential cookies, or set your preferences. Essential cookies always stay on.
              See our <Link to={createPageUrl('PrivacyPolicy')} className="text-blue-600 underline">Privacy Policy</Link>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Reject is as prominent as Accept (GDPR/ePrivacy: no dark patterns). */}
              <button onClick={onRejectAll} className="flex-1 min-w-[130px] rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50">Reject non-essential</button>
              <button onClick={onAcceptAll} className="flex-1 min-w-[130px] rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Accept all</button>
              <button onClick={() => { setDraft(getConsent()); setPrefsOpen(true); }} className="flex-1 min-w-[130px] rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Preferences</button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <h2 className="text-sm font-bold text-gray-900">Privacy preferences</h2>
            <div className="mt-2 divide-y divide-gray-100">
              <Toggle checked disabled label="Essential (always on)" desc="Security, fraud prevention, load balancing, and remembering your privacy choice. Required to run the site." />
              <Toggle checked={draft.analytics === true} onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
                label="Analytics & product improvement" desc="Behavioral/usage analytics, session insights, and experiments. Off unless you turn it on (GDPR opt-in)." />
              <Toggle checked={draft.sale_share_optout === true} onChange={(v) => setDraft((d) => ({ ...d, sale_share_optout: v }))}
                label="Do Not Sell or Share My Personal Information" desc="Opt out of any 'sale' or cross-context 'sharing' of your personal information (CCPA/CPRA). Turning this on also stops behavioral tracking." />
              <Toggle checked={draft.sensitive_limit === true} onChange={(v) => setDraft((d) => ({ ...d, sensitive_limit: v }))}
                label="Limit Use of My Sensitive Personal Information" desc="Restrict use of sensitive personal information to what's necessary to provide the service (CCPA/CPRA)." />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={onRejectAll} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Reject non-essential</button>
              <button onClick={onSavePrefs} className="flex-1 min-w-[130px] rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Save my choices</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
