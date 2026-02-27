import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export default function WriteReviewForm({ game, user, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const queryClient = useQueryClient();

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      if (!rating) throw new Error('Please select a star rating');
      if (!reviewText.trim()) throw new Error('Please write a review');

      await base44.entities.GameReview.create({
        game_id: game.id,
        reviewer_user_id: user.id,
        rating,
        review_text: reviewText.trim(),
        reviewer_name: user.full_name || 'Anonymous'
      });

      // Update game's average rating
      const reviews = await base44.entities.GameReview.filter({ game_id: game.id });
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await base44.entities.Game.update(game.id, {
        average_rating: avgRating,
        total_ratings: reviews.length
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['game-reviews', game.id]);
      toast.success('Review submitted! Thank you.');
      setRating(0);
      setReviewText('');
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to submit review');
    }
  });

  const displayRating = hoverRating || rating;

  return (
    <div className="border rounded-xl p-5 bg-gradient-to-br from-blue-50 to-purple-50 space-y-4">
      <h4 className="font-bold text-gray-900">Write a Review</h4>

      {/* Star Rating */}
      <div>
        <p className="text-sm text-gray-600 mb-2">Your Rating</p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  star <= displayRating
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm font-medium text-gray-700">
              {['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent'][rating]}
            </span>
          )}
        </div>
      </div>

      {/* Review Text */}
      <div>
        <p className="text-sm text-gray-600 mb-2">Your Review</p>
        <Textarea
          placeholder={`What did you think of ${game.title}?`}
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          rows={3}
          maxLength={500}
          className="bg-white"
        />
        <p className="text-xs text-gray-400 text-right mt-1">{reviewText.length}/500</p>
      </div>

      <Button
        onClick={() => submitReviewMutation.mutate()}
        disabled={submitReviewMutation.isPending || !rating || !reviewText.trim()}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
      >
        {submitReviewMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Submit Review
          </>
        )}
      </Button>
    </div>
  );
}