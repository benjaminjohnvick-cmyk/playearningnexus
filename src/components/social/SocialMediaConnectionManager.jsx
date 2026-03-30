import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Facebook, Twitter, Instagram, Zap, Trash2, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

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
    const oauthUrls = {
      facebook: `https://www.facebook.com/v18.0/dialog/oauth?client_id=${Deno.env.get('FACEBOOK_APP_ID')}&redirect_uri=${encodeURIComponent(`${window.location.origin}/social-auth-callback`)}&scope=pages_manage_posts,pages_read_user_profile&response_type=code`,
      twitter: `https://twitter.com/i/oauth2/authorize?client_id=${Deno.env.get('TWITTER_API_KEY')}&redirect_uri=${encodeURIComponent(`${window.location.origin}/social-auth-callback`)}&scope=tweet.write%20tweet.read%20users.read&state=twitter&response_type=code`,
      instagram: `https://www.instagram.com/oauth/authorize?client_id=${Deno.env.get('INSTAGRAM_APP_ID')}&redirect_uri=${encodeURIComponent(`${window.location.origin}/social-auth-callback`)}&scope=instagram_business_basic,instagram_business_content_publish&response_type=code`,
      snapchat: `https://accounts.snapchat.com/accounts/oauth2/authorize?client_id=${Deno.env.get('SNAPCHAT_CLIENT_ID')}&redirect_uri=${encodeURIComponent(`${window.location.origin}/social-auth-callback`)}&scope=snapchat-marketing-api&response_type=code`
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
        <Card>
          <CardHeader>
            <CardTitle>Connect New Account</CardTitle>
            <CardDescription>
              Connect additional social media accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {availablePlatforms.map(platform => {
                const config = PLATFORMS[platform];
                const Icon = config.icon;
                
                return (
                  <Button
                    key={platform}
                    onClick={() => handleConnect(platform)}
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={connectingPlatform === platform}
                  >
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    {connectingPlatform === platform ? 'Connecting...' : `Connect ${config.label}`}
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