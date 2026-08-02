import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Server, CheckCircle2, TrendingUp, Cpu } from 'lucide-react';

/**
 * ProviderAdvisor (admin) — tells you WHEN to move an AI capability onto your own self-hosted GPU. The
 * self-hosted backends are already coded in; this watches REAL hosted spend per capability and recommends
 * the switch once a capability's projected monthly cost beats the GPU break-even. Free-tier (Groq) and
 * self-hosted usage cost $0, so they never trigger a recommendation.
 */
const LABELS = { llm: 'Language model (LLM)', stt: 'Speech-to-text', tts: 'Text-to-speech', image: 'Image generation' };

export default function ProviderAdvisor() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('providerAdvisor', {});
        if (!res.data?.error) setData(res.data);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) return <div className="p-6 flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading provider advisor…</div>;
  if (!data) return <div className="p-6 text-slate-500">Advisor unavailable.</div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Cpu className="w-6 h-6 text-violet-600" />
        <h1 className="text-xl font-semibold text-slate-800">Self-host advisor</h1>
      </div>
      <p className="text-sm text-slate-600">
        Your AI runs on hosted providers (no GPU). Self-hosting is already built in — this tells you when it
        starts paying off. Break-even reference: a self-hosted GPU at <strong>{money(data.gpu_break_even_usd)}/mo</strong>.
        Spend shown is real money this month ({data.month}); free-tier and self-hosted calls are $0.
      </p>

      {data.any_recommended ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> One or more capabilities now cost more than a GPU would — see the recommendations below.
        </div>
      ) : (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Hosted is still the cheapest option for everything. Nothing to switch yet.
        </div>
      )}

      <div className="space-y-3">
        {(data.recommendations || []).map((r) => (
          <Card key={r.capability} className={r.recommend_self_host ? 'border-amber-300' : 'border-slate-200'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2"><Server className="w-4 h-4 text-slate-400" /> {LABELS[r.capability] || r.capability}</span>
                <span className="text-xs font-normal text-slate-500">on <strong>{r.current_provider}</strong>{r.already_self_hosted ? ' (self-hosted)' : ''}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span>This month: <strong>{money(r.month_spend_usd)}</strong></span>
                <span>Projected: <strong>{money(r.projected_monthly_usd)}/mo</strong></span>
                <span>Break-even: {money(r.gpu_break_even_usd)}/mo</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${r.recommend_self_host ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, r.gpu_break_even_usd > 0 ? (r.projected_monthly_usd / r.gpu_break_even_usd) * 100 : 0)}%` }} />
              </div>
              <p className={`text-xs ${r.recommend_self_host ? 'text-amber-800' : 'text-slate-500'}`}>{r.headline}</p>
              {r.recommend_self_host && (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700">
                  <div className="font-medium mb-0.5">How to switch: set {r.how_to?.setting} = {r.how_to?.value}</div>
                  <div className="text-slate-500">{r.how_to?.steps}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
