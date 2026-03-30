import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, ThumbsUp, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import WriteReviewForm from '@/components/games/WriteReviewForm';

const CATEGORY_LABELS = {
  gameplay: 'Gameplay',
  graphics: 'Graphics',
  performance: 'Performance',
  fun_factor: 'Fun Factor',
  value: 'Value',
};

function StarDisplay({ value, size = 'sm' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${sz} ${s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

export default function ReviewSection({ game, user }) {
  const queryClient = useQueryClient();

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', game?.id],
    queryFn: () => base44.entities.GameReview.filter({ game_id: game.id }, '-created_date'),
    enabled: !!game,
  });

  const likeReviewMutation = useMutation({
    mutationFn: async (reviewId) => {
      const review = reviews.find(r => r.id === reviewId);
      if (!review) return;
      await base44.entities.GameReview.update(reviewId, { helpful_count: (review.helpful_count || 0) + 1 });
    },
    onSuccess: () => queryClient.invalidateQueries(['reviews', game?.id]),
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <Tabs defaultValue={user ? 'write' : 'read'} className="w-full">
      <TabsList className="w-full mb-4">
        <TabsTrigger value="write" className="flex-1">✍️ Write a Review</TabsTrigger>
        <TabsTrigger value="read" className="flex-1">📖 Read Reviews ({reviews.length})</TabsTrigger>
      </TabsList>

      {/* Write Review Tab */}
      <TabsContent value="write">
        {user ? (
          <WriteReviewForm
            game={game}
            user={user}
            onSuccess={() => {
              queryClient.invalidateQueries(['reviews', game?.id]);
            }}
          />
        ) : (
          <div className="text-center py-10 text-gray-400">
            <Star className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="font-medium">Sign in to leave a review</p>
          </div>
        )}
      </TabsContent>

      {/* Read Reviews Tab */}
      <TabsContent value="read">
        {/* Rating Summary */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-5xl font-black text-gray-900">{avgRating}</p>
                <StarDisplay value={Math.round(parseFloat(avgRating))} size="md" />
                <p className="text-xs text-gray-500 mt-1">{reviews.length} reviews</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map(stars => {
                  const count = reviews.filter(r => r.rating === stars).length;
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-10">{stars} star</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reviews list */}
        {reviews.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Star className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="font-medium">No reviews yet — be the first!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review, i) => (
              <motion.div key={review.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="text-sm bg-indigo-100 text-indigo-700">
                          {review.user_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{review.user_name || 'Player'}</p>
                            {review.input_method === 'voice' && (
                              <Badge variant="outline" className="text-xs gap-1 py-0">
                                <Mic className="w-2.5 h-2.5" /> Voice
                              </Badge>
                            )}
                            {review.is_verified_purchase && (
                              <span className="text-xs text-green-600 font-medium">✓ Verified</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {new Date(review.created_date).toLocaleDateString()}
                          </span>
                        </div>

                        <StarDisplay value={review.rating} />

                        {/* Category ratings */}
                        {review.category_ratings && Object.keys(review.category_ratings).length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {Object.entries(review.category_ratings).map(([k, v]) => v ? (
                              <span key={k} className="text-xs text-gray-500">
                                <span className="font-medium">{CATEGORY_LABELS[k] || k}:</span> {v}⭐
                              </span>
                            ) : null)}
                          </div>
                        )}

                        {review.review_text && (
                          <p className="text-sm text-gray-700 mt-2 leading-relaxed">{review.review_text}</p>
                        )}

                        <div className="flex items-center justify-between mt-3">
                          {review.playtime_hours ? (
                            <span className="text-xs text-gray-400">{review.playtime_hours}h played</span>
                          ) : <span />}
                          <button
                            onClick={() => user && likeReviewMutation.mutate(review.id)}
                            disabled={!user || likeReviewMutation.isPending}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>{review.helpful_count || 0} helpful</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}