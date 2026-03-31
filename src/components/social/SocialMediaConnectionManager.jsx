import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Facebook, Twitter, Instagram, Zap, Trash2, Plus, CheckCircle2, AlertCircle, Gift } from 'lucide-react';

const PLATFORMS = {
  facebook: {
    icon: Facebook,
    label: 'Facebook',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  twitter: {
    icon: Twitter,
    label: 'X (Twitter)',
    color: 'text-black',
    bgColor: 'bg-gray-50'
  },
  instagram: {
    icon: Instagram,
    label: 'Instagram',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50'
  },
  snapchat: {
    icon: Zap,
    label: 'Snapchat',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50'
  },
  tiktok: {
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.24 8.24 0 004.83 1.55V6.78a4.85 4.85 0 01-1.06-.09z" />
      </svg>
    ),
    label: 'TikTok',
    color: 'text-gray-900',
    bgColor: 'bg-gray-50'
  }
};

export default function SocialMediaConnectionManager({ onConnectionsChange }) {
  const queryClient = useQueryClient();
  const [connectingPlatform, setConnectingPlatform] = useState(null);

  const { data: connections = [] } = useQuery({
    queryKey: ['socialMediaConnections'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.SocialMediaConnection.filter({
        user_id: user.id
      });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: (connectionId) => base44.entities.SocialMediaConnection.delete(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialMediaConnections'] });
      onConnectionsChange?.();
    }
  });

  const handleConnect = (platform) => {
    const cb = encodeURIComponent(`${window.location.origin}/social-auth-callback`);
    const oauthUrls = {
      facebook: `https://www.facebook.com/v18.0/dialog/oauth?client_id=FACEBOOK_APP_ID&redirect_uri=${cb}&scope=pages_manage_posts,pages_read_user_profile&response_type=code`,
      twitter: `https://twitter.com/i/oauth2/authorize?client_id=TWITTER_API_KEY&redirect_uri=${cb}&scope=tweet.write%20tweet.read%20users.read&state=twitter&response_type=code`,
      instagram: `https://www.instagram.com/oauth/authorize?client_id=INSTAGRAM_APP_ID&redirect_uri=${cb}&scope=instagram_business_basic,instagram_business_content_publish&response_type=code`,
      snapchat: `https://accounts.snapchat.com/accounts/oauth2/authorize?client_id=SNAPCHAT_CLIENT_ID&redirect_uri=${cb}&scope=snapchat-marketing-api&response_type=code`,
      tiktok: `https://www.tiktok.com/v2/auth/authorize?client_key=TIKTOK_CLIENT_KEY&redirect_uri=${cb}&scope=video.upload,video.publish&response_type=code&state=tiktok`,
    };

    setConnectingPlatform(platform);
    window.location.href = oauthUrls[platform];
  };

  const connectedPlatforms = connections.map(c => c.platform);
  const availablePlatforms = Object.keys(PLATFORMS).filter(
    p => !connectedPlatforms.includes(p)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Manage your social media accounts for auto-posting ads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {connections.length === 0 ? (
              <p className="text-sm text-gray-500">No accounts connected yet</p>
            ) : (
              connections.map(conn => {
                const platform = PLATFORMS[conn.platform];
                const Icon = platform.icon;
                
                return (
                  <div
                    key={conn.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${platform.bgColor}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${platform.color}`} />
                      <div>
                        <p className="font-medium text-sm">{platform.label}</p>
                        <p className="text-xs text-gray-600">{conn.account_name}</p>
                      </div>
                      {conn.is_active && (
                        <CheckCircle2 className="w-4 h-4 text-green-600 ml-2" />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => disconnectMutation.mutate(conn.id)}
                      disabled={disconnectMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {availablePlatforms.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle>Connect New Account</CardTitle>
            <CardDescription>
              Connect additional social media accounts and earn jackpot entries!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <Gift className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-green-900">Earn Jackpot Entries!</p>
                <p className="text-green-700 text-xs mt-1">
                  • Facebook/Twitter: 50 entries each<br/>
                  • Instagram/Snapchat/TikTok: 75 entries each
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {availablePlatforms.map(platform => {
                const config = PLATFORMS[platform];
                const Icon = config.icon;
                const entries = ['instagram', 'snapchat', 'tiktok'].includes(platform) ? 75 : 50;
                
                return (
                  <Button
                    key={platform}
                    onClick={() => handleConnect(platform)}
                    variant="outline"
                    className="flex flex-col items-center gap-1 h-auto py-2"
                    disabled={connectingPlatform === platform}
                  >
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className="text-xs">{config.label}</span>
                    {connectingPlatform !== platform && (
                      <span className="text-xs font-semibold text-green-600">+{entries}</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}