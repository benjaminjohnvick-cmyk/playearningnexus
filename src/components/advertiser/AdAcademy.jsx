import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, CheckCircle, Lock, PlayCircle, Trophy, Zap, Star, BookOpen, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { toast } from 'sonner';

const MODULES = [
  {
    id: 'intro_grid',
    title: 'Understanding the Million Dollar Ad Grid',
    emoji: '🗺️',
    duration: '4 min',
    badge: { icon: '🗺️', label: 'Grid Expert', color: 'bg-blue-500/20 border-blue-500/30 text-blue-300' },
    multiplier: 1.1,
    steps: [
      { q: 'The ad grid has how many zones?', opts: ['2', '4', '8', '10'], answer: 1 },
      { q: 'What determines your grid placement?', opts: ['Ad color', 'Bid amount', 'Account age', 'Ad size'], answer: 1 },
      { q: 'Which tier gets the most user traffic?', opts: ['Economy', 'Standard', 'High', 'Premium'], answer: 3 },
    ],
  },
  {
    id: 'optimize_bids',
    title: 'How to Optimize Bids for ROI',
    emoji: '💰',
    duration: '5 min',
    badge: { icon: '💰', label: 'Bid Master', color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300' },
    multiplier: 1.15,
    steps: [
      { q: 'What is cost-per-completion?', opts: ['Total spend ÷ views', 'Total spend ÷ completions', 'Bid × days', 'Clicks ÷ budget'], answer: 1 },
      { q: 'Smart Bidding helps you:', opts: ['Pay more always', 'Pause ads randomly', 'Auto-adjust bids based on balance', 'Change your image'], answer: 2 },
      { q: 'When should you increase your bid?', opts: ['When CTR drops', 'When CTR is high & budget allows', 'Never', 'Only on weekends'], answer: 1 },
    ],
  },
  {
    id: 'creatives',
    title: 'Creating High-Converting Ad Creatives',
    emoji: '🎨',
    duration: '6 min',
    badge: { icon: '🎨', label: 'Creative Pro', color: 'bg-purple-500/20 border-purple-500/30 text-purple-300' },
    multiplier: 1.2,
    steps: [
      { q: 'What makes a tagline effective?', opts: ['Long and detailed', 'Short, punchy, under 8 words', 'Uses technical jargon', 'All caps always'], answer: 1 },
      { q: 'A/B testing helps you:', opts: ['Spend more budget', 'Compare two creatives to find the winner', 'Duplicate ads', 'Pause campaigns'], answer: 1 },
      { q: 'Best image format for the grid?', opts: ['Portrait (tall)', 'Wide landscape', 'Square 1:1', 'Panoramic'], answer: 2 },
    ],
  },
  {
    id: 'analytics',
    title: 'Reading Your Analytics Dashboard',
    emoji: '📊',
    duration: '5 min',
    badge: { icon: '📊', label: 'Data Analyst', color: 'bg-green-500/20 border-green-500/30 text-green-300' },
    multiplier: 1.25,
    steps: [
      { q: 'CTR stands for:', opts: ['Cost to Run', 'Click-Through Rate', 'Creative Test Result', 'Completion Total Rate'], answer: 1 },
      { q: 'ROI is calculated as:', opts: ['Spend / Clicks', '(Revenue - Cost) / Cost × 100', 'Views × Bid', 'Completions - Clicks'], answer: 1 },
      { q: 'The heatmap shows:', opts: ['Your wallet balance', 'Grid zones with most user attention', 'Number of competitors', 'Budget remaining'], answer: 1 },
    ],
  },
  {
    id: 'loyalty_advanced',
    title: 'Maximizing GamerGain Points & Rewards',
    emoji: '⭐',
    duration: '3 min',
    badge: { icon: '⭐', label: 'Points Legend', color: 'bg-orange-500/20 border-orange-500/30 text-orange-300' },
    multiplier: 1.3,
    steps: [
      { q: 'Points are earned by:', opts: ['Spending more money', 'Hitting performance milestones', 'Inviting friends only', 'Changing your ad image'], answer: 1 },
      { q: 'Diamond tier unlocks after:', opts: ['100 pts', '700 pts', '1500 pts', '2500 pts'], answer: 3 },
      { q: 'Points can be redeemed for:', opts: ['Cash withdrawals', 'Bid discounts & featured spots', 'Extra accounts', 'API access'], answer: 1 },
    ],
  },
];

function QuizStep({ step, onAnswer }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (selected === null) return;
    setSubmitted(true);
    setTimeout(() => onAnswer(selected === step.answer), 900);
  };

  return (
    <div className="space-y-3">
      <p className="text-white font-bold text-sm">{step.q}</p>
      <div className="space-y-2">
        {step.opts.map((opt, i) => (
          <button key={i} onClick={() => !submitted && setSelected(i)}
            className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
              submitted
                ? i === step.answer ? 'bg-green-500/20 border-green-500/40 text-green-300'
                  : i === selected ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'border-gray-700 text-gray-500'
                : selected === i
                  ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}>
            {opt}
          </button>
        ))}
      </div>
      {!submitted && (
        <Button onClick={submit} disabled={selected === null} size="sm"
          className="bg-yellow-500 text-black font-black text-xs gap-1">
          Submit Answer
        </Button>
      )}
    </div>
  );
}

