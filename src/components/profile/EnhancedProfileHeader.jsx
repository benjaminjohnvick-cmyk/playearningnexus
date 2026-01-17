import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Crown, Flame, Star, Edit3, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const THEME_COLORS = {
  blue: 'from-blue-600 to-purple-600',
  red: 'from-red-600 to-pink-600',
  green: 'from-green-600 to-emerald-600',
  purple: 'from-purple-600 to-indigo-600',
  orange: 'from-orange-600 to-red-600'
};

export default function EnhancedProfileHeader({ 
  user, 
  profileUser, 
  isOwnProfile, 
  stats,
  topBadges = []
}) {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customization, setCustomization] = useState({
    theme_color: profileUser?.profile_theme || 'blue',
    banner_url: profileUser?.banner_url || '',
    custom_title: profileUser?.custom_title || ''
  });

  const handleSaveCustomization = async () => {
    await base44.auth.updateMe({
      profile_theme: customization.theme_color,
      banner_url: customization.banner_url,
      custom_title: customization.custom_title
    });
    toast.success('Profile updated!');
    setIsCustomizing(false);
    window.location.reload();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={`mb-6 bg-gradient-to-r ${THEME_COLORS[customization.theme_color]} text-white overflow-hidden`}>
        {/* Banner */}
        {customization.banner_url && (
          <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${customization.banner_url})` }} />
        )}
        
        <div className="p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
              {profileUser.avatar_url && <AvatarImage src={profileUser.avatar_url} />}
              <AvatarFallback className="text-4xl bg-white text-blue-600">
                {profileUser.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                <h1 className="text-3xl font-bold">{profileUser.full_name}</h1>
                {customization.custom_title && (
                  <Badge className="bg-white/20 text-white border-white">
                    {customization.custom_title}
                  </Badge>
                )}
              </div>
              
              <p className="text-blue-100 mb-4">{profileUser.email}</p>
              
              {/* Top Badges Preview */}
              {topBadges.length > 0 && (
                <div className="flex gap-2 mb-4 justify-center md:justify-start">
                  {topBadges.slice(0, 3).map((badge, idx) => {
                    const Icon = badge.icon;
                    return (
                      <div key={idx} className="bg-white/20 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-medium">{badge.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
                  <Trophy className="w-5 h-5 inline mr-2" />
                  <span className="font-semibold">{stats.achievements} Achievements</span>
                </div>
                <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
                  <Star className="w-5 h-5 inline mr-2" />
                  <span className="font-semibold">{stats.totalPoints} Points</span>
                </div>
                <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
                  <Flame className="w-5 h-5 inline mr-2" />
                  <span className="font-semibold">{stats.streak} Day Streak</span>
                </div>
              </div>
            </div>

            {isOwnProfile && (
              <Button 
                variant="secondary"
                onClick={() => setIsCustomizing(!isCustomizing)}
              >
                {isCustomizing ? <Save className="w-4 h-4 mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
                {isCustomizing ? 'Save' : 'Customize'}
              </Button>
            )}
          </div>

          {/* Customization Panel */}
          {isCustomizing && isOwnProfile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 pt-6 border-t border-white/20"
            >
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Theme Color</label>
                  <Select value={customization.theme_color} onValueChange={(v) => setCustomization({...customization, theme_color: v})}>
                    <SelectTrigger className="bg-white/20 text-white border-white/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Banner URL</label>
                  <Input
                    placeholder="https://example.com/banner.jpg"
                    value={customization.banner_url}
                    onChange={(e) => setCustomization({...customization, banner_url: e.target.value})}
                    className="bg-white/20 text-white border-white/30 placeholder:text-white/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Custom Title</label>
                  <Input
                    placeholder="Pro Gamer"
                    value={customization.custom_title}
                    onChange={(e) => setCustomization({...customization, custom_title: e.target.value})}
                    className="bg-white/20 text-white border-white/30 placeholder:text-white/50"
                  />
                </div>
              </div>
              <Button 
                onClick={handleSaveCustomization}
                className="mt-4 bg-white text-blue-600 hover:bg-white/90"
              >
                Save Customization
              </Button>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}