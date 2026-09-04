import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Check, Lock, RefreshCw, Wallet, AlertCircle } from 'lucide-react';

// CosmeticsStore — the closed-loop virtual-goods store. Users spend non-cashable Site Cash (store credit) on
// cosmetic frames/themes/flair/nameplates/effects. No real-money purchase, no cash value, non-tradeable — a
// pure on-platform Site-Cash sink. Reads cosmeticsCatalog; buys via purchaseCosmetic; equips via equipCosmetic.

const TYPE_LABEL = {
  avatar_frame: 'Avatar Frames', profile_theme: 'Profile Themes', badge_flair: 'Badge Flair',
  nameplate: 'Nameplates', profile_effect: 'Profile Effects',
};
const RARITY_RING = {
  common: 'border-gray-200', rare: 'border-blue-300', epic: 'border-violet-300', legendary: 'border-amber-300',
};
const RARITY_BADGE = {
  common: 'bg-gray-100 text-gray-600', rare: 'bg-blue-100 text-blue-700',
  epic: 'bg-violet-100 text-violet-700', legendary: 'bg-amber-100 text-amber-800',
};
const usd = (v) => `$${(Number(v) || 0).toFixed(2)}`;

export default function CosmeticsStore() {
  const [state, setState] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await base44.functions.invoke('cosmeticsCatalog', {});
      if (res?.data?.error) setErr(res.data.error);
      else setState(res.data);
    } catch (e) { setErr(e?.message || 'Failed to load the store'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const buy = async (item) => {
    setBusy(item.key); setErr(''); setMsg('');
    try {
      const res = await base44.functions.invoke('purchaseCosmetic', { cosmetic_key: item.key });
      if (res?.data?.error) setErr(res.data.error);
      else { setMsg(`Unlocked ${item.name}!`); await load(); }
    } catch (e) { setErr(e?.message || 'Purchase failed'); }
    setBusy('');
  };

  const equip = async (item, equip) => {
    setBusy(item.key); setErr(''); setMsg('');
    try {
      const res = await base44.functions.invoke('equipCosmetic', { cosmetic_key: item.key, equip });
      if (res?.data?.error) setErr(res.data.error);
      else { setMsg(equip ? `Equipped ${item.name}` : `Unequipped ${item.name}`); await load(); }
    } catch (e) { setErr(e?.message || 'Failed to update'); }
    setBusy('');
  };

  if (!loading && state && state.enabled === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 p-6">
        <div className="max-w-md mx-auto mt-20 rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <Lock className="w-8 h-8 mx-auto text-gray-400" />
          <h1 className="mt-3 text-xl font-bold text-gray-900">Cosmetics store is closed</h1>
          <p className="mt-2 text-sm text-gray-500">This feature isn't available right now. Check back soon.</p>
        </div>
      </div>
    );
  }

  const items = state?.items || [];
  const owned = new Set(state?.owned || []);
  const equipped = state?.equipped || {};
  const byType = {};
  for (const it of items) (byType[it.type] = byType[it.type] || []).push(it);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Cosmetics Store</h1>
              <p className="text-xs text-gray-500">Spend your Site Cash on frames, themes, flair & effects. On-platform only — no cash value.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-2 shadow-sm flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-gray-900">{usd(state?.balance_usd)}</span>
              <span className="text-xs text-gray-400">Site Cash</span>
            </div>
            <button onClick={load} className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm hover:bg-gray-50" title="Refresh">
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {err}
          </div>
        )}
        {msg && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
            <Check className="w-4 h-4" /> {msg}
          </div>
        )}

        {loading && !state && <div className="text-sm text-gray-400">Loading the store…</div>}

        {Object.keys(byType).map((type) => (
          <div key={type}>
            <h2 className="text-sm font-bold text-gray-700 mb-3">{TYPE_LABEL[type] || type}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {byType[type].map((it) => {
                const isOwned = owned.has(it.key);
                const isEquipped = equipped[it.type] === it.key;
                const isBusy = busy === it.key;
                return (
                  <div key={it.key} className={`rounded-2xl border-2 ${RARITY_RING[it.rarity] || 'border-gray-200'} bg-white p-4 shadow-sm flex flex-col`}>
                    <div className="flex items-start justify-between">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${RARITY_BADGE[it.rarity] || 'bg-gray-100 text-gray-600'}`}>{it.rarity}</span>
                      {isOwned && <Check className="w-4 h-4 text-emerald-500" />}
                    </div>
                    <div className="mt-3 flex-1">
                      <div className="text-sm font-bold text-gray-900">{it.name}</div>
                      {it.description && <div className="text-xs text-gray-400 mt-1">{it.description}</div>}
                    </div>
                    <div className="mt-4">
                      {!isOwned ? (
                        <button
                          disabled={isBusy}
                          onClick={() => buy(it)}
                          className="w-full rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-white text-sm font-semibold py-2 disabled:opacity-60"
                        >
                          {isBusy ? '…' : `Buy · ${usd(it.price_usd)}`}
                        </button>
                      ) : isEquipped ? (
                        <button
                          disabled={isBusy}
                          onClick={() => equip(it, false)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-sm font-semibold py-2 disabled:opacity-60"
                        >
                          {isBusy ? '…' : 'Equipped ✓ — Unequip'}
                        </button>
                      ) : (
                        <button
                          disabled={isBusy}
                          onClick={() => equip(it, true)}
                          className="w-full rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-sm font-semibold py-2 disabled:opacity-60"
                        >
                          {isBusy ? '…' : 'Equip'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <p className="text-[11px] text-gray-400 pt-2">
          Cosmetics are on-platform virtual goods. They have no cash value, can't be sold or transferred, and can't be redeemed for money.
          Purchases are made with your closed-loop Site Cash and are final.
        </p>
      </div>
    </div>
  );
}
