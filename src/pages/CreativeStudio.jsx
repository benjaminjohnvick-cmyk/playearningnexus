import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import BrandedAd from '@/components/branding/BrandedAd';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Sparkles, Wand2, FlaskConical, Brain, ShieldCheck, ShieldAlert,
  ImageIcon, CheckCircle2, RefreshCw, TrendingUp, Lightbulb, Gauge,
} from 'lucide-react';

// CreativeStudio — the advertiser-facing front end for the AI Creative Suite. Brief box → scored variant
// gallery → one-click A/B (or multivariate) → live self-learning playbook + recommendations. Calls
// aiCreativeSuiteStatus / …Generate / …Experiment / …Learn.
const TIER_LABELS = { tier1: 'Tier 1 — Founding', tier2: 'Tier 2 — Scale', tier3: 'Tier 3 — Unlimited' };
const GOLD = '#e8c766', NAVY = '#16264f';

const scoreColor = (s) => (s >= 75 ? 'bg-emerald-500' : s >= 55 ? 'bg-amber-500' : 'bg-rose-500');

export default function CreativeStudio() {
  const [tier, setTier] = useState('tier1');
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [brief, setBrief] = useState('');
  const [audience, setAudience] = useState('adults 18+, gaming & rewards');
  const [count, setCount] = useState(3);
  const [genImages, setGenImages] = useState(true);
  const [selectedFormats, setSelectedFormats] = useState(['social_post', 'interstitial', 'square_1080']);

  const [creatives, setCreatives] = useState([]);
  const [picked, setPicked] = useState([]);   // asset ids selected for a test
  const [generating, setGenerating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [learning, setLearning] = useState(false);
  const [msg, setMsg] = useState(null);

  const caps = status?.capabilities;
  const formats = caps?.formats_detail || [];
  const multivariate = !!caps?.multivariate;

  async function loadStatus(t = tier) {
    setLoadingStatus(true);
    try {
      const res = await base44.functions.invoke('aiCreativeSuiteStatus', { tier: t });
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else setStatus(res);
    } catch (e) { setMsg({ type: 'error', text: String(e?.message || e) }); }
    setLoadingStatus(false);
  }
  useEffect(() => { loadStatus(tier); }, [tier]);

  const toggleFormat = (k) =>
    setSelectedFormats((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const maxVariants = caps?.max_variants_per_brief || 5;

  async function generate() {
    if (!brief.trim()) { setMsg({ type: 'error', text: 'Write a creative brief first.' }); return; }
    if (!selectedFormats.length) { setMsg({ type: 'error', text: 'Pick at least one format.' }); return; }
    setGenerating(true); setMsg(null); setPicked([]);
    try {
      const res = await base44.functions.invoke('aiCreativeSuiteGenerate', {
        tier, brief, audience, count: Number(count) || 3,
        formats: selectedFormats, generate_images: genImages,
      });
      if (res?.error) { setMsg({ type: 'error', text: res.error }); }
      else {
        setCreatives(res.creatives || []);
        setMsg({
          type: 'ok',
          text: `Generated ${res.generated} creative${res.generated === 1 ? '' : 's'} across ${res.formats?.length || 0} format${res.formats?.length === 1 ? '' : 's'}` +
            (res.blocked ? ` — ${res.blocked} blocked by the compliance guard.` : '.'),
        });
        loadStatus(tier);
      }
    } catch (e) { setMsg({ type: 'error', text: String(e?.message || e) }); }
    setGenerating(false);
  }

  const togglePick = (id) => {
    if (!id) return;
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  async function runTest() {
    const type = picked.length > 2 ? 'multivariate' : 'ab';
    if (type === 'multivariate' && !multivariate) {
      setMsg({ type: 'error', text: 'Multivariate testing isn’t on this tier — pick exactly 2, or upgrade.' }); return;
    }
    setTesting(true); setMsg(null);
    try {
      const res = await base44.functions.invoke('aiCreativeSuiteExperiment', {
        tier, asset_ids: picked, type, test_name: brief.slice(0, 60) || 'Creative test',
      });
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else { setMsg({ type: 'ok', text: `${type === 'ab' ? 'A/B' : 'Multivariate'} test launched with ${res.arms} variants.` }); setPicked([]); loadStatus(tier); }
    } catch (e) { setMsg({ type: 'error', text: String(e?.message || e) }); }
    setTesting(false);
  }

  async function learnNow() {
    setLearning(true); setMsg(null);
    try {
      const res = await base44.functions.invoke('aiCreativeSuiteLearn', { tier });
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else { setMsg({ type: 'ok', text: `Learning updated from ${res.tests_processed} test${res.tests_processed === 1 ? '' : 's'} (${res.signals_recorded} signals).` }); loadStatus(tier); }
    } catch (e) { setMsg({ type: 'error', text: String(e?.message || e) }); }
    setLearning(false);
  }

  const learning_ = status?.learning;
  const quota = status?.quota;
  const topAttrs = learning_?.top_attributes || {};

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
            <Sparkles className="w-6 h-6" style={{ color: GOLD }} /> Creative Studio
          </h1>
          <p className="text-sm text-muted-foreground">Generate ads in every format, test them, and let the AI learn what wins.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {quota && (
            <Badge variant="secondary" className="whitespace-nowrap">
              <Gauge className="w-3 h-3 mr-1" />
              {quota.remaining === 'unlimited' ? 'Unlimited' : `${quota.remaining} left`}
            </Badge>
          )}
        </div>
      </div>

      {msg && (
        <div className={`text-sm rounded-md px-3 py-2 ${msg.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: brief composer */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold"><Wand2 className="w-4 h-4" /> Brief</div>
            <div className="space-y-1.5">
              <Label>What are you advertising?</Label>
              <Textarea rows={4} placeholder="e.g. Our new sneaker drop — bold, playful, aimed at gamers who love streetwear."
                value={brief} onChange={(e) => setBrief(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Formats</Label>
              <div className="flex flex-wrap gap-1.5">
                {loadingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> :
                  formats.map((f) => (
                    <button key={f.key} onClick={() => toggleFormat(f.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${selectedFormats.includes(f.key) ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'}`}
                      style={selectedFormats.includes(f.key) ? { background: NAVY } : {}}>
                      {f.label}
                    </button>
                  ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Label>Variants / format (max {maxVariants})</Label>
                <Input type="number" min={1} max={maxVariants} value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(maxVariants, Number(e.target.value) || 1)))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <Switch checked={genImages} onCheckedChange={setGenImages} disabled={!caps?.image_generation} />
              </div>
            </div>
            <Button className="w-full" onClick={generate} disabled={generating} style={{ background: NAVY }}>
              {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate creatives</>}
            </Button>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Every creative is compliance-screened before it ships.
            </p>
          </CardContent>
        </Card>

        {/* Right: playbook + recommendations */}
        <Card className="lg:col-span-2 h-fit">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold"><Brain className="w-4 h-4" /> Self-learning playbook</div>
              <Button size="sm" variant="outline" onClick={learnNow} disabled={learning}>
                {learning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />} Learn now
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <Stat label="Learning depth" value={caps?.learning_depth || '—'} />
              <Stat label="Signals" value={learning_?.sample_size ?? 0} />
              <Stat label="Active tests" value={status?.experiments?.active ?? 0} />
              <Stat label="Autonomy" value={caps?.effective_autonomy || '—'} />
            </div>
            {Object.keys(topAttrs).length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> What's winning</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(topAttrs).map(([dim, val]) => (
                    <Badge key={dim} variant="secondary" className="capitalize">{dim.replace('_', ' ')}: <b className="ml-1">{String(val)}</b></Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Recommendations</div>
              <ul className="space-y-1 text-sm">
                {(learning_?.recommendations || ['Run a test to start the learning loop.']).map((r, i) => (
                  <li key={i} className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" /> {r}</li>
                ))}
              </ul>
            </div>
            {status?.fatigue?.due?.length > 0 && (
              <div className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2">
                {status.fatigue.due.length} creative{status.fatigue.due.length === 1 ? '' : 's'} showing fatigue — due for a refresh.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gallery */}
      {creatives.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Variants ({creatives.length})</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{picked.length} selected</span>
              <Button size="sm" onClick={runTest} disabled={picked.length < 2 || testing} style={{ background: GOLD, color: NAVY }}>
                {testing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5 mr-1.5" />}
                {picked.length > 2 ? `Run multivariate (${picked.length})` : 'Run A/B test'}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creatives.map((c, i) => {
              const selectable = c.compliant && c.id;
              const isPicked = picked.includes(c.id);
              return (
                <Card key={c.id || i} className={`overflow-hidden transition ${isPicked ? 'ring-2' : ''}`} style={isPicked ? { boxShadow: `0 0 0 2px ${GOLD}` } : {}}>
                  <BrandedAd branding={c.branding}>
                    {c.image_url
                      ? <img src={c.image_url} alt="" className="w-full h-36 object-cover" />
                      : <div className="w-full h-24 flex items-center justify-center text-xs text-slate-500 px-3 text-center bg-slate-50">{c.headline}</div>}
                  </BrandedAd>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">{c.format}</Badge>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${scoreColor(c.score)}`} />
                        <span className="text-xs font-semibold">{c.score}</span>
                      </div>
                    </div>
                    <div className="font-semibold text-sm leading-snug">{c.headline}</div>
                    <div className="text-xs text-muted-foreground line-clamp-3">{c.body}</div>
                    {c.cta && <div className="text-xs font-medium" style={{ color: NAVY }}>▸ {c.cta}</div>}
                    <Separator />
                    <div className="flex items-center justify-between">
                      {c.compliant
                        ? <span className="text-[11px] text-emerald-600 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Compliant</span>
                        : <span className="text-[11px] text-rose-600 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Blocked</span>}
                      <Button size="sm" variant={isPicked ? 'default' : 'outline'} className="h-7 text-xs"
                        disabled={!selectable} onClick={() => togglePick(c.id)}>
                        {isPicked ? 'Selected' : 'Select'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border bg-slate-50 py-2">
      <div className="text-lg font-bold capitalize" style={{ color: NAVY }}>{String(value)}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
