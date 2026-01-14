import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  Target, 
  Trophy, 
  ArrowRight, 
  CheckCircle2,
  Zap,
  Heart,
  Brain,
  Gamepad2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function AIOnboardingFlow({ user, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [userProfile, setUserProfile] = useState({
    skill_level: null,
    preferred_categories: [],
    gaming_frequency: null,
    challenge_preference: null
  });
  const [aiTip, setAiTip] = useState('');
  const queryClient = useQueryClient();

  // AI generates personalized tips based on user selections
  const generateAITip = async (profile) => {
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on this gaming profile: ${JSON.stringify(profile)}, generate a short, encouraging personalized tip (max 2 sentences) for a new player.`,
        response_json_schema: {
          type: "object",
          properties: {
            tip: { type: "string" }
          }
        }
      });
      setAiTip(result.tip || '');
    } catch (error) {
      console.error('AI tip generation failed:', error);
    }
  };

  const createPersonalizedChallengeMutation = useMutation({
    mutationFn: async (profile) => {
      // AI creates a personalized challenge based on user profile
      const challenge = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a personalized daily challenge for a ${profile.skill_level} level gamer who likes ${profile.preferred_categories.join(', ')} games. Return a challenge title, description, and reward amount between 5-15.`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            reward_amount: { type: "number" }
          }
        }
      });

      return base44.entities.DailyChallenge.create({
        user_id: user.id,
        challenge_type: 'custom',
        title: challenge.title,
        description: challenge.description,
        reward_amount: challenge.reward_amount,
        is_active: true,
        difficulty: profile.skill_level
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyChallenges'] });
    }
  });

  const steps = [
    {
      title: 'Welcome to GameRewards!',
      icon: Sparkles,
      content: (
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <Gamepad2 className="w-20 h-20 mx-auto text-red-600 mb-4" />
          </motion.div>
          <h3 className="text-2xl font-bold">Let's personalize your experience!</h3>
          <p className="text-gray-600">
            Our AI will help you discover games you'll love and create challenges tailored to your style.
          </p>
          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
            <Brain className="w-3 h-3 mr-1" />
            AI-Powered Personalization
          </Badge>
        </div>
      )
    },
    {
      title: 'What\'s your gaming experience?',
      icon: Target,
      content: (
        <div className="space-y-4">
          <p className="text-center text-gray-600 mb-6">Help our AI understand your skill level</p>
          <div className="grid grid-cols-3 gap-4">
            {['beginner', 'intermediate', 'expert'].map((level) => (
              <motion.div key={level} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Card
                  className={`cursor-pointer transition-all ${
                    userProfile.skill_level === level
                      ? 'border-2 border-red-600 bg-red-50'
                      : 'hover:border-gray-400'
                  }`}
                  onClick={() => {
                    setUserProfile({ ...userProfile, skill_level: level });
                    generateAITip({ ...userProfile, skill_level: level });
                  }}
                >
                  <CardContent className="p-6 text-center">
                    <p className="font-bold capitalize">{level}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {level === 'beginner' && 'New to gaming'}
                      {level === 'intermediate' && 'Some experience'}
                      {level === 'expert' && 'Pro gamer'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          {aiTip && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200"
            >
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                <p className="text-sm text-purple-900">{aiTip}</p>
              </div>
            </motion.div>
          )}
        </div>
      )
    },
    {
      title: 'What types of games do you enjoy?',
      icon: Heart,
      content: (
        <div className="space-y-4">
          <p className="text-center text-gray-600 mb-6">Select all that apply</p>
          <div className="grid grid-cols-3 gap-3">
            {['puzzle', 'action', 'strategy', 'casual', 'rpg', 'simulation'].map((category) => (
              <motion.div key={category} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Card
                  className={`cursor-pointer transition-all ${
                    userProfile.preferred_categories.includes(category)
                      ? 'border-2 border-red-600 bg-red-50'
                      : 'hover:border-gray-400'
                  }`}
                  onClick={() => {
                    const categories = userProfile.preferred_categories.includes(category)
                      ? userProfile.preferred_categories.filter(c => c !== category)
                      : [...userProfile.preferred_categories, category];
                    const newProfile = { ...userProfile, preferred_categories: categories };
                    setUserProfile(newProfile);
                    if (categories.length > 0) generateAITip(newProfile);
                  }}
                >
                  <CardContent className="p-4 text-center">
                    <p className="font-medium capitalize text-sm">{category}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'Challenge yourself!',
      icon: Zap,
      content: (
        <div className="space-y-4">
          <p className="text-center text-gray-600 mb-6">How challenging do you like your games?</p>
          <div className="grid grid-cols-3 gap-4">
            {['relaxed', 'balanced', 'hardcore'].map((pref) => (
              <motion.div key={pref} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Card
                  className={`cursor-pointer transition-all ${
                    userProfile.challenge_preference === pref
                      ? 'border-2 border-red-600 bg-red-50'
                      : 'hover:border-gray-400'
                  }`}
                  onClick={() => {
                    const newProfile = { ...userProfile, challenge_preference: pref };
                    setUserProfile(newProfile);
                    generateAITip(newProfile);
                  }}
                >
                  <CardContent className="p-6 text-center">
                    <p className="font-bold capitalize">{pref}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {pref === 'relaxed' && 'Easy going'}
                      {pref === 'balanced' && 'Mix of both'}
                      {pref === 'hardcore' && 'Maximum difficulty'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'You\'re all set!',
      icon: Trophy,
      content: (
        <div className="text-center space-y-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
          >
            <CheckCircle2 className="w-20 h-20 mx-auto text-green-600 mb-4" />
          </motion.div>
          <h3 className="text-2xl font-bold">Profile Complete!</h3>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
            <Brain className="w-8 h-8 mx-auto text-purple-600 mb-3" />
            <p className="font-bold mb-2">AI Personalization Active</p>
            <p className="text-sm text-gray-600">
              We're creating your first personalized challenge and finding games perfect for you!
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-white rounded-lg border">
              <p className="font-bold">Skill Level</p>
              <p className="text-gray-600 capitalize">{userProfile.skill_level}</p>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <p className="font-bold">Categories</p>
              <p className="text-gray-600">{userProfile.preferred_categories.length} selected</p>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <p className="font-bold">Challenge</p>
              <p className="text-gray-600 capitalize">{userProfile.challenge_preference}</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - save profile and create personalized challenge
      await base44.auth.updateMe({
        onboarding_completed: true,
        skill_level: userProfile.skill_level,
        preferred_categories: userProfile.preferred_categories,
        challenge_preference: userProfile.challenge_preference
      });
      
      // AI creates first personalized challenge
      await createPersonalizedChallengeMutation.mutateAsync(userProfile);
      
      toast.success('Welcome aboard! Your personalized experience awaits!');
      onComplete?.();
    }
  };

  const canProceed = () => {
    if (currentStep === 0) return true;
    if (currentStep === 1) return userProfile.skill_level !== null;
    if (currentStep === 2) return userProfile.preferred_categories.length > 0;
    if (currentStep === 3) return userProfile.challenge_preference !== null;
    return true;
  };

  const StepIcon = steps[currentStep].icon;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-2 border-red-200">
          <CardHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-red-600 to-red-700 rounded-xl">
                <StepIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl">{steps[currentStep].title}</CardTitle>
                <p className="text-sm text-gray-500">Step {currentStep + 1} of {steps.length}</p>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </CardHeader>
          
          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {steps[currentStep].content}
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-end">
              <Button
                onClick={handleNext}
                disabled={!canProceed() || createPersonalizedChallengeMutation.isPending}
                className="bg-gradient-to-r from-red-600 to-red-700"
                size="lg"
              >
                {currentStep === steps.length - 1 ? (
                  createPersonalizedChallengeMutation.isPending ? (
                    'Setting up your experience...'
                  ) : (
                    <>
                      Start Playing
                      <Trophy className="w-4 h-4 ml-2" />
                    </>
                  )
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}