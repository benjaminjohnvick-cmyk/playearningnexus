import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

export default function ReviewForm({ game, user, existingReview }) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState(existingReview?.review_text || '');
  const queryClient = useQueryClient();

  const submitReviewMutation = useMutation({
    mutationFn: async (data) => {
      if (existingReview) {
        return await base44.entities.GameReview.update(existingReview.id, data);
      }
      return await base44.entities.GameReview.create(data);
    },
    onSuccess: async () => {
      // Update game's average rating
      const allReviews = await base44.entities.GameReview.filter({ game_id: game.id });
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      
      await base44.entities.Game.update(game.id, {
        average_rating: avgRating,
        total_ratings: allReviews.length
      });

      queryClient.invalidateQueries(['gameReviews']);
      queryClient.invalidateQueries(['game', game.id]);
      toast.success(existingReview ? 'Review updated!' : 'Review submitted!');
      setRating(0);
      setReviewText('');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    submitReviewMutation.mutate({
      game_id: game.id,
      user_id: user.id,
      user_name: user.full_name,
      rating,
      review_text: reviewText,
      is_verified_purchase: user.game_library?.includes(game.id) || false
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{existingReview ? 'Update Your Review' : 'Write a Review'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoverRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-lg font-semibold">
                {rating > 0 && `${rating}/5`}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Your Review (Optional)
            </label>
            <Textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your thoughts about this game..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-gray-500 mt-1">
              {reviewText.length}/1000 characters
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitReviewMutation.isPending}
            className="w-full"
          >
            {submitReviewMutation.isPending
              ? 'Submitting...'
              : existingReview
              ? 'Update Review'
              : 'Submit Review'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}