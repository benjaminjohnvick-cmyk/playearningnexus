import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Gamepad2, 
  Users, 
  ArrowRight, 
  ArrowLeft,
  X,
  Check,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from '@/api/base44Client';

const tutorialSteps = [
  {
    id: 'welcome',
    title: 'Welcome to GamerGain! 🎮',
    description: 'Your all-in-one platform for discovering games, earning money, and building your gaming community.',
    icon: Sparkles,
    color: 'purple',
    content: (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-xl">
          <h3 className="text-xl font-bold text-gray-900 mb-3">What You'll Learn:</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span>Complete surveys to earn money</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span>Discover and play amazing games</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span>Earn rewards through referrals</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'surveys',
    title: 'Complete Surveys to Earn',
    description: 'Earn $2+ daily by completing quick surveys. This unlocks game access!',
    icon: FileText,
    color: 'blue',
    content: (
      <div className="space-y-4">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-2">How It Works:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Navigate to the Surveys page from the menu</li>
                <li>Complete available surveys</li>
                <li>Earn at least $2 daily to unlock games</li>
                <li>Get paid 50/50 revenue share</li>
              </ol>
            </div>
          </div>
        </Card>
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Pro Tip:</strong> Complete your $2 daily goal early to maximize your gaming time!
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'games',
    title: 'Discover & Play Games',
    description: 'Access featured games after completing your daily surveys.',
    icon: Gamepad2,
    color: 'green',
    content: (
      <div className="space-y-4">
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-500 rounded-lg">
              <Gamepad2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-2">Gaming Features:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Featured games rotate weekly
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Build your game library
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Earn XP and unlock achievements
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Join tournaments and compete
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    )
  },
  {
    id: 'referrals',
    title: 'Earn Through Referrals',
    description: 'Refer friends and businesses to earn extra rewards and bonuses.',
    icon: Users,
    color: 'amber',
    content: (
      <div className="space-y-4">
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-2">Referral Program:</h4>
              <div className="space-y-3">
                <div>
                  <Badge className="bg-blue-100 text-blue-700 mb-2">User Referrals</Badge>
                  <p className="text-sm text-gray-700">Earn $0.25-$0.50 per user + tiered bonuses</p>
                </div>
                <div>
                  <Badge className="bg-purple-100 text-purple-700 mb-2">Business Referrals</Badge>
                  <p className="text-sm text-gray-700">Earn $0.50-$1.00 per business + bigger bonuses</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-purple-800">
            <strong>Daily Contest:</strong> Participate in the referral contest to win extra prizes!
          </p>
        </div>
      </div>
    )
  }
];

export default function InteractiveTutorial({ isOpen, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const step = tutorialSteps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    await base44.auth.updateMe({
      onboarding_completed: true
    });
    onComplete();
  };

  const handleSkip = async () => {
    await base44.auth.updateMe({
      onboarding_completed: true
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className={`p-2 bg-${step.color}-100 rounded-lg`}>
                <Icon className={`w-6 h-6 text-${step.color}-600`} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{step.title}</h2>
                <p className="text-sm text-gray-600 font-normal">{step.description}</p>
              </div>
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleSkip}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Step {currentStep + 1} of {tutorialSteps.length}</span>
            <span className="text-gray-600">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="py-4"
          >
            {step.content}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <DialogFooter className="flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrevious}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleSkip}>
              Skip Tutorial
            </Button>
            <Button onClick={handleNext} className="bg-gradient-to-r from-blue-600 to-purple-600">
              {currentStep < tutorialSteps.length - 1 ? (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Get Started
                  <Check className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}