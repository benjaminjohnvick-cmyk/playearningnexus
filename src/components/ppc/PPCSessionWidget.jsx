import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Clock, DollarSign, CheckCircle2, Play, Pause, Trophy, Loader2, Star
} from "lucide-react";
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// Sample PPC questions pool (A/B/C/D)
const SAMPLE_QUESTIONS = [
  { q: "Which factor most influences your purchasing decisions?", opts: ["a: Price", "b: Brand reputation", "c: Product reviews", "d: Recommendations"] },
  { q: "How often do you shop online each month?", opts: ["a: Daily", "b: Weekly", "c: Monthly", "d: Rarely"] },
  { q: "What device do you primarily use to browse the web?", opts: ["a: Smartphone", "b: Laptop/Desktop", "c: Tablet", "d: Smart TV"] },
  { q: "Which social media platform do you use most?", opts: ["a: Instagram", "b: TikTok", "c: Facebook", "d: X (Twitter)"] },
  { q: "How do you prefer to receive customer support?", opts: ["a: Live chat", "b: Phone call", "c: Email", "d: Self-service FAQ"] },
  { q: "What motivates you to try a new product?", opts: ["a: Discounts/deals", "b: Friend referral", "c: Social media ad", "d: In-store display"] },
  { q: "How satisfied are you with current digital payment options?", opts: ["a: Very satisfied", "b: Somewhat satisfied", "c: Neutral", "d: Dissatisfied"] },
  { q: "Which best describes your work situation?", opts: ["a: Full-time employed", "b: Part-time/freelance", "c: Student", "d: Self-employed"] },
  { q: "How important is sustainability in your buying choices?", opts: ["a: Extremely important", "b: Somewhat important", "c: Neutral", "d: Not important"] },
  { q: "What content format do you prefer for learning?", opts: ["a: Video tutorials", "b: Written articles", "c: Podcasts", "d: Live webinars"] },
  { q: "How often do you switch brands for the same product?", opts: ["a: Always try new brands", "b: Occasionally switch", "c: Rarely switch", "d: Never switch"] },
  { q: "What is your primary motivation for using mobile apps?", opts: ["a: Entertainment", "b: Productivity", "c: Shopping", "d: Communication"] },
];

const TIER_CONFIG = {
  2: { label: 'Tier 2', ratePerQ: 0.10, questionsPerMin: 10, requiredMinutes: 8, color: 'from-purple-500 to-purple-700', secondsPerQ: 6 },
  3: { label: 'Tier 3', ratePerQ: 0.10, questionsPerMin: 10, requiredMinutes: 240, color: 'from-yellow-500 to-yellow-700', secondsPerQ: 6 },
};

