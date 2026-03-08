import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, DollarSign, Loader2 } from "lucide-react";
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function PPCSurveyTaker({ survey, user, onClose }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [phase, setPhase] = useState('taking'); // taking | submitting | done
  const queryClient = useQueryClient();

  const questions = survey.questions || [];
  const progress = ((currentQ) / questions.length) * 100;

  const handleSelect = (option) => {
    setSelectedAnswer(option);
    const newAnswers = [...answers, { question_index: currentQ, selected_option: option }];
    setAnswers(newAnswers);

    setTimeout(() => {
      if (currentQ + 1 >= questions.length) {
        submitResponses(newAnswers);
      } else {
        setCurrentQ(q => q + 1);
        setSelectedAnswer(null);
      }
    }, 400);
  };

  const submitResponses = async (finalAnswers) => {
    setPhase('submitting');
    try {
      await base44.entities.PPCSurveyResponse.create({
        survey_id: survey.id,
        user_id: user.id,
        answers: finalAnswers,
        completed: true,
        generated_sale: survey.survey_type === 'product_listing' ? Math.random() > 0.7 : false,
        payout_to_user: 0,
      });

      // Increment response count on survey
      await base44.entities.PPCSurvey.update(survey.id, {
        responses_count: (survey.responses_count || 0) + 1,
      });

      // Credit user for completing (Type 2 — paid per sale trigger, Type 1 — $4 per response shared)
      const userEarning = survey.survey_type === 'data_collection' ? 2.00 : 0; // $2 user share of $4
      if (userEarning > 0) {
        await base44.auth.updateMe({ current_balance: (user.current_balance || 0) + userEarning });
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

  if (phase === 'done') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-2 border-green-300">
          <CardContent className="p-10 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Survey Complete!</h3>
            {survey.survey_type === 'data_collection' && (
              <p className="text-lg text-green-600 font-bold">+$2.00 added to your balance</p>
            )}
            <p className="text-gray-500 text-sm mt-2">Thank you for completing this survey.</p>
            <Button onClick={onClose} className="mt-6 bg-green-600 hover:bg-green-700">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Surveys
            </Button>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Badge className="bg-purple-100 text-purple-700">{currentQ + 1} / {questions.length}</Badge>
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