import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, TrendingUp, Sparkles, Ticket, Image } from 'lucide-react';
import RevenueAnalytics from '../components/developer/RevenueAnalytics';
import AIPricingStrategy from '../components/developer/AIPricingStrategy';
import PromoCodeManager from '../components/developer/PromoCodeManager';
import DynamicPricingAI from '../components/developer/DynamicPricingAI';
import PromotionalContentGenerator from '../components/developer/PromotionalContentGenerator';

export default function MonetizationHub() {
  const [user, setUser] = useState(null);
  const [businessClient, setBusinessClient] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        const clients = await base44.entities.BusinessClient.filter({ owner_user_id: currentUser.id });
        if (clients.length > 0) {
          setBusinessClient(clients[0]);
        }
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchData();
  }, []);

  const { data: games = [] } = useQuery({
    queryKey: ['developerGames', businessClient?.id],
    queryFn: () => base44.entities.Game.filter({ developer_id: businessClient.id }),
    enabled: !!businessClient
  });

  if (!user || !businessClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl('BusinessDashboard')}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Monetization Hub</h1>
          <p className="text-gray-600">Advanced analytics, AI insights, and revenue optimization tools</p>
        </div>

        {games.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed">
            <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No games yet. Upload a game to access monetization tools.</p>
            <Link to={createPageUrl('BusinessDashboard')}>
              <Button>Upload Game</Button>
            </Link>
          </div>
        ) : (
          <Tabs defaultValue="analytics" className="space-y-6">
            <TabsList className="bg-white shadow-md">
              <TabsTrigger value="analytics" className="text-base">
                <TrendingUp className="w-4 h-4 mr-2" />
                Revenue Analytics
              </TabsTrigger>
              <TabsTrigger value="dynamic-pricing" className="text-base">
                <DollarSign className="w-4 h-4 mr-2" />
                Dynamic Pricing AI
              </TabsTrigger>
              <TabsTrigger value="pricing" className="text-base">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Pricing
              </TabsTrigger>
              <TabsTrigger value="promos" className="text-base">
                <Ticket className="w-4 h-4 mr-2" />
                Promo Codes
              </TabsTrigger>
              <TabsTrigger value="content" className="text-base">
                <Image className="w-4 h-4 mr-2" />
                Promotional Content
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analytics">
              <RevenueAnalytics games={games} developerId={businessClient.id} />
            </TabsContent>

            <TabsContent value="dynamic-pricing">
              <div className="space-y-6">
                {games.map(game => (
                  <DynamicPricingAI key={game.id} game={game} developerId={businessClient.id} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="pricing">
              <div className="space-y-6">
                {games.map(game => (
                  <AIPricingStrategy key={game.id} game={game} developerId={businessClient.id} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="promos">
              <PromoCodeManager games={games} developerId={businessClient.id} />
            </TabsContent>

            <TabsContent value="content">
              <div className="space-y-6">
                {games.map(game => (
                  <PromotionalContentGenerator key={game.id} game={game} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}