import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Sliders, Save, RefreshCw, ShieldAlert, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

// ProfitOptimization (admin) — one place to tune every dial that moves profit (PROFIT-FLYWHEEL blueprint §4),
// grouped and annotated with the §5 guardrails so aggressive tuning never quietly crosses a compliance line.
// Reads/writes through the same settings API as the global panel (adminSettingsCatalog / adminSettingsUpdate),
// so values stay consistent everywhere. Only keys that actually exist in the registry are shown.

// Curated groups. Each lists candidate setting keys (missing ones are skipped) + a guardrail note.
const GROUPS = [
  {
    title: 'Ad volume & yield — the center of gravity (§4.1–4.2)',
    note: 'GUARDRAIL (§5.1): full-screen interstitial frequency must stay within Apple/Google policy — push the gap DOWN only to the most aggressive value that still clears app review, not lower.',
    keys: ['SURVEY_INTERSTITIAL_ENABLED', 'IN_APP_ADS_ENABLED', 'IN_APP_AD_MIN_GAP_MIN', 'SURVEY_INTERSTITIAL_SECONDS', 'IN_APP_AD_SECONDS', 'PREMIUM_ADFREE_CPM_USD', 'HOUSE_CROSSSELL_ENABLED'],
  },
  {
    title: 'Flywheel cross-promotion (§3, §4.6)',
    note: 'Marketing nudges only — never money movement. Every nudge is opt-in and dismissible (§5.2). The scorer picks each user’s best next avenue; weights bias it (refer heaviest = attention center of gravity).',
    keys: ['CROSS_PROMO_ENABLED', 'CROSS_PROMO_SCORER_ENABLED', 'CROSS_PROMO_CONTEXTS', 'CROSS_PROMO_AVENUES', 'CROSS_PROMO_AVENUE_WEIGHTS'],
  },
  {
    title: 'Closed-loop capture — Site Cash velocity (§4.5)',
    note: 'GUARDRAIL (§5.6, §5.8): Site Cash stays closed-loop / non-cashable, and any hold is disclosed in Terms and on the earn-rate page. Too high a hold shrinks the user pool and slows the wheel — model both sides.',
    keys: ['MARKETPLACE_EQUIV_HOLD_ENABLED', 'MARKETPLACE_EQUIV_HOLD_PCT', 'SITE_CASH_AUTO_APPLY', 'SHOPPING_USER_SHARE_PCT', 'SHOPPING_ENABLED', 'STORE_MARKUP'],
  },
  {
    title: 'Virality & lifetime value (§4.4)',
    note: 'GUARDRAIL (§5.3): referrals only ADD to earn-to-unlock progress — never a gate. Spend up to (not beyond) user LTV to acquire. The daily referral goal is a goal, never a penalty.',
    keys: ['EARN_UNLOCK_WEIGHTED', 'EARN_DAILY_REFERRAL_GOAL', 'TARGET_USER_LTV_USD', 'REFERRAL_INTERNAL_VALUE_USD'],
  },
];

export default function ProfitOptimization() {
  const [byKey, setByKey] = useState({});
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr(''); setOkMsg('');
    try {
      const res = await base44.functions.invoke('adminSettingsCatalog', {});
      if (res?.data?.error) { setErr(res.data.error); setLoading(false); return; }
      const map = {};
      for (const s of (res?.data?.settings || [])) map[s.key] = s;
      setByKey(map); setEdits({});
    } catch (e) { setErr(e?.message || 'Failed to load settings'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setEdit = (key, value) => setEdits((e) => ({ ...e, [key]: value }));
  const current = (key) => (edits[key] !== undefined ? edits[key] : byKey[key]?.value);
  const dirtyKeys = useMemo(
    () => Object.keys(edits).filter((k) => String(edits[k]) !== String(byKey[k]?.value)),
    [edits, byKey],
  );

  const save = async () => {
    if (!dirtyKeys.length) return;
    setSaving(true); setErr(''); setOkMsg('');
    try {
      const updates = dirtyKeys.map((k) => ({ key: k, value: edits[k] }));
      const res = await base44.functions.invoke('adminSettingsUpdate', { updates });
      const d = res?.data || {};
      if (d.error) setErr(d.error);
      else if (d.errors?.length) setErr(d.errors.map((e) => `${e.key}: ${e.error}`).join('; '));
      else setOkMsg(`Saved ${d.applied?.length ?? updates.length} change(s).`);
      await load();
    } catch (e) { setErr(e?.message || 'Save failed'); }
    setSaving(false);
  };

  const Field = ({ def }) => {
    if (!def) return null;
    const val = current(def.key);
    return (
      <div className="py-3 border-b border-gray-50 last:border-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">{def.label}</span>
              <code className="text-[10px] text-gray-400">{def.key}</code>
              {def.sensitive && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                  <ShieldAlert className="w-3 h-3" /> sensitive
                </span>
              )}
            </div>
            {def.help && <p className="text-xs text-gray-500 mt-1 leading-snug">{def.help}</p>}
          </div>
          <div className="shrink-0 w-40">
            {def.type === 'boolean' ? (
              <select value={String(val) === '1' ? '1' : '0'} onChange={(e) => setEdit(def.key, e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white">
                <option value="1">On</option>
                <option value="0">Off</option>
              </select>
            ) : def.type === 'number' ? (
              <div className="flex items-center gap-1">
                <input type="number" value={val ?? ''} min={def.min} max={def.max} step="any"
                  onChange={(e) => setEdit(def.key, e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-right" />
                {def.unit && <span className="text-xs text-gray-400 w-8">{def.unit}</span>}
              </div>
            ) : (
              <input type="text" value={val ?? ''} onChange={(e) => setEdit(def.key, e.target.value)}
                placeholder={def.default ? `default: ${def.default}` : ''}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sliders className="w-7 h-7 text-emerald-600" /> Profit Optimization
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Every dial that moves profit, in one place — with the compliance guardrails attached.</p>
          </div>
          <div className="flex gap-2">
            <Link to={createPageUrl('FlywheelDashboard')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <TrendingUp className="w-4 h-4" /> Dashboard
            </Link>
            <button onClick={load} disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Reload
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {err}
          </div>
        )}
        {okMsg && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {okMsg}
          </div>
        )}

        {GROUPS.map((g) => {
          const present = g.keys.map((k) => byKey[k]).filter(Boolean);
          if (!present.length) return null;
          return (
            <div key={g.title} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900">{g.title}</h2>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 leading-snug">{g.note}</p>
              <div className="mt-1">
                {present.map((def) => <Field key={def.key} def={def} />)}
              </div>
            </div>
          );
        })}

        {!loading && Object.keys(byKey).length === 0 && (
          <div className="text-sm text-gray-500">No settings returned. Are you signed in as an admin?</div>
        )}

        <div className="sticky bottom-4 flex items-center justify-end gap-3">
          {dirtyKeys.length > 0 && <span className="text-xs text-gray-500">{dirtyKeys.length} unsaved change(s)</span>}
          <button onClick={save} disabled={saving || dirtyKeys.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
