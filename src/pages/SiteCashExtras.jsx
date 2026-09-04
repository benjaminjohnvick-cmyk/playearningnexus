import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Gift, Zap, Wallet, RefreshCw, AlertCircle, Check, Clock } from 'lucide-react';

// SiteCashExtras — the closed-loop Site-Cash extras: GIFT Site Cash to a friend (small closed-loop spread) and
// buy a time-limited EARN BOOST. Both spend non-cashable Site Cash and stay 100% on-platform (no cash value,
// no cash-out). Reads siteCashPerksStatus; acts via giftSiteCash / purchaseEarnBoost.

const usd = (v) => `$${(Number(v) || 0).toFixed(2)}`;

export default function SiteCashExtras() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);

  const [toEmail, setToEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await base44.functions.invoke('siteCashPerksStatus', {});
      if (res?.data?.error) setErr(res.data.error);
      else setS(res.data);
    } catch (e) { setErr(e?.message || 'Failed to load'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const g = s?.gifting || {};
  const b = s?.earn_boost || {};
  const feePct = Number(g.fee_pct) || 0;
  const gross = Math.max(0, Number(amount) || 0);
  const fee = Math.round(gross * feePct * 100) / 100;
  const net = Math.round((gross - fee) * 100) / 100;

  const sendGift = async () => {
    setBusy('gift'); setErr(''); setMsg('');
    try {
      const res = await base44.functions.invoke('giftSiteCash', { to_email: toEmail.trim(), amount_usd: gross, note: note.trim() });
      if (res?.data?.error) setErr(res.data.error);
      else { setMsg(`Sent ${usd(res.data?.sent?.net_usd)} to ${toEmail}.`); setToEmail(''); setAmount(''); setNote(''); await load(); }
    } catch (e) { setErr(e?.message || 'Gift failed'); }
    setBusy('');
  };

  const buyBoost = async () => {
    setBusy('boost'); setErr(''); setMsg('');
    try {
      const res = await base44.functions.invoke('purchaseEarnBoost', {});
      if (res?.data?.error) setErr(res.data.error);
      else { setMsg(`Boost active! ${b.multiplier}× earnings for ${b.hours}h.`); await load(); }
    } catch (e) { setErr(e?.message || 'Purchase failed'); }
    setBusy('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Site-Cash Extras</h1>
            <p className="text-xs text-gray-500">Gift Site Cash to a friend, or boost your earnings. On-platform only — no cash value.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-2 shadow-sm flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-gray-900">{usd(s?.balance_usd)}</span>
              <span className="text-xs text-gray-400">Site Cash</span>
            </div>
            <button onClick={load} className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm hover:bg-gray-50" title="Refresh">
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {err && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {err}</div>}
        {msg && <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2"><Check className="w-4 h-4" /> {msg}</div>}

        {/* GIFTING */}
        {g.enabled !== false && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 items-center justify-center text-white"><Gift className="w-4 h-4" /></span>
              <h2 className="text-sm font-bold text-gray-800">Gift Site Cash</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="Friend's email" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={g.min_usd || 1} max={g.max_usd || 100} placeholder={`Amount ($${g.min_usd ?? 1}–$${g.max_usd ?? 100})`} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            {gross > 0 && (
              <div className="mt-3 text-xs text-gray-500">
                They receive <span className="font-bold text-gray-800">{usd(net)}</span>
                {fee > 0 && <> · a {(feePct * 100).toFixed(0)}% platform fee of {usd(fee)} keeps gifting running</>} · you pay {usd(gross)}.
              </div>
            )}
            <button disabled={busy === 'gift' || !toEmail || gross <= 0} onClick={sendGift} className="mt-4 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white text-sm font-semibold px-5 py-2 disabled:opacity-60">
              {busy === 'gift' ? 'Sending…' : 'Send Gift'}
            </button>
          </div>
        )}

        {/* EARN BOOST */}
        {b.enabled !== false && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 items-center justify-center text-white"><Zap className="w-4 h-4" /></span>
              <h2 className="text-sm font-bold text-gray-800">Earn Boost</h2>
            </div>
            {b.active ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                <Clock className="w-4 h-4" /> {b.active_multiplier}× boost active{b.active_until ? ` until ${new Date(b.active_until).toLocaleString()}` : ''}.
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Get <span className="font-bold">{b.multiplier}×</span> Site-Cash earnings for <span className="font-bold">{b.hours} hours</span> for <span className="font-bold">{usd(b.price_usd)}</span>.
                  It multiplies only your non-cashable Site-Cash earnings — a fixed boost for a fixed window (not a random draw).
                </p>
                <button disabled={busy === 'boost'} onClick={buyBoost} className="mt-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white text-sm font-semibold px-5 py-2 disabled:opacity-60">
                  {busy === 'boost' ? 'Activating…' : `Buy Boost · ${usd(b.price_usd)}`}
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          Site Cash is non-cashable, closed-loop store credit. Gifts move store credit between accounts (never money),
          and boosts only scale non-cashable earnings. Nothing here has cash value or can be redeemed for money.
        </p>
      </div>
    </div>
  );
}
