import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, ArrowRight, ArrowLeft, CheckCircle2, Gamepad2, DollarSign, Trophy, Gift } from 'lucide-react';

const tutorialSteps = [
  {
    title: "Welcome to GameRewards! 🎮",
    description: "Discover amazing games, complete surveys, and earn real money. Let's get you started!",
    icon: Gamepad2,
    color: "from-blue-600 to-purple-600"
  },
  {
    title: "Play Featured Games",
    description: "Install and play featured games for 2 minutes to unlock daily earning opportunities. Each install earns you rewards!",
    icon: Gamepad2,
    color: "from-red-600 to-pink-600"
  },
  {
    title: "Complete Surveys",
    description: "Earn money by sharing your opinions through surveys. The more surveys you complete, the more you earn!",
    icon: DollarSign,
    color: "from-green-600 to-emerald-600"
  },
  {
    title: "Unlock Achievements",
    description: "Complete challenges, maintain streaks, and unlock achievements to earn bonus rewards and climb the leaderboard!",
    icon: Trophy,
    color: "from-yellow-600 to-orange-600"
  },
  {
    title: "Start Earning Today!",
    description: "You're all set! Start playing games, complete your first survey, and watch your earnings grow.",
    icon: CheckCircle2,
    color: "from-indigo-600 to-purple-600"
  }
];

export default function OnboardingTutorial({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = tutorialSteps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-lg"
        >
          <Card className="p-8 relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
              onClick={onSkip}
            >
              <X className="w-5 h-5" />
            </Button>

            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6 mx-auto`}>
              <Icon className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-center mb-4">{step.title}</h2>
            <p className="text-gray-600 text-center mb-8">{step.description}</p>

            <div className="flex items-center justify-center gap-2 mb-6">
              {tutorialSteps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentStep ? 'w-8 bg-red-600' : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handlePrev} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <Button
                onClick={handleNext}
                className={`flex-1 bg-gradient-to-r ${step.color}`}
              >
                {currentStep < tutorialSteps.length - 1 ? (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Get Started
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}