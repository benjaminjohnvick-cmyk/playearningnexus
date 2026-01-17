import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Trophy, Coins, Users } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AIGuildChallenge({ guild, guildMembers }) {
  const [generatingChallenge, setGeneratingChallenge] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const queryClient = useQueryClient();

  const generateChallengeMutation = useMutation({
    mutationFn: async () => {
      setGeneratingChallenge(true);

      // Call AI to generate guild challenge
      const challenge = await base44.integrations.Core.InvokeLLM({
        prompt: `Create an exciting guild challenge for a gaming guild.

Guild Info:
- Name: ${guild.guild_name}
- Members: ${guildMembers.length}
- Level: ${guild.guild_level}
- Total Earnings: $${guild.total_earnings || 0}

Generate a fun, achievable challenge that:
1. Involves teamwork and collaboration
2. Has clear objectives and goals
3. Offers appropriate rewards
4. Can be completed within 7 days

Be creative and engaging!`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            objectives: {
              type: 'array',
              items: { type: 'string' }
            },
            duration_days: { type: 'number' },
            reward_credits: { type: 'number' },
            reward_xp: { type: 'number' },
            difficulty: { type: 'string' }
          }
        }
      });

      return challenge;
    },
    onSuccess: (data) => {
      setCurrentChallenge(data);
      setGeneratingChallenge(false);
      toast.success('New challenge generated!');
    },
    onError: () => {
      setGeneratingChallenge(false);
      toast.error('Failed to generate challenge');
    }
  });

  const acceptChallengeMutation = useMutation({
    mutationFn: async () => {
      // Save challenge to database
      await base44.entities.DailyChallenge.create({
        guild_id: guild.id,
        challenge_type: 'guild_team',
        title: currentChallenge.title,
        description: currentChallenge.description,
        requirements: currentChallenge.objectives,
        reward_credits: currentChallenge.reward_credits,
        difficulty: currentChallenge.difficulty,
        expires_at: new Date(Date.now() + currentChallenge.duration_days * 24 * 60 * 60 * 1000).toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['guildChallenges']);
      toast.success('Challenge accepted! Good luck!');
      setCurrentChallenge(null);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Guild Challenges
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!currentChallenge ? (
          <div className="text-center py-8">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Generate a new AI-powered challenge for your guild</p>
            <Button
              onClick={() => generateChallengeMutation.mutate()}
              disabled={generatingChallenge}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generatingChallenge ? 'Generating...' : 'Generate Challenge'}
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border-2 border-purple-200">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-bold">{currentChallenge.title}</h3>
                <Badge className="bg-purple-600">{currentChallenge.difficulty}</Badge>
              </div>
              <p className="text-gray-700 mb-4">{currentChallenge.description}</p>

              <div className="space-y-2 mb-4">
                <p className="font-semibold text-sm">Objectives:</p>
                {currentChallenge.objectives.map((obj, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                    <span>{obj}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                  <Coins className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-semibold">{currentChallenge.reward_credits} Credits</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                  <Trophy className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold">{currentChallenge.reward_xp} XP</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold">{currentChallenge.duration_days} Days</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => acceptChallengeMutation.mutate()}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  Accept Challenge
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentChallenge(null)}
                >
                  Generate New
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}