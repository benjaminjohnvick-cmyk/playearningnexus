import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Download, TrendingUp, Users, Plus, Upload, Bot, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StatsCard from '../components/dashboard/StatsCard';
import AppUploadForm from '../components/developer/AppUploadForm';
import MonetizationDashboard from '../components/developer/MonetizationDashboard';
import { toast } from "sonner";

export default function BusinessDashboard() {
  const [user, setUser] = useState(null);
  const [businessClient, setBusinessClient] = useState(null);
  const [showNewGameForm, setShowNewGameForm] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        const clients = await base44.entities.BusinessClient.filter({
          owner_user_id: currentUser.id
        });
        
        if (clients.length > 0) {
          setBusinessClient(clients[0]);
        }
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: myGames = [] } = useQuery({
    queryKey: ['my-games', businessClient?.id],
    queryFn: async () => {
      if (!businessClient) return [];
      return await base44.entities.Game.filter({
        developer_id: businessClient.id
      }, '-created_date');
    },
    enabled: !!businessClient
  });

  const createBusinessMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.BusinessClient.create({
        ...data,
        owner_user_id: user.id
      });
    },
    onSuccess: (data) => {
      setBusinessClient(data);
      toast.success('Business account created successfully!');
    }
  });

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries(['my-games']);
    setShowNewGameForm(false);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!businessClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 border-0 shadow-xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Business Account</h1>
            <p className="text-gray-600 mb-6">Set up your developer account to start submitting games</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              createBusinessMutation.mutate({
                company_name: formData.get('company_name'),
                contact_email: formData.get('contact_email'),
                contact_phone: formData.get('contact_phone'),
                paypal_email: formData.get('paypal_email')
              });
            }} className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input name="company_name" required placeholder="Your Game Studio" />
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input name="contact_email" type="email" required placeholder="contact@studio.com" />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input name="contact_phone" placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <Label>PayPal Email (for payments)</Label>
                <Input name="paypal_email" type="email" required placeholder="payments@studio.com" />
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-700" disabled={createBusinessMutation.isPending}>
                Create Business Account
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  const totalRevenue = myGames.reduce((sum, game) => sum + (game.total_revenue || 0), 0);
  const totalInstalls = myGames.reduce((sum, game) => sum + (game.total_installs || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="mb-4">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{businessClient.company_name}</h1>
            <p className="text-gray-600">Developer Dashboard</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={createPageUrl('MonetizationHub')}>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-700">
                <DollarSign className="w-4 h-4 mr-2" />
                Monetization Hub
              </Button>
            </Link>
            <Link to={createPageUrl('DeveloperAIDashboard')}>
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-700">
                <Zap className="w-4 h-4 mr-2" />
                AI Dashboard
              </Button>
            </Link>
            <Link to={createPageUrl('GameAnalyticsDashboard')}>
              <Button className="bg-gradient-to-r from-blue-600 to-cyan-700">
                <TrendingUp className="w-4 h-4 mr-2" />
                Analytics
              </Button>
            </Link>
            <Link to={createPageUrl('GameStore')}>
              <Button className="bg-gradient-to-r from-green-600 to-emerald-700">
                <DollarSign className="w-4 h-4 mr-2" />
                Game Store
              </Button>
            </Link>
            <Button
              onClick={() => setShowNewGameForm(!showNewGameForm)}
              className="bg-gradient-to-r from-red-600 to-red-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Submit New Game
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <StatsCard
            icon={DollarSign}
            label="Total Revenue"
            value={`$${totalRevenue.toFixed(2)}`}
            color="green"
          />
          <StatsCard
            icon={Download}
            label="Total Installs"
            value={totalInstalls}
            color="blue"
          />
          <StatsCard
            icon={TrendingUp}
            label="Games Submitted"
            value={myGames.length}
            color="purple"
          />
          <StatsCard
            icon={Users}
            label="Avg Rating"
            value={myGames.length > 0 ? (myGames.reduce((sum, g) => sum + (g.average_rating || 0), 0) / myGames.length).toFixed(1) : '0.0'}
            color="amber"
          />
        </div>

        {showNewGameForm && (
          <AppUploadForm 
            businessClient={businessClient}
            onSuccess={handleUploadSuccess}
            onCancel={() => setShowNewGameForm(false)}
          />
        )}

        <Tabs defaultValue="games" className="mb-8">
          <TabsList className="bg-white shadow-md border-2 border-red-200">
            <TabsTrigger value="games">My Games</TabsTrigger>
            <TabsTrigger value="monetization">
              <Zap className="w-4 h-4 mr-2" />
              AI Monetization
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monetization">
            <MonetizationDashboard businessClient={businessClient} games={myGames} />
          </TabsContent>

          <TabsContent value="games">
            <Card className="p-6 border-0 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Games</h2>
          {myGames.length > 0 ? (
            <div className="space-y-4">
              {myGames.map((game) => (
                <Card key={game.id} className="p-4 border">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-2xl">
                      {game.icon_url ? <img src={game.icon_url} alt={game.title} className="w-full h-full object-cover rounded-lg" /> : '🎮'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-lg">{game.title}</h3>
                          <p className="text-sm text-gray-600">{game.category}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          game.status === 'approved' ? 'bg-green-100 text-green-700' :
                          game.status === 'featured' ? 'bg-amber-100 text-amber-700' :
                          game.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {game.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Installs:</span>
                          <span className="font-medium ml-2">{game.total_installs || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Revenue:</span>
                          <span className="font-medium ml-2">${(game.total_revenue || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Rating:</span>
                          <span className="font-medium ml-2">{(game.average_rating || 0).toFixed(1)} ⭐</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Upload className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p>No games submitted yet</p>
              <p className="text-sm">Submit your first game to get started</p>
            </div>
          )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}