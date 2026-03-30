import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, TrendingUp } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function AnimatedJackpotCounter({ showAnimation = true }) {
  const [prevJackpot, setPrevJackpot] = useState(0);
  const [animatingValue, setAnimatingValue] = useState(0);
  const [earningEvent, setEarningEvent] = useState(null);

  const { data: jackpotData } = useQuery({
    queryKey: ['jackpot-total'],
    queryFn: async () => {
      try {
        const recentTransactions = await base44.entities.PPCTransaction.filter({}).catch(() => []);
        const totalJackpot = recentTransactions.reduce((sum, t) => sum + (t.advertiser_fee || 0.1), 0);
        return { totalJackpot: totalJackpot * 0.5 };
      } catch {
        return { totalJackpot: 0 };
      }
    },
    refetchInterval: 3000,
    staleTime: 2000,
  });

  useEffect(() => {
    if (!jackpotData) return;

    const currentJackpot = jackpotData.totalJackpot;
    const difference = currentJackpot - prevJackpot;

    // Trigger animation when jackpot increases
    if (difference > 0.5) {
      setAnimatingValue(difference);
      setEarningEvent({
        amount: difference,
        timestamp: Date.now()
      });

      // Trigger confetti on significant gains
      if (difference > 5) {
        triggerConfetti();
      }

      // Auto-hide animation after 3 seconds
      const timeout = setTimeout(() => {
        setEarningEvent(null);
      }, 3000);

      setPrevJackpot(currentJackpot);
      return () => clearTimeout(timeout);
    }
  }, [jackpotData?.totalJackpot, prevJackpot]);

  const triggerConfetti = () => {
    const end = Date.now() + 2000;
    const colors = ['#FFD700', '#FFA500', '#FF6347'];

    const frame = () => {
      if (Date.now() > end) return;

      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: Math.random(), y: Math.random() * 0.5 },
        colors
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: Math.random(), y: Math.random() * 0.5 },
        colors
      });

      requestAnimationFrame(frame);
    };

    frame();
  };

  return (
    <div className="relative">
      <motion.div
        className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 text-white px-4 py-3 rounded-full shadow-lg font-bold text-lg flex items-center gap-2 justify-center min-w-fit"
        initial={{ scale: 1 }}
        animate={{
          scale: earningEvent ? [1, 1.1, 1] : 1,
          boxShadow: earningEvent 
            ? [
                '0 0 20px rgba(255, 215, 0, 0.3)',
                '0 0 40px rgba(255, 215, 0, 0.6)',
                '0 0 20px rgba(255, 215, 0, 0.3)'
              ]
            : '0 0 20px rgba(0, 0, 0, 0.1)'
        }}
        transition={{ duration: 0.6 }}
      >
        <Zap className="w-5 h-5 animate-pulse" />
        <span>${(jackpotData?.totalJackpot || 0).toFixed(0)}</span>
      </motion.div>

      {/* Floating earning event animation */}
      <AnimatePresence>
        {earningEvent && (
          <motion.div
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -60, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5 }}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 pointer-events-none"
          >
            <div className="bg-gradient-to-t from-green-400 to-emerald-300 text-white font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
              +${earningEvent.amount.toFixed(2)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulse ring on earning */}
      <AnimatePresence>
        {earningEvent && (
          <>
            <motion.div
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 rounded-full bg-yellow-300 -m-2"
            />
            <motion.div
              initial={{ scale: 1.2, opacity: 0.6 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, delay: 0.1 }}
              className="absolute inset-0 rounded-full bg-orange-300 -m-2"
            />
          </>
        )}
      </AnimatePresence>

      {/* Trend indicator */}
      <motion.div
        className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1"
        animate={{
          scale: earningEvent ? [1, 1.2, 1] : 1,
          opacity: earningEvent ? 1 : 0.6
        }}
      >
        <TrendingUp className="w-4 h-4" />
      </motion.div>
    </div>
  );
}