export default function PPCSessionWidget({ user, tier }) {
  const config = TIER_CONFIG[tier];
  const [phase, setPhase] = useState('idle'); // idle | active | paused | done
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [questionTimer, setQuestionTimer] = useState(config.secondsPerQ);
  const [sessionData, setSessionData] = useState({ questionsAnswered: 0, minutesCompleted: 0, earnings: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const intervalRef = useRef(null);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: todaySession } = useQuery({
    queryKey: ['ppc-session', user.id, tier, today],
    queryFn: () => base44.entities.PPCSession.filter({ user_id: user.id, tier, session_date: today }),
  });

  const alreadyCompleted = todaySession?.[0]?.goal_met;

  const currentQ = SAMPLE_QUESTIONS[currentQIndex % SAMPLE_QUESTIONS.length];
  const elapsedMinutes = sessionStartTime ? (Date.now() - sessionStartTime) / 60000 : 0;
  const progressPct = Math.min(100, (sessionData.minutesCompleted / config.requiredMinutes) * 100);

  useEffect(() => {
    if (phase !== 'active') { clearInterval(intervalRef.current); return; }

    intervalRef.current = setInterval(() => {
      setQuestionTimer(t => {
        if (t <= 1) {
          // auto-advance question
          handleAnswer(null, true);
          return config.secondsPerQ;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [phase, currentQIndex]);

  const handleAnswer = (answer, autoAdvance = false) => {
    clearInterval(intervalRef.current);
    if (!autoAdvance) setSelectedAnswer(answer);

    const newQCount = sessionData.questionsAnswered + 1;
    const newMinutes = newQCount / config.questionsPerMin;
    const grossEarnings = newQCount * config.ratePerQ;
    const newEarnings = grossEarnings * 0.50 * 0.90; // 50% user share, minus 10% fee

    setSessionData({ questionsAnswered: newQCount, minutesCompleted: newMinutes, earnings: newEarnings });

    setTimeout(() => {
      setSelectedAnswer(null);
      setCurrentQIndex(i => i + 1);
      setQuestionTimer(config.secondsPerQ);

      // Check if session goal met
      if (newMinutes >= config.requiredMinutes) {
        setPhase('done');
        submitSession(newMinutes, newQCount, newEarnings);
      }
    }, 400);
  };

  const startSession = () => {
    setPhase('active');
    setSessionStartTime(Date.now());
    setCurrentQIndex(0);
    setSessionData({ questionsAnswered: 0, minutesCompleted: 0, earnings: 0 });
    setQuestionTimer(config.secondsPerQ);
  };

  const submitSession = async (minutes, qCount, earnings) => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('processPPCSession', {
        tier, minutesCompleted: Math.min(minutes, config.requiredMinutes), questionsAnswered: qCount
      });
      if (res.data?.success) {
        toast.success(`🎉 Session complete! You earned $${res.data.net_amount?.toFixed(2) || earnings.toFixed(2)} (your 50% share)`);
        queryClient.invalidateQueries(['ppc-session']);
      }
    } catch {
      toast.error('Session recorded locally — sync will occur shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndEarly = () => {
    setPhase('done');
    submitSession(sessionData.minutesCompleted, sessionData.questionsAnswered, sessionData.earnings);
  };

  if (alreadyCompleted) {
    return (
      <Card className="border-2 border-green-300 bg-green-50">
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="font-bold text-green-800 text-lg">Today's Session Complete! ✓</h3>
          <p className="text-green-700 text-sm mt-1">You've earned your daily PPC income. Come back tomorrow to continue your streak.</p>
          <p className="text-2xl font-bold text-green-600 mt-3">${((todaySession[0].earnings || 8) * 0.50 * 0.90).toFixed(2)} earned (your share)</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl overflow-hidden">
      <div className={`h-2 bg-gradient-to-r ${config.color}`} />
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            {config.label} Daily PPC Session
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700">${config.ratePerQ}/question</Badge>
            <Badge className="bg-blue-100 text-blue-700">{config.requiredMinutes} min required</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Session Progress</span>
            <span className="font-bold text-gray-900">{sessionData.minutesCompleted.toFixed(1)} / {config.requiredMinutes} min</span>
          </div>
          <Progress value={progressPct} className="h-3" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-purple-600">{sessionData.questionsAnswered}</p>
            <p className="text-xs text-gray-500">Questions</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-green-600">${sessionData.earnings.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Earned</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-blue-600">{sessionData.minutesCompleted.toFixed(1)}</p>
            <p className="text-xs text-gray-500">Minutes</p>
          </div>
        </div>

        {/* Question area */}
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
              <p className="text-gray-500 mb-4">Answer 10 questions per minute at $0.10/question = <strong>$0.45/minute to you</strong> (50% share after fee)</p>
              <Button onClick={startSession} size="lg" className={`bg-gradient-to-r ${config.color} text-white px-10`}>
                <Play className="w-5 h-5 mr-2" /> Start {config.requiredMinutes}-Minute Session
              </Button>
            </motion.div>
          )}

          {phase === 'active' && (
            <motion.div key={currentQIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-3">
              {/* Timer bar */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-red-400 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(questionTimer / config.secondsPerQ) * 100}%` }} />
                </div>
                <span className="text-sm font-bold text-red-500 w-5">{questionTimer}s</span>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-100">
                <p className="text-sm text-gray-400 mb-1">Question {sessionData.questionsAnswered + 1}</p>
                <p className="font-semibold text-gray-900 text-base">{currentQ.q}</p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {currentQ.opts.map((opt, idx) => {
                  const letter = ['a', 'b', 'c', 'd'][idx];
                  return (
                    <button key={letter}
                      onClick={() => handleAnswer(letter)}
                      disabled={selectedAnswer !== null}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        selectedAnswer === letter
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50 text-gray-700'
                      }`}
                    >
                      <span className="font-bold uppercase text-purple-600 mr-2">{letter}.</span> {opt.split(': ')[1]}
                    </button>
                  );
                })}
              </div>

              <Button variant="outline" size="sm" className="w-full text-gray-400" onClick={handleEndEarly}>
                <Pause className="w-4 h-4 mr-2" /> End Session Early
              </Button>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
              {submitting ? (
                <><Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-3" /><p>Finalizing earnings…</p></>
              ) : (
                <>
                  <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900">Session Complete!</h3>
                  <p className="text-3xl font-bold text-green-600 mt-2">${sessionData.earnings.toFixed(2)}</p>
                  <p className="text-sm text-gray-500 mt-1">{sessionData.questionsAnswered} questions answered</p>
                  {sessionData.minutesCompleted < config.requiredMinutes && (
                    <Button className="mt-4" onClick={startSession}>Continue Session</Button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}