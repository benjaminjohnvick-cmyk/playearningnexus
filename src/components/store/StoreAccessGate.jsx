import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Lock, TrendingUp, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StoreAccessGate({ children, canAccessStore, onAccessGranted }) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const minimumRequired = 3;

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await base44.functions.invoke('validateStoreAccess', {});
        setHasAccess(response.data.can_access);
        setTodayEarnings(response.data.today_earnings);
        if (response.data.can_access && onAccessGranted) {
          onAccessGranted();
        }
      } catch (e) {
        console.error('Error checking store access:', e);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };
    checkAccess();
  }, [onAccessGranted]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasAccess) {
    const earnedPercentage = (todayEarnings / minimumRequired) * 100;
    const stillNeeded = minimumRequired - todayEarnings;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4"
      >
        <Card className="max-w-md w-full border-2 border-blue-300 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue-100 rounded-full">
                <Lock className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-gray-900">Store Access Locked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-gray-600">
              You need to earn <span className="font-bold text-blue-600">${minimumRequired.toFixed(2)}</span> today to access the Game Store.
            </p>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Daily Earnings Progress</span>
                <span className="text-sm font-bold text-blue-600">${todayEarnings.toFixed(2)} / ${minimumRequired.toFixed(2)}</span>
              </div>
              <Progress value={Math.min(earnedPercentage, 100)} className="h-3" />
              <p className="text-xs text-gray-500 mt-2">
                You need <span className="font-bold text-red-600">${stillNeeded.toFixed(2)} more</span> to unlock access
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div whileHover={{ scale: 1.05 }}>
                <Button variant="outline" className="w-full gap-2 border-green-300 text-green-700 hover:bg-green-50">
                  <TrendingUp className="w-4 h-4" />
                  Do a Survey
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }}>
                <Button variant="outline" className="w-full gap-2 border-purple-300 text-purple-700 hover:bg-purple-50">
                  <DollarSign className="w-4 h-4" />
                  PPC Ads
                </Button>
              </motion.div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-gray-700 leading-relaxed">
                💡 <span className="font-semibold">Tip:</span> Complete surveys, click ads, or engage with the ad grid to earn money quickly. The store unlocks automatically once you reach $3 earned today.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // User has access, render store
  return children;
}