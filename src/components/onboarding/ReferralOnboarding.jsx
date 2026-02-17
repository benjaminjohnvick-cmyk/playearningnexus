import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  DollarSign, 
  Trophy, 
  Target, 
  CheckCircle2,
  ArrowRight,
  Play
} from 'lucide-react';
import { toast } from 'sonner';

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to GamerGain Referrals',
    description: 'Earn money by referring users and businesses to our platform',
    icon: Sparkles,
    content: `
      <div class="space-y-4">
        <p class="text-lg">You can earn money through:</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <span class="text-green-600">✓</span>
            <span><strong>User Referrals:</strong> $5-$50 per active user</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-green-600">✓</span>
            <span><strong>Business Referrals:</strong> $100-$500 per business</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-green-600">✓</span>
            <span><strong>Lifetime Value:</strong> Ongoing commissions from activity</span>
          </li>
        </ul>
        <div class="bg-gradient-to-r from-yellow-50 to-pink-50 border-2 border-yellow-300 rounded-lg p-4 mt-4">
          <p class="font-bold text-purple-800">💎 MEGA MILLIONAIRE OPPORTUNITY</p>
          <p class="text-sm">For every 7 million users, earn 10% of all their profits!</p>
        </div>
      </div>
    `
  },
  {
    id: 'gamification',
    title: 'Gamification & Achievements',
    description: 'Unlock badges, climb leaderboards, and earn bonus rewards',
    icon: Trophy,
    content: `
      <div class="space-y-4">
        <p>Earn achievements as you refer:</p>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
            <p class="font-semibold text-blue-800">First Steps</p>
            <p class="text-xs text-gray-600">First referral - 10 points</p>
          </div>
          <div class="bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
            <p class="font-semibold text-purple-800">Rising Star</p>
            <p class="text-xs text-gray-600">10 referrals - 50 points</p>
          </div>
          <div class="bg-green-50 border-2 border-green-200 rounded-lg p-3">
            <p class="font-semibold text-green-800">Legend</p>
            <p class="text-xs text-gray-600">100 referrals - 500 points</p>
          </div>
          <div class="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
            <p class="font-semibold text-yellow-800">Top Earner</p>
            <p class="text-xs text-gray-600">Monthly champion - 100 points</p>
          </div>
        </div>
        <p class="text-sm text-gray-600 mt-4">
          Compete on leaderboards and get featured as a top referrer!
        </p>
      </div>
    `
  },
  {
    id: 'payout',
    title: 'Set Up Payouts',
    description: 'Configure how you want to receive your earnings',
    icon: DollarSign,
    content: `
      <div class="space-y-4">
        <p>Choose your preferred payout method:</p>
        <div class="space-y-3">
          <div class="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <p class="font-semibold text-blue-800">💳 PayPal</p>
            <p class="text-sm text-gray-600">Fast and easy payouts</p>
          </div>
          <div class="border-2 border-green-200 rounded-lg p-4 bg-green-50">
            <p class="font-semibold text-green-800">🏦 Bank Transfer</p>
            <p class="text-sm text-gray-600">Direct to your account</p>
          </div>
          <div class="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
            <p class="font-semibold text-purple-800">⚡ Stripe</p>
            <p class="text-sm text-gray-600">Fast processing</p>
          </div>
        </div>
        <div class="bg-amber-50 border border-amber-300 rounded-lg p-3 mt-4">
          <p class="text-sm"><strong>Net 90 Payment Terms:</strong> Payments processed 90 days after earnings</p>
          <p class="text-sm text-gray-600">Minimum payout: $50</p>
        </div>
      </div>
    `
  },
  {
    id: 'campaign',
    title: 'Create Your First Campaign',
    description: 'Use AI to generate referral content and strategies',
    icon: Target,
    content: `
      <div class="space-y-4">
        <p>Our AI will help you:</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <span class="text-purple-600">✓</span>
            <span>Generate campaign ideas based on trends</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-purple-600">✓</span>
            <span>Create social media posts with hashtags</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-purple-600">✓</span>
            <span>Identify target audiences</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-purple-600">✓</span>
            <span>Optimize posting schedules</span>
          </li>
        </ul>
        <div class="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4 mt-4">
          <p class="font-bold text-purple-800">🤖 AI-Powered Success</p>
          <p class="text-sm">Let AI handle the strategy while you focus on sharing!</p>
        </div>
      </div>
    `
  }
];

export default function ReferralOnboarding({ user, isOpen, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const queryClient = useQueryClient();

  const { data: progress } = useQuery({
    queryKey: ['onboarding-progress', user.id],
    queryFn: async () => {
      const progs = await base44.entities.OnboardingProgress.filter({ user_id: user.id });
      return progs[0];
    }
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (stepId) => {
      if (progress) {
        const completed = [...(progress.completed_steps || []), stepId];
        return await base44.entities.OnboardingProgress.update(progress.id, {
          current_step: currentStep + 1,
          completed_steps: completed,
          is_completed: currentStep === ONBOARDING_STEPS.length - 1
        });
      } else {
        return await base44.entities.OnboardingProgress.create({
          user_id: user.id,
          current_step: currentStep + 1,
          completed_steps: [stepId],
          is_completed: currentStep === ONBOARDING_STEPS.length - 1
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['onboarding-progress']);
    }
  });

  const handleNext = () => {
    const step = ONBOARDING_STEPS[currentStep];
    updateProgressMutation.mutate(step.id);

    if (currentStep === ONBOARDING_STEPS.length - 1) {
      toast.success('🎉 Onboarding completed! Ready to start earning!');
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    toast.info('You can access tutorials anytime from Settings');
    onComplete();
  };

  const step = ONBOARDING_STEPS[currentStep];
  const StepIcon = step.icon;
  const progressPercentage = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onComplete}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline">
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip Tutorial
            </Button>
          </div>
          <Progress value={progressPercentage} className="mb-4" />
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <StepIcon className="w-6 h-6 text-white" />
            </div>
            {step.title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <p className="text-gray-600 mb-6">{step.description}</p>
          <div 
            className="prose max-w-none" 
            dangerouslySetInnerHTML={{ __html: step.content }}
          />
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          <Button 
            onClick={handleNext}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            {currentStep === ONBOARDING_STEPS.length - 1 ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}