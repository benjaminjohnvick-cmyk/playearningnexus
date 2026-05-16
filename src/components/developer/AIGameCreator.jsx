import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Wand2, Gamepad2, Star, Code2, Rocket, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export default function AIGameCreator() {
  const [phase, setPhase] = useState('intro'); // intro | generating | concept | gdd_loading | gdd
  const [concept, setConcept] = useState(null);
  const [gdd, setGdd] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const generateConcept = async () => {
    setLoading(true);
    setPhase('generating');
    try {
      const res = await base44.functions.invoke('aiGameCreatorFromFeedback', { action: 'generate_concept' });
      setConcept(res.data?.concept);
      setPhase('concept');
      toast.success('Game concept generated from user feedback!');
    } catch (e) {
      toast.error(e.message);
      setPhase('intro');
    }
    setLoading(false);
  };

  const generateGDD = async () => {
    setLoading(true);
    setPhase('gdd_loading');
    try {
      const res = await base44.functions.invoke('aiGameCreatorFromFeedback', {
        action: 'generate_gdd',
        game_concept: concept,
      });
      setGdd(res.data?.gdd);
      setPhase('gdd');
      toast.success('Full Game Design Document ready!');
    } catch (e) {
      toast.error(e.message);
      setPhase('concept');
    }
    setLoading(false);
  };

  const toggleSection = (key) => setExpandedSection(s => s === key ? null : key);

  const scoreColor = (s) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card className="border-0 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="w-5 h-5 text-violet-600" />
          AI Game Creator
          <Badge className="bg-violet-100 text-violet-700 ml-auto">Powered by User Data</Badge>
        </CardTitle>
        <p className="text-xs text-gray-500">AI reads ALL survey responses, reviews, and suggestions to design games users actually want.</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {phase === 'intro' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: '📊', title: 'Reads All Feedback', desc: 'Survey responses, reviews, votes, suggestions' },
                { emoji: '🧠', title: 'AI Design Engine', desc: 'Identifies patterns, gaps, and opportunities' },
                { emoji: '📋', title: 'Full Game Design Doc', desc: 'Complete GDD ready for developers' },
                { emoji: '🆓', title: '100% Free', desc: 'No cost — built into GamerGain platform' },
              ].map(item => (
                <div key={item.title} className="p-3 bg-violet-50 border border-violet-100 rounded-xl text-xs text-center">
                  <p className="text-xl mb-1">{item.emoji}</p>
                  <p className="font-bold text-violet-700">{item.title}</p>
                  <p className="text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
            <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 h-11" onClick={generateConcept}>
              <Wand2 className="w-4 h-4 mr-2" /> Generate Game from User Feedback
            </Button>
          </div>
        )}

        {(phase === 'generating' || phase === 'gdd_loading') && (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-800">
                {phase === 'generating' ? 'Analyzing all user feedback data...' : 'Writing full Game Design Document...'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {phase === 'generating'
                  ? 'Reading surveys, reviews, suggestions, and ratings'
                  : 'Generating mechanics, levels, UI specs, and roadmap'}
              </p>
            </div>
          </div>
        )}

        {phase === 'concept' && concept && (
          <div className="space-y-4">
            {/* Hero */}
            <div className="p-4 bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl text-white">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-black text-xl">{concept.game_title}</p>
                  <p className="text-violet-200 text-sm">{concept.tagline}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black ${concept.market_opportunity_score >= 80 ? 'text-yellow-300' : 'text-white'}`}>
                    {concept.market_opportunity_score}/100
                  </p>
                  <p className="text-[10px] text-violet-200">Market Score</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge className="bg-white/20 text-white text-[10px]">{concept.genre}</Badge>
                {(concept.platform || []).map(p => <Badge key={p} className="bg-white/20 text-white text-[10px]">{p}</Badge>)}
                <Badge className="bg-yellow-400/30 text-yellow-200 text-[10px]">~{concept.estimated_dev_time_months}mo dev</Badge>
              </div>
            </div>

            {/* Core concept */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
              <p className="font-bold text-gray-700 mb-1">🎮 Core Concept</p>
              <p className="text-gray-600">{concept.core_concept}</p>
            </div>

            {/* Key features */}
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">⭐ Key Features</p>
              <div className="grid grid-cols-2 gap-2">
                {(concept.key_features || []).slice(0, 6).map((f, i) => (
                  <div key={i} className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">• {f}</div>
                ))}
              </div>
            </div>

            {/* Evidence */}
            {concept.user_demand_evidence?.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs">
                <p className="font-bold text-green-700 mb-1">📊 Based on User Data</p>
                {concept.user_demand_evidence.slice(0, 3).map((e, i) => <p key={i} className="text-green-600">• {e}</p>)}
              </div>
            )}

            {/* Retention mechanics */}
            {concept.retention_mechanics?.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                <p className="font-bold text-amber-700 mb-1">🔄 Retention Mechanics</p>
                {concept.retention_mechanics.slice(0, 3).map((m, i) => <p key={i} className="text-amber-600">• {m}</p>)}
              </div>
            )}

            {/* Projection */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
              <div>
                <p className="font-bold text-emerald-700">💰 Revenue Projection (Year 1)</p>
                <p className="text-emerald-600">{concept.projected_revenue_first_year}</p>
              </div>
              <Rocket className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={generateConcept} disabled={loading}>
                <Wand2 className="w-4 h-4 mr-1" /> New Concept
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600" onClick={generateGDD} disabled={loading}>
                <Code2 className="w-4 h-4 mr-1" /> Generate Full GDD
              </Button>
            </div>
          </div>
        )}

        {phase === 'gdd' && gdd && concept && (
          <div className="space-y-3">
            <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl">
              <p className="text-sm font-bold text-violet-700">📋 Game Design Document: {concept.game_title}</p>
              <p className="text-xs text-violet-600 mt-1">{gdd.executive_summary}</p>
            </div>

            {[
              { key: 'core_mechanics', label: '⚙️ Core Mechanics', render: (data) => data.map((m, i) => (
                <div key={i} className="p-2 bg-gray-50 rounded border text-xs mb-1">
                  <p className="font-bold text-gray-700">{m.name}</p>
                  <p className="text-gray-500">{m.description}</p>
                </div>
              ))},
              { key: 'ui_screens', label: '🖼 UI Screens', render: (data) => data.map((s, i) => (
                <div key={i} className="p-2 bg-gray-50 rounded border text-xs mb-1">
                  <p className="font-bold text-gray-700">{s.screen_name}</p>
                  <p className="text-gray-500">{s.description}</p>
                </div>
              ))},
              { key: 'milestones', label: '📅 Development Milestones', render: (data) => data.map((m, i) => (
                <div key={i} className="p-2 bg-gray-50 rounded border text-xs mb-1">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold text-gray-700">{m.name}</p>
                    <Badge className="text-[10px] bg-blue-100 text-blue-700">{m.duration_weeks}w</Badge>
                  </div>
                  {(m.deliverables || []).map((d, j) => <p key={j} className="text-gray-500">• {d}</p>)}
                </div>
              ))},
              { key: 'launch_checklist', label: '🚀 Launch Checklist', render: (data) => data.map((item, i) => (
                <p key={i} className="text-xs text-gray-600">☐ {item}</p>
              ))},
            ].map(section => (
              <div key={section.key} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-700"
                  onClick={() => toggleSection(section.key)}
                >
                  {section.label}
                  {expandedSection === section.key ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSection === section.key && (
                  <div className="p-3">
                    {section.render(gdd[section.key] || [])}
                  </div>
                )}
              </div>
            ))}

            {gdd.technical_stack && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <p className="font-bold text-slate-700 mb-1">🛠 Tech Stack</p>
                <p className="text-slate-600">Engine: {gdd.technical_stack.engine} · Backend: {gdd.technical_stack.backend}</p>
                <p className="text-slate-500 mt-1">APIs: {(gdd.technical_stack.apis || []).join(', ')}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase('concept')}>
                ← Back to Concept
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600" onClick={generateConcept} disabled={loading}>
                <Wand2 className="w-4 h-4 mr-1" /> Generate New Game
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}