export default function AdAcademy({ userId }) {
  const [completedModules, setCompletedModules] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`gg_academy_${userId}`) || '[]'); } catch { return []; }
  });
  const [activeModule, setActiveModule] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [wrongAnswer, setWrongAnswer] = useState(false);

  const totalMultiplier = MODULES
    .filter(m => completedModules.includes(m.id))
    .reduce((acc, m) => acc * m.multiplier, 1.0);

  const startModule = (mod) => {
    if (completedModules.includes(mod.id)) return;
    setActiveModule(mod);
    setCurrentStep(0);
    setWrongAnswer(false);
  };

  const handleAnswer = (correct) => {
    if (!correct) {
      setWrongAnswer(true);
      setTimeout(() => setWrongAnswer(false), 800);
      return;
    }
    if (currentStep + 1 < activeModule.steps.length) {
      setCurrentStep(s => s + 1);
    } else {
      // Complete
      const next = [...completedModules, activeModule.id];
      setCompletedModules(next);
      localStorage.setItem(`gg_academy_${userId}`, JSON.stringify(next));
      toast.success(`🎓 Module complete! +${activeModule.badge.label} badge earned!`);
      setActiveModule(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-yellow-400 font-black text-xl">{completedModules.length}/{MODULES.length}</p>
          <p className="text-gray-500 text-[11px]">Modules done</p>
        </div>
        <div className="bg-gray-800/60 border border-purple-500/20 rounded-xl p-3 text-center">
          <p className="text-purple-400 font-black text-xl">{completedModules.length}</p>
          <p className="text-gray-500 text-[11px]">Badges earned</p>
        </div>
        <div className="bg-gray-800/60 border border-green-500/20 rounded-xl p-3 text-center">
          <p className="text-green-400 font-black text-xl">{totalMultiplier.toFixed(2)}×</p>
          <p className="text-gray-500 text-[11px]">Points multiplier</p>
        </div>
      </div>

      {/* Earned badges */}
      {completedModules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {MODULES.filter(m => completedModules.includes(m.id)).map(m => (
            <Badge key={m.id} className={`${m.badge.color} border text-xs gap-1.5`}>
              {m.badge.icon} {m.badge.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Active quiz */}
      {activeModule && (
        <div className={`bg-gray-900 border rounded-2xl p-5 space-y-4 transition-all ${wrongAnswer ? 'border-red-500/50' : 'border-yellow-500/30'}`}>
          <div className="flex items-center justify-between">
            <p className="text-yellow-300 font-black text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> {activeModule.title}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">{currentStep + 1}/{activeModule.steps.length}</span>
              <button onClick={() => setActiveModule(null)} className="text-gray-600 hover:text-white text-lg leading-none">✕</button>
            </div>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 transition-all rounded-full"
              style={{ width: `${((currentStep) / activeModule.steps.length) * 100}%` }} />
          </div>
          <QuizStep step={activeModule.steps[currentStep]} onAnswer={handleAnswer} />
          {wrongAnswer && (
            <p className="text-red-400 text-xs font-bold animate-pulse">Incorrect — try again!</p>
          )}
        </div>
      )}

      {/* Module list */}
      {!activeModule && (
        <div className="space-y-2">
          {MODULES.map((mod, idx) => {
            const done = completedModules.includes(mod.id);
            const locked = idx > 0 && !completedModules.includes(MODULES[idx - 1].id);
            return (
              <div key={mod.id} className={`border rounded-xl p-4 transition-all ${
                done ? 'border-green-500/20 bg-green-500/5' :
                locked ? 'border-gray-700/30 opacity-50' :
                'border-gray-700 hover:border-yellow-500/30 cursor-pointer'
              }`} onClick={() => !done && !locked && startModule(mod)}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">{mod.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold text-sm">{mod.title}</p>
                      {done && <Badge className={`${mod.badge.color} border text-[10px]`}>{mod.badge.icon} {mod.badge.label}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>⏱ {mod.duration}</span>
                      <span>{mod.steps.length} questions</span>
                      <span className="text-green-400">+{((mod.multiplier - 1) * 100).toFixed(0)}% point multiplier</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {done ? <CheckCircle className="w-5 h-5 text-green-400" /> :
                     locked ? <Lock className="w-5 h-5 text-gray-600" /> :
                     <PlayCircle className="w-5 h-5 text-yellow-400" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completedModules.length === MODULES.length && (
        <div className="text-center py-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl">
          <p className="text-yellow-400 font-black text-lg">🎓 Academy Graduate!</p>
          <p className="text-gray-400 text-sm mt-1">You've earned the {totalMultiplier.toFixed(2)}× permanent points multiplier</p>
        </div>
      )}
    </div>
  );
}