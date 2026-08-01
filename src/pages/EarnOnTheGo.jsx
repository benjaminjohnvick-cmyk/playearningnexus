import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import BurstMode from '@/components/surveys/BurstMode';
import BuddyPanel from '@/components/surveys/BuddyPanel';
import { Loader2, Zap } from 'lucide-react';

/**
 * EarnOnTheGo — the on-the-go survey page. Pulls the user's currently-available BitLabs surveys (shortest
 * first, via getPersonalizedSurveys), hands them to BurstMode, and routes each burst: a BitLabs survey opens
 * its link; an AdGrid top-up routes to the AdGrid page. The daily progress bar and pace controls live in
 * BurstMode.
 */
export default function EarnOnTheGo() {
  const [surveys, setSurveys] = useState([]);
  const [linkById, setLinkById] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getPersonalizedSurveys', {});
        const list = res.data?.surveys || res.data || [];
        const mapped = (Array.isArray(list) ? list : []).map((s) => ({
          id: String(s.id), loi_minutes: Number(s.loi) || undefined, reward: parseFloat(s.cpi) || undefined,
        }));
        const links = {};
        (Array.isArray(list) ? list : []).forEach((s) => { if (s.link) links[String(s.id)] = s.link; });
        setSurveys(mapped);
        setLinkById(links);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const openSurvey = (survey, mode) => {
    if (mode === 'adgrid') { window.location.href = createPageUrl('AdGridSurvey'); return; }
    if (mode === 'bitlabs_survey' && survey?.id && linkById[survey.id]) { window.location.href = linkById[survey.id]; return; }
    // fallback: the general survey page
    window.location.href = createPageUrl('Surveys');
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2"><Zap className="w-7 h-7 text-indigo-600" /><h1 className="text-2xl font-bold">Earn on the go</h1></div>
      <p className="text-sm text-slate-500 mb-4">Work your daily goal in short bursts — a quick survey, a break, then back to it. Your progress follows you across your phone and computer, and saves even if you lose signal.</p>

      {loading ? (
        <div className="p-6 flex items-center gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> Finding your quickest surveys…</div>
      ) : (
        <div className="space-y-4">
          <BurstMode availableSurveys={surveys} onOpenSurvey={openSurvey} />
          <BuddyPanel />
        </div>
      )}
    </div>
  );
}
