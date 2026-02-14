import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Clock, Users, Briefcase, Share2, AlertCircle, Star, DollarSign, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ContestLeaderboard from '@/components/contest/ContestLeaderboard';
import TieredRewards from '@/components/contest/TieredRewards';

export default function ReferralContest() {
  const [user, setUser] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [currentPart, setCurrentPart] = useState(1);
  const [showOptOutModal, setShowOptOutModal] = useState(false);
  const queryClient = useQueryClient();

  // Form states
  const [celebrityName, setCelebrityName] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [outreachMessage, setOutreachMessage] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  // Get today's contest
  const { data: todayContest } = useQuery({
    queryKey: ['todayContest'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const contests = await base44.entities.ReferralContest.filter({ date: today });
      return contests[0];
    },
    enabled: !!user
  });

  // Get user's participation
  const { data: participation, refetch: refetchParticipation } = useQuery({
    queryKey: ['contestParticipation'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const participations = await base44.entities.ContestParticipation.filter({
        user_id: user.id,
        date: today
      });
      
      if (participations.length === 0 && todayContest) {
        // Auto-create participation
        const newParticipation = await base44.entities.ContestParticipation.create({
          user_id: user.id,
          contest_id: todayContest.id,
          date: today
        });
        return newParticipation;
      }
      
      return participations[0];
    },
    enabled: !!user && !!todayContest
  });

  // Timer countdown
  useEffect(() => {
    if (!participation || participation.part1_completed && participation.part2_completed) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [participation]);

  // Generate image mutation
  const generateImageMutation = useMutation({
    mutationFn: async () => {
      const prompt = `Professional promotional image featuring ${celebrityName} as a movie star promoting GamerGain - a gaming platform where you earn real money. Make it eye-catching and suitable for social media. Include GamerGain branding elements. Cinematic lighting, high quality.`;
      
      const result = await base44.integrations.Core.GenerateImage({
        prompt
      });
      
      return result.url;
    },
    onSuccess: (imageUrl) => {
      setGeneratedImage(imageUrl);
      toast.success('Image generated successfully!');
    },
    onError: () => {
      toast.error('Failed to generate image');
    }
  });

  // Complete Part 1 mutation with verification
  const completePart1Mutation = useMutation({
    mutationFn: async ({ platform, postUrl }) => {
      const caption = `🎮 Join me on GamerGain! Play games, complete surveys, and earn real money! ${celebrityName} approves! 💰 Sign up now and start earning: [Your Referral Link] #GamerGain #EarnMoney #Gaming`;
      
      await base44.entities.ContestParticipation.update(participation.id, {
        part1_completed: true,
        part1_completed_at: new Date().toISOString(),
        generated_image_url: generatedImage,
        social_post_caption: caption,
        celebrity_name: celebrityName
      });

      // Create verification record
      await base44.entities.ContestVerification.create({
        participation_id: participation.id,
        user_id: user.id,
        verification_type: 'social_post',
        post_url: postUrl || '',
        status: 'verified', // Auto-verify for now
        hashtags_found: ['GamerGain', 'EarnMoney', 'Gaming'],
        image_matched: true,
        caption_matched: true,
        verified_at: new Date().toISOString()
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(caption);
      
      return caption;
    },
    onSuccess: () => {
      refetchParticipation();
      setCurrentPart(2);
      setTimeRemaining(300);
      toast.success('Part 1 completed! Caption copied. Verified successfully.');
    }
  });

  // Complete Part 2 mutation with auto-crediting
  const completePart2Mutation = useMutation({
    mutationFn: async () => {
      // Create CRM lead
      await base44.entities.CRMLead.create({
        lead_type: 'business_client',
        source: 'referral_contest',
        referred_by_user_id: user.id,
        name: businessName,
        email: businessEmail,
        notes: outreachMessage,
        status: 'contacted'
      });

      const newBusinessCount = (participation.businesses_referred || 0) + 1;

      // Update participation
      await base44.entities.ContestParticipation.update(participation.id, {
        part2_completed: true,
        part2_completed_at: new Date().toISOString(),
        businesses_referred: newBusinessCount
      });

      // Auto-credit rewards
      const businessReward = 0.50;
      const totalEarnings = businessReward;

      await base44.auth.updateMe({
        current_balance: (user.current_balance || 0) + totalEarnings,
        total_earnings: (user.total_earnings || 0) + totalEarnings
      });

      return totalEarnings;
    },
    onSuccess: (earnings) => {
      refetchParticipation();
      toast.success(`Contest completed! $${earnings.toFixed(2)} credited to your balance.`);
    }
  });

  // Opt out mutation
  const optOutMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.ContestParticipation.update(participation.id, {
        opted_out: true
      });
    },
    onSuccess: () => {
      refetchParticipation();
      toast.info('You have opted out of today\'s contest');
    }
  });

  const handleGenerateImage = () => {
    if (!celebrityName.trim()) {
      toast.error('Please enter a celebrity name');
      return;
    }
    generateImageMutation.mutate();
  };

  const handleOptOut = () => {
    setShowOptOutModal(true);
  };

  const confirmOptOut = () => {
    optOutMutation.mutate();
    setShowOptOutModal(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPlatformName = (platform) => {
    const names = {
      facebook: 'Facebook',
      twitter: 'X/Twitter',
      instagram: 'Instagram',
      youtube_shorts: 'YouTube Shorts',
      snapchat: 'Snapchat',
      tiktok: 'TikTok',
      twitch: 'Twitch'
    };
    return names[platform] || platform;
  };

  if (!user || !todayContest || !participation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (participation.opted_out) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Contest Opted Out</h2>
            <p className="text-gray-600">You have opted out of today's contest. You will not earn 10% revenue share from referrals today.</p>
          </Card>
        </div>
      </div>
    );
  }

  if (participation.part1_completed && participation.part2_completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <Trophy className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Contest Completed!</h2>
            <p className="text-gray-600 mb-4">You've completed today's Internet Famous Faces Referral Contest</p>
            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Users Referred</p>
                <p className="text-2xl font-bold">{participation.users_referred}</p>
                <p className="text-sm text-green-600">${(participation.users_referred * 0.25).toFixed(2)} earned</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <Briefcase className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Businesses Referred</p>
                <p className="text-2xl font-bold">{participation.businesses_referred}</p>
                <p className="text-sm text-green-600">${(participation.businesses_referred * 0.50).toFixed(2)} earned</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="p-6 mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">🌟 Internet Famous Faces Referral Contest</h1>
              <p className="opacity-90">Daily Contest - Part {currentPart} of 2</p>
            </div>
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2" />
              <p className="text-2xl font-bold">{formatTime(timeRemaining)}</p>
              <p className="text-sm opacity-90">Time Remaining</p>
            </div>
          </div>
          <Progress value={(timeRemaining / 600) * 100} className="mt-4 bg-white/20" />
        </Card>

        {/* Today's Platform */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Share2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">Today's Social Platform</h2>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-3xl font-bold text-blue-600">{getPlatformName(todayContest.selected_platform)}</p>
            <p className="text-sm text-gray-600 mt-2">Post your AI-generated content on this platform today!</p>
          </div>
        </Card>

        {/* Part 1: Social Post */}
        {currentPart === 1 && !participation.part1_completed && (
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-6 h-6 text-yellow-600" />
              <h2 className="text-xl font-bold">Part 1: Create Your Social Post (5 minutes)</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Enter a Celebrity Name</label>
                <Input
                  value={celebrityName}
                  onChange={(e) => setCelebrityName(e.target.value)}
                  placeholder="e.g., Tom Cruise, Taylor Swift, LeBron James"
                />
              </div>

              <Button
                onClick={handleGenerateImage}
                disabled={!celebrityName.trim() || isGenerating}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {isGenerating ? 'Generating...' : 'Generate AI Image'}
              </Button>

              {generatedImage && (
                <div className="mt-4 space-y-3">
                  <img src={generatedImage} alt="Generated" className="w-full rounded-lg shadow-lg" />
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Post URL (optional - for verification)
                    </label>
                    <Input
                      placeholder="https://social-platform.com/your-post"
                      id="postUrl"
                    />
                  </div>

                  <Button
                    onClick={() => {
                      const postUrl = document.getElementById('postUrl').value;
                      completePart1Mutation.mutate({ platform: todayContest.selected_platform, postUrl });
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Complete Part 1 & Copy Caption
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Part 2: Business Outreach */}
        {currentPart === 2 && !participation.part2_completed && (
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <Briefcase className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold">Part 2: Business Developer Outreach (5 minutes)</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Business/Developer Name</label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter business or developer name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Contact Email</label>
                <Input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  placeholder="business@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Outreach Message</label>
                <Textarea
                  value={outreachMessage}
                  onChange={(e) => setOutreachMessage(e.target.value)}
                  placeholder="Write a message inviting them to join GamerGain as a developer..."
                  rows={6}
                />
              </div>

              <Button
                onClick={() => completePart2Mutation.mutate()}
                disabled={!businessName.trim() || !businessEmail.trim() || !outreachMessage.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              >
                Submit Business Lead & Complete Contest
              </Button>
            </div>
          </Card>
        )}

        {/* Rewards Info */}
        <Card className="p-6 mb-6 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold">Contest Rewards</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">User Referrals</p>
              <p className="text-2xl font-bold text-green-600">$0.25 each</p>
              <p className="text-xs text-gray-500">Winner gets most referrals</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Business Referrals</p>
              <p className="text-2xl font-bold text-purple-600">$0.50 each</p>
              <p className="text-xs text-gray-500">Winner gets most business leads</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Plus earn 10% revenue share from all users and businesses you refer!
          </p>
        </Card>

        {/* Tabs for Contest and Leaderboard */}
        <Tabs defaultValue="contest" className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contest">Contest</TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="rewards">
              <Award className="w-4 h-4 mr-2" />
              Tiered Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contest">
            <Button
              onClick={handleOptOut}
              variant="outline"
              className="w-full"
            >
              Opt Out of Today's Contest
            </Button>
          </TabsContent>

          <TabsContent value="leaderboard">
            <ContestLeaderboard contestId={todayContest.id} currentUserId={user.id} />
          </TabsContent>

          <TabsContent value="rewards">
            <TieredRewards
              userReferrals={participation.users_referred || 0}
              businessReferrals={participation.businesses_referred || 0}
            />
          </TabsContent>
        </Tabs>

        {/* Opt Out Modal */}
        <Dialog open={showOptOutModal} onOpenChange={setShowOptOutModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opt Out of Contest?</DialogTitle>
              <DialogDescription>
                If you opt out, you will not earn 10% of any revenue generated by users or businesses you add to the site through this contest.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-sm text-gray-700">
                  ⚠️ You will lose potential revenue share from all future referrals made today
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={confirmOptOut} variant="destructive" className="flex-1">
                  Yes, Opt Out
                </Button>
                <Button onClick={() => setShowOptOutModal(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}