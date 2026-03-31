import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Facebook, Instagram, Twitter, ArrowRight, Zap, Gift, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'from-blue-600 to-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    entries: 50,
    description: 'Share ads with your friends & family',
  },
  {
    id: 'twitter',
    name: 'X / Twitter',
    icon: Twitter,
    color: 'from-gray-800 to-black',
    bg: 'bg-gray-50 border-gray-200',
    entries: 50,
    description: 'Reach your followers with trending ads',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'from-pink-500 to-purple-600',
    bg: 'bg-pink-50 border-pink-200',
    entries: 50,
    description: 'Visual ads to your engaged audience',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.206 1c-.93 0-4.071.272-5.753 3.318-.567 1.02-.464 2.77-.404 3.893l-.02.014c-.186.126-.469.166-.732.166-.26 0-.52-.038-.734-.118a.42.42 0 0 0-.143-.025c-.3 0-.563.224-.563.524 0 .245.16.45.389.512.033.01 1.003.273 1.111 1.498.014.16.016.315.01.469l-.002.026c-.116 2.058-1.497 3.809-3.347 4.6-.188.08-.28.289-.2.48.051.121.168.203.297.203.053 0 .102-.014.149-.038l.006-.003c.207-.106.408-.188.597-.244.68-.2 1.205-.14 1.5.148.222.218.303.553.24.996-.085.59-.433 1.023-.878 1.395-.386.322-.637.697-.637 1.089 0 .613.525.994 1.03.994.116 0 .232-.02.346-.054.524-.16 1.063-.267 1.645-.302.47-.027 1.035.06 1.678.47.52.33 1.04.48 1.554.48.56 0 1.088-.176 1.558-.48.642-.41 1.208-.497 1.679-.47.58.035 1.12.142 1.645.302.114.033.23.054.345.054.506 0 1.03-.381 1.03-.994 0-.392-.25-.767-.636-1.09-.445-.37-.793-.804-.879-1.394-.063-.443.019-.778.24-.996.296-.287.821-.348 1.5-.148.19.056.39.138.598.244l.006.003c.047.024.096.038.149.038.129 0 .246-.082.297-.203a.384.384 0 0 0-.2-.48c-1.85-.791-3.232-2.542-3.347-4.6l-.002-.026a6.46 6.46 0 0 1 .01-.469c.108-1.225 1.077-1.489 1.11-1.498a.527.527 0 0 0 .39-.512.554.554 0 0 0-.563-.524.42.42 0 0 0-.144.025c-.213.08-.473.118-.733.118-.264 0-.547-.04-.733-.166l-.02-.014c.06-1.123.163-2.874-.404-3.893C16.276 1.272 13.136 1 12.206 1z" />
      </svg>
    ),
    color: 'from-yellow-400 to-yellow-500',
    bg: 'bg-yellow-50 border-yellow-200',
    entries: 50,
    description: 'Fun, engaging ad stories to your snaps',
  },
];

