import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, Award, Target, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const ENDORSEMENT_SKILLS = [
  { id: 'teamwork', label: 'Team Player', icon: Award },
  { id: 'strategy', label: 'Strategic Thinker', icon: Target },
  { id: 'clutch', label: 'Clutch Player', icon: Zap },
  { id: 'leadership', label: 'Natural Leader', icon: ThumbsUp }
];

export default function FriendEndorsements({ profileUserId, currentUserId, isOwnProfile }) {
  const queryClient = useQueryClient();

  const { data: endorsements = [] } = useQuery({
    queryKey: ['endorsements', profileUserId],
    queryFn: async () => {
      // Fetch user recommendations that are endorsements
      const recs = await base44.entities.UserRecommendation.filter({
        user_id: profileUserId,
        recommendation_type: 'skill_endorsement'
      });
      return recs;
    },
    enabled: !!profileUserId
  });

  const endorseMutation = useMutation({
    mutationFn: async (skillId) => {
      await base44.entities.UserRecommendation.create({
        user_id: profileUserId,
        recommended_by_user_id: currentUserId,
        recommendation_type: 'skill_endorsement',
        skill_endorsed: skillId
      });
      
      // Post to activity feed
      await base44.entities.ActivityFeedItem.create({
        user_id: profileUserId,
        activity_type: 'endorsement',
        description: `was endorsed for ${ENDORSEMENT_SKILLS.find(s => s.id === skillId)?.label}`,
        metadata: { endorsed_by: currentUserId, skill: skillId }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['endorsements']);
      toast.success('Endorsement added!');
    }
  });

  const skillCounts = ENDORSEMENT_SKILLS.map(skill => ({
    ...skill,
    count: endorsements.filter(e => e.skill_endorsed === skill.id).length,
    endorsedByMe: endorsements.some(e => e.skill_endorsed === skill.id && e.recommended_by_user_id === currentUserId)
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThumbsUp className="w-5 h-5 text-blue-600" />
          Skills & Endorsements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {skillCounts.map((skill, idx) => {
            const Icon = skill.icon;
            return (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className={`p-4 rounded-lg border-2 ${skill.count > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${skill.count > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="font-semibold text-sm">{skill.label}</span>
                    </div>
                    {skill.count > 0 && (
                      <Badge variant="secondary">{skill.count}</Badge>
                    )}
                  </div>
                  
                  {!isOwnProfile && (
                    <Button
                      size="sm"
                      variant={skill.endorsedByMe ? "outline" : "default"}
                      className="w-full mt-2"
                      onClick={() => !skill.endorsedByMe && endorseMutation.mutate(skill.id)}
                      disabled={skill.endorsedByMe}
                    >
                      <ThumbsUp className="w-3 h-3 mr-1" />
                      {skill.endorsedByMe ? 'Endorsed' : 'Endorse'}
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}