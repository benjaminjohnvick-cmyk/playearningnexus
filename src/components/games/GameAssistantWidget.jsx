import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Brain, Zap, Target, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function GameAssistantWidget() {
  const [user, setUser] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: analysisData, isLoading } = useQuery({
    queryKey: ['gamePreferences', user?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('analyzeGamePreferences', {});
      return res.data;
    },
    enabled: !!user && expanded,
    staleTime: 5 * 60 * 1000, // 5 minute cache
  });

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setExpanded(!expanded)}
        className={`fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-lg transition-all ${
          expanded
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
            : 'bg-white border-2 border-purple-300 text-purple-600 hover:shadow-xl'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Sparkles className="w-6 h-6" />
      </motion.button>

      {/* Expanded Panel */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-24 right-6 z-40 w-96 max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border-2 border-purple-200"
        >
          <Card className="border-0 rounded-2xl">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  <CardTitle>Game Assistant</CardTitle>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-white hover:bg-white/20 p-1 rounded-full transition"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-purple-100 mt-1">AI-powered recommendations</p>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-600">Analyzing your profile...</p>
                </div>
              ) : analysisData ? (
                <>
                  {/* Player Insight */}
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-blue-200">
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-blue-900 mb-1">Your Profile</p>
                        <p className="text-sm text-blue-800">{analysisData.insight}</p>
                      </div>
                    </div>
                  </div>

                  {/* Player Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Zap, label: 'Style', value: analysisData.userProfile.playStyle },
                      { icon: TrendingUp, label: 'Completion', value: `${analysisData.userProfile.completionRate}%` },
                      { icon: Clock, label: 'Avg Session', value: `${analysisData.userProfile.avgSessionLength}m` },
                      { icon: DollarSign, label: 'Task Value', value: `$${analysisData.userProfile.avgTaskValue}` },
                    ].map((stat, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                        <div className="flex items-center gap-1 mb-1">
                          <stat.icon className="w-3 h-3 text-purple-600" />
                          <p className="text-xs text-gray-600">{stat.label}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recommended Games */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      Recommended for You
                    </h3>
                    <div className="space-y-2">
                      {analysisData.recommendations.slice(0, 5).map((rec, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border-2 border-green-200 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => toast.success(`Added ${rec.actual_title} to your play list!`)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900 truncate">
                                {rec.actual_title || rec.game_title}
                              </p>
                              {rec.actual_genre && (
                                <Badge className="text-xs bg-purple-200 text-purple-900 mt-1">
                                  {rec.actual_genre}
                                </Badge>
                              )}
                            </div>
                            <Badge className="bg-green-600 text-white text-xs flex-shrink-0">
                              {rec.completion_confidence}%
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-700 mb-2 line-clamp-2">{rec.reasoning}</p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1 text-green-700 font-semibold">
                              <DollarSign className="w-3 h-3" />
                              ${rec.estimated_reward}
                            </span>
                            <span className="flex items-center gap-1 text-blue-700">
                              <Clock className="w-3 h-3" />
                              {rec.estimated_playtime}m
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Refresh Button */}
                  <Button
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Refresh Recommendations
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-600 mb-3">No data available yet</p>
                  <p className="text-xs text-gray-500">Play games and complete surveys to get personalized recommendations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Overlay */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-30 bg-black/30"
        />
      )}
    </>
  );
}