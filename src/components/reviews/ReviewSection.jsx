import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, ThumbsUp, Badge as BadgeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ReviewSection({ game, user }) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const queryClient = useQueryClient();

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', game?.id],
    queryFn: () => base44.entities.GameReview.filter({ game_id: game.id }, '-created_date'),
    enabled: !!game
  });

  const { data: userReview } = useQuery({
    queryKey: ['userReview', game?.id, user?.id],
    queryFn: () => base44.entities.GameReview.filter({ 
      game_id: game.id, 
      user_id: user.id 
    }).then(res => res[0]),
    enabled: !!game && !!user
  });

  const likeReviewMutation = useMutation({
    mutationFn: async (reviewId) => {
      const review = reviews.find(r => r.id === reviewId);
      if (!review) return;
      await base44.entities.GameReview.update(reviewId, {
        helpful_count: (review.helpful_count || 0) + 1,
      });
    },
    onSuccess: () => queryClient.invalidateQueries(['reviews', game?.id]),
  });

  const submitReviewMutation = useMutation({
    mutationFn: async ({ rating, reviewText }) => {
      if (userReview) {
        return await base44.entities.GameReview.update(userReview.id, {
          rating,
          review_text: reviewText
        });
      } else {
        return await base44.entities.GameReview.create({
          game_id: game.id,
          user_id: user.id,
          user_name: user.full_name,
          rating,
          review_text: reviewText,
          is_verified_purchase: true
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reviews', game.id]);
      queryClient.invalidateQueries(['userReview', game.id, user.id]);
      queryClient.invalidateQueries(['games']);
      toast.success('Review submitted!');
      setRating(0);
      setReviewText('');
    }
  });

  const handleSubmitReview = () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    submitReviewMutation.mutate({ rating, reviewText });
  };

  const StarRating = ({ value, onRate, onHover, interactive = false }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`w-6 h-6 ${
            star <= (interactive ? (hoveredRating || value) : value)
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-gray-300'
          } ${interactive ? 'cursor-pointer' : ''}`}
          onClick={() => interactive && onRate(star)}
          onMouseEnter={() => interactive && onHover(star)}
          onMouseLeave={() => interactive && onHover(0)}
        />
      ))}
    </div>
  );

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <Card>
        <CardHeader>
          <CardTitle>User Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">{averageRating}</div>
              <StarRating value={Math.round(parseFloat(averageRating))} />
              <p className="text-sm text-gray-600 mt-2">{reviews.length} reviews</p>
            </div>
            
            <div className="flex-1">
              {[5, 4, 3, 2, 1].map(stars => {
                const count = reviews.filter(r => r.rating === stars).length;
                const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2 mb-2">
                    <span className="text-sm w-12">{stars} star</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-400"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Write Review */}
          {user && (
            <div className="border-t pt-6">
              <h4 className="font-semibold mb-4">
                {userReview ? 'Update Your Review' : 'Write a Review'}
              </h4>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Your Rating</p>
                <StarRating 
                  value={rating || userReview?.rating || 0}
                  onRate={setRating}
                  onHover={setHoveredRating}
                  interactive
                />
              </div>
              <Textarea
                placeholder="Share your thoughts about this game..."
                value={reviewText || (userReview?.review_text || '')}
                onChange={(e) => setReviewText(e.target.value)}
                className="mb-4"
                rows={4}
              />
              <Button 
                onClick={handleSubmitReview}
                disabled={submitReviewMutation.isPending}
              >
                {userReview ? 'Update Review' : 'Submit Review'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review, index) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <Avatar>
                    <AvatarFallback>
                      {review.user_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">{review.user_name}</p>
                        <StarRating value={review.rating} />
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(review.created_date).toLocaleDateString()}
                      </span>
                    </div>
                    {review.review_text && (
                      <p className="text-gray-700 mb-3">{review.review_text}</p>
                    )}
                    {review.playtime_hours && (
                      <p className="text-sm text-gray-500">
                        {review.playtime_hours} hours played
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      {review.is_verified_purchase && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          ✓ Verified Purchase
                        </span>
                      )}
                      <button
                        onClick={() => user && likeReviewMutation.mutate(review.id)}
                        disabled={!user || likeReviewMutation.isPending}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors ml-auto disabled:opacity-40"
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
    </div>
  );
}