export default function SocialMediaSetup() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState([]);
  const [connected, setConnected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [step, setStep] = useState(1); // 1 = select, 2 = connecting, 3 = done
  const [existingConnections, setExistingConnections] = useState([]);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Load existing connections
      base44.entities.SocialMediaConnection.filter({ user_id: u.id })
        .then(conns => {
          const active = conns.filter(c => c.is_active);
          setExistingConnections(active);
          setConnected(active.map(c => c.platform));
        })
        .catch(() => {});
    }).catch(() => navigate('/'));
  }, []);

  const togglePlatform = (id) => {
    if (connected.includes(id)) return; // Already connected
    setSelected(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleConnect = async () => {
    if (selected.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }
    setLoading(true);
    setStep(2);

    const newlyConnected = [];

    for (const platform of selected) {
      try {
        // Simulate OAuth connect - in production redirect to OAuth
        await base44.entities.SocialMediaConnection.create({
          user_id: user.id,
          platform,
          account_id: `${platform}_${user.id}`,
          account_name: `${user.full_name}'s ${platform}`,
          access_token: 'oauth_pending',
          is_active: true,
          auto_posting_enabled: true,
          connected_at: new Date().toISOString(),
          total_posts: 0,
          auto_post_count: 0,
        });
        newlyConnected.push(platform);
      } catch (e) {
        console.error(`Failed to connect ${platform}:`, e);
      }
    }

    setConnected(prev => [...prev, ...newlyConnected]);
    setLoading(false);

    // Trigger AI posts for each connected platform
    if (newlyConnected.length > 0) {
      setPosting(true);
      try {
        await base44.functions.invoke('postAdToSocialMedia', {
          platforms: newlyConnected,
          userId: user.id,
          postsPerPlatform: 2,
        });
      } catch (e) {
        console.error('AI posting error:', e);
      }
      setPosting(false);
    }

    // Award jackpot entries
    const entriesEarned = newlyConnected.length * 50;
    if (entriesEarned > 0) {
      try {
        await base44.auth.updateMe({
          total_jackpot_entries: (user.total_jackpot_entries || 0) + entriesEarned,
          social_media_connected: true,
        });
      } catch (e) {}
    }

    // Clear the signup redirect flag
    sessionStorage.removeItem('needs_social_setup');
    setStep(3);
  };

  const totalEntries = selected.reduce((sum, p) => {
    const plat = PLATFORMS.find(x => x.id === p);
    return sum + (plat?.entries || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Share2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Social Media</h1>
          <p className="text-gray-600">
            Select the platforms you have — AI will automatically post 2 ads per day on each one & you'll earn jackpot entries every time.
          </p>
          <p className="text-xs text-red-500 font-semibold mt-2 uppercase tracking-wide">Required to continue</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Select Platforms */}
          {step === 1 && (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {PLATFORMS.map((platform, i) => {
                  const isConnected = connected.includes(platform.id);
                  const isSelected = selected.includes(platform.id);
                  const Icon = platform.icon;

                  return (
                    <motion.div
                      key={platform.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <Card
                        className={`cursor-pointer border-2 transition-all ${
                          isConnected
                            ? 'border-green-400 bg-green-50 opacity-80'
                            : isSelected
                            ? 'border-purple-500 bg-purple-50 shadow-lg scale-[1.02]'
                            : `${platform.bg} hover:shadow-md hover:scale-[1.01]`
                        }`}
                        onClick={() => togglePlatform(platform.id)}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900">{platform.name}</p>
                              {isConnected && <Badge className="bg-green-600 text-white text-xs">Connected</Badge>}
                            </div>
                            <p className="text-sm text-gray-600 truncate">{platform.description}</p>
                            <p className="text-xs font-semibold text-purple-600 mt-1">+{platform.entries} jackpot entries</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isConnected ? 'border-green-500 bg-green-500' : isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                          }`}>
                            {(isConnected || isSelected) && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Entries Preview */}
              {totalEntries > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-4 text-white text-center mb-6"
                >
                  <Gift className="w-6 h-6 mx-auto mb-1" />
                  <p className="font-bold text-lg">You'll earn {totalEntries} jackpot entries!</p>
                  <p className="text-sm opacity-90">Plus 2 AI-generated posts per platform</p>
                </motion.div>
              )}

              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white h-14 text-lg font-bold"
                disabled={selected.length === 0 && connected.length === 0}
                onClick={selected.length > 0 ? handleConnect : () => navigate(createPageUrl('UserDashboard'))}
              >
                {selected.length > 0 ? `Connect ${selected.length} Platform${selected.length > 1 ? 's' : ''}` : 'Continue to Dashboard'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <p className="text-center text-xs text-gray-500 mt-3">
                Mandatory step — AI will auto-post ads twice daily to grow your earnings
              </p>
            </motion.div>
          )}

          {/* STEP 2: Connecting */}
          {step === 2 && (
            <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12">
              <Loader2 className="w-16 h-16 text-purple-600 animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {loading ? 'Connecting your accounts…' : posting ? 'AI is creating your first 2 posts…' : 'Almost done!'}
              </h2>
              <p className="text-gray-500">
                {posting ? 'Generating platform-optimized content with AI' : 'Setting up auto-posting permissions'}
              </p>
              <div className="flex justify-center gap-2 mt-6">
                {selected.map(p => {
                  const plat = PLATFORMS.find(x => x.id === p);
                  return (
                    <Badge key={p} className={`bg-gradient-to-r ${plat?.color} text-white`}>
                      {plat?.name}
                    </Badge>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 3: Done */}
          {step === 3 && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">You're All Set! 🎉</h2>
              <p className="text-gray-600 mb-2">
                <span className="font-bold text-green-600">{connected.length} platform{connected.length !== 1 ? 's' : ''} connected</span> — AI is posting ads automatically for you twice a day
              </p>
              <p className="text-purple-700 font-semibold mb-8">+{connected.length * 50} jackpot entries added to your account!</p>

              <div className="grid grid-cols-2 gap-4 mb-6 text-left">
                <Card className="p-4 bg-green-50 border-green-200">
                  <Zap className="w-5 h-5 text-green-600 mb-2" />
                  <p className="font-bold text-gray-900 text-sm">AI Auto-Posting Active</p>
                  <p className="text-xs text-gray-600">9am & 5pm ET every day</p>
                </Card>
                <Card className="p-4 bg-purple-50 border-purple-200">
                  <Gift className="w-5 h-5 text-purple-600 mb-2" />
                  <p className="font-bold text-gray-900 text-sm">Earning Per Post</p>
                  <p className="text-xs text-gray-600">$0.20 + jackpot entries</p>
                </Card>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white h-12 font-bold"
                onClick={() => navigate(createPageUrl('UserDashboard'))}
              >
                Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}