import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Sparkles, ShoppingCart, Percent } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PersonalizedGameBundles({ user }) {
  const [generatingBundles, setGeneratingBundles] = useState(false);
  const [bundles, setBundles] = useState([]);
  const queryClient = useQueryClient();

  // Fetch user data for bundle generation
  const { data: userLibrary = [] } = useQuery({
    queryKey: ['user-library-bundles', user?.id],
    queryFn: async () => {
      if (!user?.game_library?.length) return [];
      return await base44.entities.Game.filter({ id: { $in: user.game_library } });
    },
    enabled: !!user
  });

  const { data: userEngagement = [] } = useQuery({
    queryKey: ['user-engagement', user?.id],
    queryFn: async () => {
      return await base44.entities.GameEngagement.filter({ user_id: user.id }, '-created_date', 20);
    },
    enabled: !!user
  });

  const { data: allGames = [] } = useQuery({
    queryKey: ['all-marketplace-games'],
    queryFn: async () => {
      return await base44.entities.Game.filter({ marketplace_approved: true });
    }
  });

  // Generate personalized bundles
  const generateBundlesMutation = useMutation({
    mutationFn: async () => {
      setGeneratingBundles(true);

      // Prepare user profile
      const topPlayedGames = userEngagement
        .slice(0, 5)
        .map(e => userLibrary.find(g => g.id === e.game_id)?.title)
        .filter(Boolean);

      const favoriteGenres = [...new Set(userLibrary.map(g => g.category))];

      // Call AI to generate bundle recommendations
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a game bundle curator for GamerGain platform. Based on the user's profile, create 3-4 personalized game bundles.

User Profile:
- Games in Library: ${userLibrary.map(g => g.title).join(', ') || 'None'}
- Most Played: ${topPlayedGames.join(', ') || 'None'}
- Favorite Genres: ${favoriteGenres.join(', ') || 'All'}

Available Games to Bundle:
${allGames.slice(0, 30).map(g => `- ${g.title} (${g.category}, $${g.price})`).join('\n')}

Create bundles with:
1. A catchy name
2. 3-5 games from the available list
3. A theme that matches user interests
4. 20-30% discount from individual prices

Return only game titles that exist in the available games list.`,
        response_json_schema: {
          type: 'object',
          properties: {
            bundles: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  game_titles: { type: 'array', items: { type: 'string' } },
                  discount_percentage: { type: 'number' }
                }
              }
            }
          }
        }
      });

      // Match AI suggestions with actual games
      const generatedBundles = response.bundles.map(bundle => {
        const bundleGames = bundle.game_titles
          .map(title => allGames.find(g => g.title.toLowerCase().includes(title.toLowerCase())))
          .filter(Boolean);

        if (bundleGames.length < 2) return null;

        const originalPrice = bundleGames.reduce((sum, g) => sum + (g.price || 0), 0);
        const discountedPrice = originalPrice * (1 - bundle.discount_percentage / 100);

        return {
          ...bundle,
          games: bundleGames,
          original_price: originalPrice,
          discounted_price: discountedPrice,
          savings: originalPrice - discountedPrice
        };
      }).filter(Boolean);

      return generatedBundles;
    },
    onSuccess: (data) => {
      setBundles(data);
      setGeneratingBundles(false);
      toast.success('Personalized bundles generated!');
    },
    onError: () => {
      setGeneratingBundles(false);
      toast.error('Failed to generate bundles');
    }
  });

  // Purchase bundle mutation
  const purchaseBundleMutation = useMutation({
    mutationFn: async (bundle) => {
      // Create transaction for bundle purchase
      await base44.entities.Transaction.create({
        user_id: user.id,
        amount: bundle.discounted_price,
        transaction_type: 'bundle_purchase',
        status: 'completed',
        notes: `Bundle: ${bundle.name}`
      });

      // Add games to user library
      const newLibrary = [...new Set([...user.game_library, ...bundle.games.map(g => g.id)])];
      await base44.auth.updateMe({ game_library: newLibrary });

      // Track analytics
      await base44.analytics.track({
        eventName: 'bundle_purchased',
        properties: {
          bundle_name: bundle.name,
          game_count: bundle.games.length,
          price: bundle.discounted_price
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-library-bundles']);
      toast.success('Bundle purchased successfully!');
    }
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-6 h-6 text-purple-600" />
            Personalized Game Bundles
          </CardTitle>
          <Button
            onClick={() => generateBundlesMutation.mutate()}
            disabled={generatingBundles}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {generatingBundles ? 'Generating...' : 'Generate Bundles'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {bundles.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No bundles generated yet</p>
            <p className="text-sm text-gray-400">Click "Generate Bundles" to see personalized game packs!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {bundles.map((bundle, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{bundle.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{bundle.description}</p>
                      </div>
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
                        <Percent className="w-3 h-3 mr-1" />
                        {bundle.discount_percentage}% OFF
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Games in Bundle */}
                    <div className="space-y-2">
                      {bundle.games.map(game => (
                        <div key={game.id} className="flex items-center gap-2 text-sm">
                          {game.icon_url && (
                            <img src={game.icon_url} alt={game.title} className="w-8 h-8 rounded" />
                          )}
                          <Link to={createPageUrl('GameDetail') + `?id=${game.id}`}>
                            <span className="hover:underline">{game.title}</span>
                          </Link>
                        </div>
                      ))}
                    </div>

                    {/* Pricing */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500 line-through">
                          ${bundle.original_price.toFixed(2)}
                        </span>
                        <span className="text-2xl font-bold text-purple-600">
                          ${bundle.discounted_price.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-sm text-green-600 font-medium mb-3">
                        Save ${bundle.savings.toFixed(2)}!
                      </p>
                      <Button
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                        onClick={() => purchaseBundleMutation.mutate(bundle)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy Bundle
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}