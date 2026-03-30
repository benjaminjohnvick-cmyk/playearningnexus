import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Facebook, Twitter, Instagram, Zap, Share2, Loader2 } from 'lucide-react';

const PLATFORMS = {
  facebook: { icon: Facebook, label: 'Facebook', color: 'text-blue-600' },
  twitter: { icon: Twitter, label: 'X (Twitter)', color: 'text-black' },
  instagram: { icon: Instagram, label: 'Instagram', color: 'text-pink-600' },
  snapchat: { icon: Zap, label: 'Snapchat', color: 'text-yellow-600' }
};

export default function SocialPostingWidget({ adId, adContent, adImageUrl }) {
  const queryClient = useQueryClient();
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);

  const { data: connections = [] } = useQuery({
    queryKey: ['socialMediaConnections'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.SocialMediaConnection.filter({
        user_id: user.id,
        is_active: true
      });
    }
  });

  const postMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('postAdToSocialMedia', {
        adId,
        content: adContent,
        imageUrl: adImageUrl,
        selectedPlatforms
      }),
    onSuccess: () => {
      setSelectedPlatforms([]);
      queryClient.invalidateQueries({ queryKey: ['socialMediaConnections'] });
    }
  });

  if (connections.length === 0) return null;

  const handleToggle = (platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Share2 className="w-4 h-4 text-green-600" />
          Auto-Post to Social Media
        </CardTitle>
        <CardDescription>Share this ad to your connected accounts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {connections.map(conn => {
            const config = PLATFORMS[conn.platform];
            const Icon = config.icon;
            
            return (
              <div key={conn.id} className="flex items-center gap-2">
                <Checkbox
                  id={conn.id}
                  checked={selectedPlatforms.includes(conn.platform)}
                  onCheckedChange={() => handleToggle(conn.platform)}
                  disabled={postMutation.isPending}
                />
                <label
                  htmlFor={conn.id}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span>{config.label}</span>
                  <span className="text-xs text-gray-500">({conn.account_name})</span>
                </label>
              </div>
            );
          })}
        </div>

        <Button
          onClick={() => postMutation.mutate()}
          disabled={selectedPlatforms.length === 0 || postMutation.isPending}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {postMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 mr-2" />
              Post to Selected
            </>
          )}
        </Button>

        {postMutation.isSuccess && (
          <div className="text-xs text-green-700 bg-green-100 p-2 rounded">
            Successfully posted to {selectedPlatforms.length} platform(s)!
          </div>
        )}

        {postMutation.isError && (
          <div className="text-xs text-red-700 bg-red-100 p-2 rounded">
            Error posting: {postMutation.error?.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}