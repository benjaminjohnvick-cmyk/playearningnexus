import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, Loader2, Shield, AlertTriangle, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';

// AdminSettings — one panel for every adjustable price, rate, threshold, and toggle.
// Values resolve DB override → env → built-in default; saving writes a DB override (audited).
export default function AdminSettings() {
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});   // key -> new value
  const [savingCat, setSavingCat] = useState(null);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('adminSettingsCatalog', {});
      setRows(res.data.settings || []);
      setCats(res.data.categories || []);
    } catch (e) {
      toast.error(e?.data?.error || e.message || 'Failed to load settings');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const setVal = (key, value) => setDirty((d) => ({ ...d, [key]: value }));
  const effective = (r) => (dirty[r.key] !== undefined ? dirty[r.key] : r.value);
  const isDirty = (r) => dirty[r.key] !== undefined && String(dirty[r.key]) !== String(r.value);

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const map = {};
    for (const r of rows) {
      if (needle && !(`${r.label} ${r.key} ${r.category}`.toLowerCase().includes(needle))) continue;
      (map[r.category] ||= []).push(r);
    }
    return map;
  }, [rows, q]);

  async function saveCategory(cat) {
    const updates = (grouped[cat] || []).filter(isDirty).map((r) => ({ key: r.key, value: dirty[r.key] }));
    if (!updates.length) { toast('Nothing changed in this section.'); return; }
    const risky = (grouped[cat] || []).filter((r) => isDirty(r) && r.sensitive);
    if (risky.length && !window.confirm(
      `You're changing ${risky.length} sensitive setting(s):\n\n` +
      risky.map((r) => `• ${r.label}`).join('\n') +
      `\n\nThese affect money or legal exposure. Continue?`)) return;
    setSavingCat(cat);
    try {
      const res = await base44.functions.invoke('adminSettingsUpdate', { updates });
      const applied = res.data.applied || [];
      const errors = res.data.errors || [];
      if (applied.length) toast.success(`Saved ${applied.length} setting(s) in ${cat}.`);
      if (errors.length) toast.error(errors.map((e) => `${e.key}: ${e.error}`).join('; '));
      // clear dirty for this category and refresh effective values
      setDirty((d) => { const n = { ...d }; updates.forEach((u) => delete n[u.key]); return n; });
      await load();
    } catch (e) {
      toast.error(e?.data?.error || e.message || 'Save failed');
    } finally { setSavingCat(null); }
  }

  const sourceBadge = (r) => {
    const map = { db: ['Custom', 'bg-emerald-600'], env: ['From .env', 'bg-blue-600'], default: ['Default', 'bg-zinc-500'] };
    const [label, cls] = map[r.source] || map.default;
    return <Badge className={`${cls} text-white`}>{label}</Badge>;
  };

  function Field({ r }) {
    const val = effective(r);
    return (
      <div className={`flex flex-col gap-1 p-3 rounded-lg border ${isDirty(r) ? 'border-amber-400 bg-amber-50/40' : 'border-zinc-200'}`}>
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium flex items-center gap-1">
            {r.sensitive && <Shield className="w-3.5 h-3.5 text-amber-600" title="Sensitive (money/legal)" />}
            {r.label}
          </label>
          {sourceBadge(r)}
        </div>
        <div className="flex items-center gap-2">
          {r.type === 'boolean' ? (
            <Switch checked={val === '1' || val === true || val === 'true'} onCheckedChange={(c) => setVal(r.key, c ? '1' : '0')} />
          ) : r.type === 'select' ? (
            <select className="border rounded px-2 py-1 text-sm w-full" value={val} onChange={(e) => setVal(r.key, e.target.value)}>
              {(r.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <Input type={r.type === 'number' ? 'number' : 'text'} value={val}
              onChange={(e) => setVal(r.key, e.target.value)} className="w-full" step="any" />
          )}
          {r.unit && <span className="text-xs text-zinc-500 whitespace-nowrap">{r.unit}</span>}
          {isDirty(r) && (
            <button title="Revert" onClick={() => setDirty((d) => { const n = { ...d }; delete n[r.key]; return n; })}>
              <RotateCcw className="w-4 h-4 text-zinc-400 hover:text-zinc-700" />
            </button>
          )}
        </div>
        <div className="text-[11px] text-zinc-500 font-mono">{r.key}</div>
        {r.help && <div className="text-xs text-zinc-500">{r.help}</div>}
      </div>
    );
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading settings…</div>;

  const dirtyCount = Object.keys(dirty).filter((k) => { const r = rows.find((x) => x.key === k); return r && String(dirty[k]) !== String(r.value); }).length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1"><Settings className="w-6 h-6" /><h1 className="text-2xl font-bold">Platform Settings</h1></div>
      <p className="text-sm text-zinc-500 mb-4">
        Prices, rates, thresholds, and toggles — adjustable without a deploy. Values resolve
        <b> your override → .env → built-in default</b>. Every change is audit-logged.
        Compliance on/off kill-switches live in the Compliance Flags panel.
      </p>
      <div className="flex items-center gap-3 mb-6 sticky top-0 bg-white/80 backdrop-blur py-2 z-10">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-zinc-400" />
          <Input placeholder="Search settings…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        {dirtyCount > 0 && <Badge className="bg-amber-500 text-white">{dirtyCount} unsaved</Badge>}
      </div>

      {cats.filter((c) => grouped[c]?.length).map((cat) => {
        const catDirty = (grouped[cat] || []).some(isDirty);
        return (
          <Card key={cat} className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{cat}</CardTitle>
              <Button size="sm" disabled={!catDirty || savingCat === cat} onClick={() => saveCategory(cat)}>
                {savingCat === cat ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save section
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grouped[cat].map((r) => <Field key={r.key} r={r} />)}
            </CardContent>
          </Card>
        );
      })}

      <div className="text-xs text-zinc-400 flex items-center gap-1 mt-8">
        <AlertTriangle className="w-3.5 h-3.5" />
        Sensitive settings (money / legal, marked with a shield) prompt a confirm and are flagged in the audit log.
      </div>
    </div>
  );
}
