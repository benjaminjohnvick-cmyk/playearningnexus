import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Award, BookOpen, Users, DollarSign, TrendingUp, Gift, Sunrise, Star, Zap, Shield } from 'lucide-react';

const iconMap = {
  BookOpen, Users, DollarSign, TrendingUp, Gift, Sunrise, Star, Zap, Shield, Award,
};

export default function BadgeGrid({ userId }) {
  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['userBadges', userId],
    queryFn: async () => {
      const res = await base44.entities.UserAchievementBadge.filter({ user_id: userId });
      return res;
    },
  });

  const rarityColors = {
    common: 'bg-gray-100 border-gray-300 text-gray-800',
    uncommon: 'bg-green-100 border-green-300 text-green-800',
    rare: 'bg-blue-100 border-blue-300 text-blue-800',
    epic: 'bg-purple-100 border-purple-300 text-purple-800',
    legendary: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  if (isLoading) return <p className="text-gray-500">Loading badges...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-bold">Achievements</h3>
        <Badge className="ml-auto">{badges.length} earned</Badge>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {badges.length === 0 ? (
          <p className="text-sm text-gray-500 col-span-full">Complete surveys and referrals to unlock badges!</p>
        ) : (
          badges.map((badge) => {
            const Icon = iconMap[badge.badge_icon] || Award;
            return (
              <motion.div key={badge.id} variants={item}>
                <Card className={`h-full border-2 ${rarityColors[badge.rarity]} hover:shadow-lg transition-shadow`}>
                  <CardContent className="p-4 text-center">
                    <div className="mb-3 flex justify-center">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                        <Icon className="w-7 h-7" style={{ color: badge.badge_color }} />
                      </div>
                    </div>
                    <p className="font-bold text-sm">{badge.badge_name}</p>
                    <p className="text-xs text-gray-600 mt-1">{badge.is_featured && '⭐ Featured'}</p>
                    <Badge className="mt-2 text-xs capitalize">{badge.rarity}</Badge>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}