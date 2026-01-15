import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, Download, ArrowLeft, ThumbsUp, ShoppingCart, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GamePurchaseModal from '../components/payments/GamePurchaseModal';
import BugReportButton from '../components/game/BugReportButton';
import ReviewForm from '../components/reviews/ReviewForm';
import ReviewsList from '../components/reviews/ReviewsList';
import DeveloperCard from '../components/developer/DeveloperCard';

export default function GameDetail() {
  const [user, setUser] = useState(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('id');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Not authenticated');
      }
    };
    fetchUser();
  }, []);

  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const games = await base44.entities.Game.list();
      return games.find(g => g.id === gameId);
    },
    enabled: !!gameId
  });

  const { data: developer } = useQuery({
    queryKey: ['developer', game?.developer_id],
    queryFn: async () => {
      const devs = await base44.entities.BusinessClient.list();
      return devs.find(d => d.id === game.developer_id);
    },
    enabled: !!game?.developer_id
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['gameRatings', gameId],
    queryFn: () => base44.entities.GameRating.filter({ game_id: gameId }),
    enabled: !!gameId
  });

  const { data: userReview } = useQuery({
    queryKey: ['userReview', gameId, user?.id],
    queryFn: () => base44.entities.GameReview.filter({ game_id: gameId, user_id: user.id }),
    enabled: !!user && !!gameId,
    select: (data) => data[0]
  });

  const submitReviewMutation = useMutation({
    mutationFn: () => base44.entities.GameRating.create({
      user_id: user.id,
      game_id: gameId,
      rating: rating,
      review: review
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameRatings'] });
      setRating(0);
      setReview('');
      toast.success('Review submitted!');
    }
  });

  const handlePurchase = () => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }

    if (!game.price || game.price === 0) {
      purchaseGameMutation.mutate();
    } else {
      setShowPurchaseModal(true);
    }
  };

  const purchaseGameMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Transaction.create({
        user_id: user.id,
        game_id: gameId,
        transaction_type: 'game_purchase',
        amount: 0,
        status: 'completed'
      });

      await base44.analytics.track({
        eventName: 'game_purchased_free',
        properties: { game_id: gameId, game_title: game.title }
      });
    },
    onSuccess: () => {
      toast.success('Game added to your library!');
    }
  });

  if (!game) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
    </div>;
  }

  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-6xl mx-auto">
        <Link to={createPageUrl('GameStore')}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Store
          </Button>
        </Link>

        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div className="md:col-span-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="p-8">
                  <div className="flex gap-6 mb-6">
                    {game.icon_url && (
                      <img src={game.icon_url} alt={game.title} className="w-32 h-32 rounded-xl object-cover" />
                    )}
                    <div className="flex-1">
                      <h1 className="text-4xl font-bold mb-2">{game.title}</h1>
                      <Badge className="mb-3 capitalize">{game.category}</Badge>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star
                              key={star}
                              className={`w-5 h-5 ${star <= avgRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        <span className="text-lg font-bold">{avgRating.toFixed(1)}</span>
                        <span className="text-gray-500">({ratings.length} reviews)</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Download className="w-4 h-4" />
                          {game.total_installs || 0} installs
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3 p-4 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-gray-700 font-medium">Price:</span>
                      <span className="text-3xl font-bold text-green-700">
                        {!game.price || game.price === 0 ? 'FREE' : `$${game.price.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <Button
                        onClick={handlePurchase}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700"
                        size="lg"
                      >
                        {!game.price || game.price === 0 ? (
                          <>
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Get Free
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Buy Now - ${game.price.toFixed(2)}
                          </>
                        )}
                      </Button>
                      <BugReportButton game={game} />
                    </div>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-xl font-bold mb-3">About this game</h2>
                    <p className="text-gray-700">{game.description}</p>
                  </div>

                  {game.screenshots?.length > 0 && (
                    <div>
                      <h2 className="text-xl font-bold mb-3">Screenshots</h2>
                      <div className="grid grid-cols-2 gap-4">
                        {game.screenshots.map((screenshot, idx) => (
                          <img key={idx} src={screenshot} alt={`Screenshot ${idx + 1}`} className="rounded-lg" />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Game Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Category</p>
                  <p className="font-medium capitalize">{game.category}</p>
                </div>
                <div>
                  <p className="text-gray-600">Platforms</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {game.platform?.map(p => (
                      <Badge key={p} variant="outline" className="capitalize">{p}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-gray-600">Average Rating</p>
                  <p className="font-medium">{avgRating.toFixed(1)} / 5.0</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Reviews</p>
                  <p className="font-medium">{ratings.length}</p>
                </div>
              </CardContent>
            </Card>

            {developer && (
              <Card>
                <CardHeader>
                  <CardTitle>Developer</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link to={createPageUrl('DeveloperPortfolio') + `?id=${developer.id}`}>
                    <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                      {developer.logo_url && (
                        <img 
                          src={developer.logo_url} 
                          alt={developer.company_name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <p className="font-semibold">{developer.company_name}</p>
                        {developer.tagline && (
                          <p className="text-xs text-gray-600">{developer.tagline}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="space-y-6">
          {user && <ReviewForm game={game} user={user} existingReview={userReview} />}
          <ReviewsList gameId={gameId} currentUser={user} />
        </div>

        {/* Purchase Modal */}
        <GamePurchaseModal
          game={game}
          open={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
          }}
        />
      </div>
    </div>
  );
}