import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Home, DollarSign, TrendingUp, Trophy, Users, Star, 
  Gamepad2, Gift, MessageCircle, Settings, CheckCircle2, ArrowRight
} from 'lucide-react';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to GamerGain! 🎮',
    icon: Home,
    description: 'Your all-in-one platform for gaming, earning, and connecting!',
    content: `GamerGain combines:
• 🎮 Access to thousands of games
• 💰 Multiple ways to earn money
• 🤝 Vibrant gaming community
• 🏆 Competitive tournaments

Let's take a quick tour!`
  },
  {
    id: 'earning',
    title: 'Earning Opportunities',
    icon: DollarSign,
    description: 'Multiple ways to make money on GamerGain',
    content: `How you earn:
• 📋 Complete surveys ($1-$10 each)
• 🎯 Refer users ($5-$50 per referral)
• 🏢 Refer businesses ($100-$500)
• 💎 Mega Millionaire: 10% of 7M user profits
• 🎮 Win tournaments with real prizes
• ⭐ Creator monetization (tips, subscriptions)`
  },
  {
    id: 'referrals',
    title: 'Referral System',
    icon: Users,
    description: 'Build your network and earn passive income',
    content: `Referral Features:
• 🔗 Custom referral links
• 📊 Advanced analytics & A/B testing
• 🤖 AI campaign generator
• 🎯 Multi-tier rewards ($5-$500)
• 📈 Predictive earnings forecasts
• 🏆 Achievements & leaderboards`
  },
  {
    id: 'games',
    title: 'Game Library',
    icon: Gamepad2,
    description: 'Discover and play amazing games',
    content: `Game Features:
• 🎮 Browse thousands of games
• 💾 Free 2-minute trials
• ⭐ Reviews and ratings
• 🎯 Personalized recommendations
• 📱 Cloud saves across devices
• 🏪 In-game purchases available`
  },
  {
    id: 'tournaments',
    title: 'Tournaments & Competitions',
    icon: Trophy,
    description: 'Compete and win real prizes',
    content: `Tournament Features:
• 🏆 Single & double elimination
• 💰 Cash prizes & virtual currency
• 🎮 Cross-game tournaments
• 🤖 AI matchmaking
• 📊 Live brackets & spectating
• 🎯 Daily & weekly events`
  },
  {
    id: 'community',
    title: 'Social Features',
    icon: MessageCircle,
    description: 'Connect with gamers worldwide',
    content: `Community Tools:
• 👥 Guilds & group chat
• 💬 Direct messaging
• 🎁 Send virtual gifts
• 📱 Social feed & activity
• 🎮 Friend system
• 📺 Watch live streams`
  },
  {
    id: 'gamification',
    title: 'Rewards & Achievements',
    icon: Star,
    description: 'Unlock badges and climb leaderboards',
    content: `Gamification:
• 🏅 Achievement system
• 🔥 Daily streaks
• 🎯 Daily challenges
• 📊 Global leaderboards
• ⭐ Points & levels
• 🎁 Unlock exclusive rewards`
  },
  {
    id: 'creators',
    title: 'Creator Marketplace',
    icon: Users,
    description: 'Support and sponsor content creators',
    content: `Creator Features:
• ⭐ Subscribe to favorite creators
• 💰 Tip streamers
• 🤝 Sponsorship opportunities
• 📺 Exclusive content access
• 🎮 Co-op gaming sessions
• 📊 Creator analytics`
  },
  {
    id: 'settings',
    title: 'Customization',
    icon: Settings,
    description: 'Personalize your experience',
    content: `Settings & Options:
• 💳 Payout preferences (Weekly, Monthly, Net 90)
• 🌍 Multiple payout methods (PayPal, Bank, Crypto)
• 🔔 Notification preferences
• 🎨 Profile customization
• 🔒 Privacy controls
• 📊 Data & analytics`
  }
];

export default function InteractiveTutorial({ isOpen, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = TUTORIAL_STEPS[currentStep];
  const StepIcon = step.icon;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep === TUTORIAL_STEPS.length - 1) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onComplete()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline">
              Step {currentStep + 1} of {TUTORIAL_STEPS.length}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip Tutorial
            </Button>
          </div>
          <Progress value={progress} className="mb-4" />
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
              <StepIcon className="w-6 h-6 text-white" />
            </div>
            {step.title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <p className="text-gray-600 mb-4">{step.description}</p>
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border-2 border-blue-200">
            <pre className="whitespace-pre-wrap text-sm font-sans">{step.content}</pre>
          </div>
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
            className="bg-gradient-to-r from-blue-600 to-purple-600"
          >
            {currentStep === TUTORIAL_STEPS.length - 1 ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Get Started!
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