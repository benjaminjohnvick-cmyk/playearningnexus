import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Globe2, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ChatPrefsBar — pick the language you READ chat in (messages auto-translate into it) and the countries you'd
 * like to be matched with. Compact bar shown above buddy/group chat. onChange() lets the parent reload.
 */
const LANGS = [
  ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'],
  ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어'], ['hi', 'हिन्दी'], ['ar', 'العربية'], ['ru', 'Русский'],
];
const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'IN', 'PH', 'BR', 'MX', 'DE', 'FR', 'ES', 'JP', 'KR', 'NG', 'ZA'];

export default function ChatPrefsBar({ onChange }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const [countries, setCountries] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleCountry = (c) => setCountries((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const save = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('setChatPrefs', { lang, countries });
      toast.success('Chat preferences saved.');
      setOpen(false);
      if (onChange) onChange();
    } catch { toast.error('Could not save.'); } finally { setSaving(false); }
  };

  return (
    <div className="mb-2">
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <Globe2 className="w-3.5 h-3.5" /> Language & countries
      </button>
      {open && (
        <div className="mt-2 p-3 rounded-lg border bg-white space-y-2">
          <div>
            <div className="text-[11px] text-slate-500 mb-1">Read chat in</div>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm bg-white">
              {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">Match me with (optional)</div>
            <div className="flex flex-wrap gap-1">
              {COUNTRIES.map((c) => (
                <button key={c} onClick={() => toggleCountry(c)}
                  className={`text-[11px] px-1.5 py-0.5 rounded border ${countries.includes(c) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-500'}`}>{c}</button>
              ))}
            </div>
          </div>
          <button onClick={save} disabled={saving} className="text-xs bg-indigo-600 text-white rounded-md px-3 py-1.5 flex items-center gap-1">
            <Check className="w-3 h-3" /> {saving ? 'Saving…' : 'Save'}
          </button>
          <p className="text-[10px] text-slate-400">Messages from others are auto-translated into your language.</p>
        </div>
      )}
    </div>
  );
}
