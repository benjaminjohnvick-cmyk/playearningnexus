import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Points awarded for different activities
const POINTS_SYSTEM = {
  survey_completed: 50,
  game_installed: 25,
  game_played: 10,
  achievement_unlocked: 100,
  friend_referred: 150,
  daily_login: 5,
  purchase_made: 20,
  review_submitted: 30,
  guild_joined: 40,
  tournament_participated: 75
};

// Level calculation (every 1000 points = 1 level)
const calculateLevel = (points) => Math.floor(points / 1000) + 1;

export const usePointsTracker = () => {
  const queryClient = useQueryClient();

  const awardPointsMutation = useMutation({
    mutationFn: async ({ userId, activityType, relatedEntityId, description }) => {
      const pointsEarned = POINTS_SYSTEM[activityType] || 0;

      // Get current user data
      const users = await base44.entities.User.filter({ id: userId });
      const user = users[0];

      if (!user) throw new Error('User not found');

      const newTotalPoints = (user.total_points || 0) + pointsEarned;
      const newLevel = calculateLevel(newTotalPoints);

      // Update user points and level
      await base44.entities.User.update(userId, {
        total_points: newTotalPoints,
        level: newLevel
      });

      // Log activity
      await base44.entities.UserActivity.create({
        user_id: userId,
        activity_type: activityType,
        points_earned: pointsEarned,
        description: description || `Earned ${pointsEarned} points for ${activityType}`,
        related_entity_id: relatedEntityId
      });

      // Check for level up
      if (newLevel > (user.level || 1)) {
        toast.success(`🎉 Level Up! You're now Level ${newLevel}!`, {
          duration: 5000
        });
      }

      return { pointsEarned, newTotalPoints, newLevel };
    },
    onSuccess: ({ pointsEarned }) => {
      queryClient.invalidateQueries(['currentUser']);
      queryClient.invalidateQueries(['allUsers']);
      toast.success(`+${pointsEarned} points earned! 🌟`);
    }
  });

  return {
    awardPoints: awardPointsMutation.mutate,
    isAwarding: awardPointsMutation.isPending
  };
};

export default usePointsTracker;