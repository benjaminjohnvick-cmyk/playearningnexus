import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import moment from 'moment';

export default function AchievementsDisplay({ achievements }) {
  const unlocked = achievements.filter(a => a.is_unlocked);
  const locked = achievements.filter(a => !a.is_unlocked);

  return (
    <div className="space-y-6">
      {/* Unlocked Achievements */}
      {unlocked.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Unlocked ({unlocked.length})
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlocked.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Trophy className="w-10 h-10 text-yellow-600" />
                      <div className="flex-1">
                        <h4 className="font-bold mb-1">{achievement.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                        {achievement.reward_amount > 0 && (
                          <Badge className="bg-green-600 mb-2">
                            +${achievement.reward_amount} Bonus
                          </Badge>
                        )}
                        <p className="text-xs text-gray-500">
                          Unlocked {moment(achievement.unlocked_date).fromNow()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Locked Achievements */}
      {locked.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-400" />
            Locked ({locked.length})
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locked.map((achievement, index) => (
              <Card key={achievement.id} className="opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-10 h-10 text-gray-400" />
                    <div className="flex-1">
                      <h4 className="font-bold mb-1">{achievement.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${achievement.progress || 0}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500">{achievement.progress || 0}% Complete</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {achievements.length === 0 && (
        <Card className="p-12 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg">No achievements yet</p>
        </Card>
      )}
    </div>
  );
}