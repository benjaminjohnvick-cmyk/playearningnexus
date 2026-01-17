import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

export default function AchievementNotification({ achievement, onClose }) {
  useEffect(() => {
    if (achievement) {
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [achievement]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
        >
          <Card className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 shadow-2xl border-4 border-yellow-300">
            <div className="flex items-start gap-4">
              <div className="text-6xl">{achievement.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-6 h-6 text-white" />
                  <h3 className="text-2xl font-bold text-white">Achievement Unlocked!</h3>
                </div>
                <p className="text-xl font-semibold text-white mb-1">{achievement.title}</p>
                <p className="text-white/90">{achievement.description}</p>
                {achievement.reward_amount > 0 && (
                  <p className="text-sm text-white/80 mt-2">
                    🎁 Bonus: ${achievement.reward_amount}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}