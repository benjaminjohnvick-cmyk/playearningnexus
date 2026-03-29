import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, DollarSign, Loader2, PiggyBank } from "lucide-react";
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function PPCSurveyTaker({ survey, user, onClose }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [phase, setPhase] = useState('taking'); // taking | submitting | done
  const [startTime] = useState(Date.now());
  const queryClient = useQueryClient();

  // Language routing: pick the best matching language version for this user
  const userLang = user?.preferred_language || user?.language || 'en';
  const surveyLang = survey.language_code || 'en';
  let activeQuestions = survey.questions || [];
  let activeTitle = survey.title;
  let usedLanguage = surveyLang;

  if (userLang !== 'en' && userLang !== surveyLang) {
    // Check if inline translation exists
    const inlineTranslation = survey.translations?.[userLang];
    if (inlineTranslation?.questions?.length) {
      activeQuestions = inlineTranslation.questions;
      activeTitle = inlineTranslation.title || survey.title;
      usedLanguage = userLang;
    }
  }

  const questions = activeQuestions;
  const skipLogic = survey.skip_logic || [];
  const progress = ((currentQ) / questions.length) * 100;

  // Resolve the next question index respecting skip logic rules
  const resolveNext = (questionIndex, selectedOption) => {
    const matchingRule = skipLogic.find(
      r => r.source_question_index === questionIndex && r.selected_option === selectedOption
    );
    if (matchingRule) {
      if (matchingRule.action === 'end_survey') return 'end';
      if (matchingRule.action === 'skip_to' && matchingRule.target_question_index !== undefined) {
        return matchingRule.target_question_index;
      }
    }
    // Default: go to next question
    return questionIndex + 1;
  };

  // Simple device fingerprint (canvas + navigator combination)
  const getFingerprint = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('GamerGain🎮', 2, 2);
      const canvasStr = canvas.toDataURL().slice(-50);
      const nav = `${navigator.language}|${navigator.hardwareConcurrency}|${screen.width}x${screen.height}`;
      return btoa(canvasStr + nav).slice(0, 32);
    } catch { return 'unknown'; }
  };

  const handleSelect = (option) => {
    setSelectedAnswer(option);
    const newAnswers = [...answers, { question_index: currentQ, selected_option: option }];
    setAnswers(newAnswers);

    setTimeout(() => {
      const next = resolveNext(currentQ, option);
      if (next === 'end' || next >= questions.length) {
        submitResponses(newAnswers);
      } else {
        setCurrentQ(next);
        setSelectedAnswer(null);
      }
    }, 400);
  };

  const submitResponses = async (finalAnswers) => {
    setPhase('submitting');
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    try {
      const responseRecord = await base44.entities.PPCSurveyResponse.create({
        survey_id: survey.id,
        user_id: user.id,
        answers: finalAnswers,
        completed: true,
        generated_sale: survey.survey_type === 'product_listing' ? Math.random() > 0.7 : false,
        payout_to_user: 0,
        language: usedLanguage,
        time_taken_seconds: timeTaken,
      });

      // Score the response asynchronously (fire-and-forget)
      base44.functions.invoke('scoreSurveyResponse', {
        response_id: responseRecord.id,
        survey_id: survey.id,
      }).catch(() => {});

      // Fraud / proxy check then trigger micro-payout if clean
      base44.functions.invoke('checkSurveyFraud', {
        response_id: responseRecord.id,
        survey_id: survey.id,
        user_agent: navigator.userAgent,
        fingerprint: getFingerprint(),
        ip_address: 'unknown',
      }).then(fraudRes => {
        const action = fraudRes?.data?.action;
        // Only pay out if not blocked
        if (action !== 'block') {
          return base44.functions.invoke('respondentMicroPayout', {
            response_id: responseRecord.id,
            survey_id: survey.id,
            respondent_user_id: user.id,
          });
        }
      }).catch(() => {});

      // Increment response count on survey
      await base44.entities.PPCSurvey.update(survey.id, {
        responses_count: (survey.responses_count || 0) + 1,
      });

      // Credit user for completing (Type 2 — paid per sale trigger, Type 1 — $4 per response shared)
      const userEarning = survey.survey_type === 'data_collection' ? 2.00 : 0; // $2 user share of $4
      if (userEarning > 0) {
        await base44.auth.updateMe({ current_balance: (user.current_balance || 0) + userEarning });
        // Fire a reward notification for the notifier to pick up
        await base44.entities.Notification.create({
          user_id: user.id,
          type: 'points_earned',
          title: '💰 Survey Reward Credited!',
          message: `$${userEarning.toFixed(2)} added to your balance for completing "${survey.title}"`,
          status: 'unread',
          delivery_method: ['in_app'],
        }).catch(() => {});
      }

      queryClient.invalidateQueries(['ppc-surveys-active']);
      setPhase('done');
    } catch {
      toast.error('Failed to submit. Please try again.');
      setPhase('taking');
      setCurrentQ(0);
      setAnswers([]);
    }
  };

  if (!questions.length) {
    return (
      <Card><CardContent className="p-8 text-center">
        <p className="text-gray-500">This survey has no questions yet.</p>
        <Button onClick={onClose} className="mt-4" variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
      </CardContent></Card>
    );
  }

  const handleReinvest = async () => {
    const earning = survey.survey_type === 'data_collection' ? 2.00 : 0;
    if (earning <= 0) return;
    const currentUser = await base44.auth.me();
    const currentBalance = currentUser?.current_balance || 0;
    const sweepAmt = parseFloat(Math.min(earning, currentBalance).toFixed(2));
    if (sweepAmt <= 0) return;
    await base44.auth.updateMe({
      current_balance: parseFloat((currentBalance - sweepAmt).toFixed(2)),
      vault_balance: parseFloat(((currentUser?.vault_balance || 0) + sweepAmt).toFixed(2)),
    });
    toast.success(`$${sweepAmt.toFixed(2)} swept into your Gift Card Vault! 🎁`);
    onClose();
  };

  if (phase === 'done') {
    const earning = survey.survey_type === 'data_collection' ? 2.00 : 0;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-2 border-green-300">
          <CardContent className="p-10 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Survey Complete!</h3>
            {earning > 0 && (
              <>
                <p className="text-lg text-green-600 font-bold">+${earning.toFixed(2)} added to your balance</p>
                <div className="flex gap-2 mt-4 justify-center">
                  <Button onClick={handleReinvest} className="bg-violet-600 hover:bg-violet-700 gap-2">
                    <PiggyBank className="w-4 h-4" /> Quick Re-invest into Vault
                  </Button>
                  <Button onClick={onClose} variant="outline">Keep in Balance</Button>
                </div>
              </>
            )}
            {earning === 0 && (
              <Button onClick={onClose} className="mt-6 bg-green-600 hover:bg-green-700">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Surveys
              </Button>
            )}
            <p className="text-gray-400 text-xs mt-3">Thank you for completing this survey.</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (phase === 'submitting') {
    return (
      <Card><CardContent className="p-12 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto mb-3" />
        <p className="text-gray-600">Submitting your responses…</p>
      </CardContent></Card>
    );
  }

  const q = questions[currentQ];
  const showLangBadge = usedLanguage !== 'en';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {showLangBadge && <Badge className="bg-blue-100 text-blue-700 text-xs">{usedLanguage.toUpperCase()}</Badge>}
          <Badge className="bg-purple-100 text-purple-700">{currentQ + 1} / {questions.length}</Badge>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="space-y-2">
            <h3 className="font-bold text-gray-900">{survey.title}</h3>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p className="font-semibold text-gray-900 text-lg mb-4">{q.question}</p>
              <div className="space-y-2">
                {['a', 'b', 'c', 'd'].map(opt => {
                  const text = q[`option_${opt}`];
                  if (!text) return null;
                  return (
                    <button key={opt}
                      onClick={() => handleSelect(opt)}
                      disabled={selectedAnswer !== null}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        selectedAnswer === opt
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50 text-gray-700'
                      }`}
                    >
                      <span className="font-bold uppercase text-purple-600 mr-2">{opt}.</span> {text}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}