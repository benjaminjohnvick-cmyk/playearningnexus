import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, ThumbsUp, CheckCircle, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function ReviewsList({ gameId, currentUser }) {
  const [sortBy, setSortBy] = useState('recent');
  const [filterRating, setFilterRating] = useState('all');
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['gameReviews', gameId, sortBy, filterRating],
    queryFn: async () => {
      let allReviews = await base44.entities.GameReview.filter({ game_id: gameId });
      
      // Filter by rating
      if (filterRating !== 'all') {
        const targetRating = parseInt(filterRating);
        allReviews = allReviews.filter(r => r.rating === targetRating);
      }

      // Sort
      if (sortBy === 'recent') {
        allReviews.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      } else if (sortBy === 'highest') {
        allReviews.sort((a, b) => b.rating - a.rating);
      } else if (sortBy === 'lowest') {
        allReviews.sort((a, b) => a.rating - b.rating);
      } else if (sortBy === 'helpful') {
        allReviews.sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0));
      }

      return allReviews;
    }
  });

  const markHelpfulMutation = useMutation({
    mutationFn: async (reviewId) => {
      const review = reviews.find(r => r.id === reviewId);
      await base44.entities.GameReview.update(reviewId, {
        helpful_count: (review.helpful_count || 0) + 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['gameReviews']);
      toast.success('Marked as helpful');
    }
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  // Calculate rating distribution
  const ratingCounts = [0, 0, 0, 0, 0];
  reviews.forEach(r => ratingCounts[r.rating - 1]++);

  return (
    <div className="space-y-6">
      {/* Rating Distribution */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-4">Rating Distribution</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = ratingCounts[rating - 1];
              const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20">
                    <span className="text-sm font-medium">{rating}</span>
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="highest">Highest Rated</SelectItem>
              <SelectItem value="lowest">Lowest Rated</SelectItem>
              <SelectItem value="helpful">Most Helpful</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select value={filterRating} onValueChange={setFilterRating}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4 Stars</SelectItem>
            <SelectItem value="3">3 Stars</SelectItem>
            <SelectItem value="2">2 Stars</SelectItem>
            <SelectItem value="1">1 Star</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <p>No reviews yet. Be the first to review!</p>
            </CardContent>
          </Card>
        ) : (
          reviews.map(review => (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{review.user_name}</p>
                      {review.is_verified_purchase && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">
                        {new Date(review.created_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {review.is_featured && (
                    <Badge className="bg-purple-600">Featured</Badge>
                  )}
                </div>

                {review.review_text && (
                  <p className="text-gray-700 mb-3 leading-relaxed">{review.review_text}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markHelpfulMutation.mutate(review.id)}
                    disabled={currentUser?.id === review.user_id}
                  >
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    Helpful ({review.helpful_count || 0})
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}