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
import { DollarSign, Download, TrendingUp, Users, Plus, Upload } from "lucide-react";
import StatsCard from '../components/dashboard/StatsCard';
import { toast } from "sonner";

export default function BusinessDashboard() {
  const [user, setUser] = useState(null);
  const [businessClient, setBusinessClient] = useState(null);
  const [showNewGameForm, setShowNewGameForm] = useState(false);
  const queryClient = useQueryClient();

  const [newGame, setNewGame] = useState({
    title: '',
    description: '',
    category: 'casual',
    platform: ['android', 'ios'],
    download_url: '',
    icon_url: '',
    screenshots: []
  });

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

  const createGameMutation = useMutation({
    mutationFn: async (gameData) => {
      return await base44.entities.Game.create({
        ...gameData,
        developer_id: businessClient.id,
        status: 'pending'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-games']);
      setShowNewGameForm(false);
      setNewGame({
        title: '',
        description: '',
        category: 'casual',
        platform: ['android', 'ios'],
        download_url: '',
        icon_url: '',
        screenshots: []
      });
      toast.success('Game submitted for review!');
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file) => {
      const result = await base44.integrations.Core.UploadFile({ file });
      return result.file_url;
    }
  });

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const url = await uploadImageMutation.mutateAsync(file);
      if (type === 'icon') {
        setNewGame({ ...newGame, icon_url: url });
      } else {
        setNewGame({ ...newGame, screenshots: [...newGame.screenshots, url] });
      }
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload image');
    }
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{businessClient.company_name}</h1>
            <p className="text-gray-600">Developer Dashboard</p>
          </div>
          <Button
            onClick={() => setShowNewGameForm(!showNewGameForm)}
            className="bg-gradient-to-r from-blue-600 to-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Submit New Game
          </Button>
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
          <Card className="p-6 mb-8 border-0 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit New Game</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              createGameMutation.mutate(newGame);
            }} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Game Title *</Label>
                  <Input
                    value={newGame.title}
                    onChange={(e) => setNewGame({ ...newGame, title: e.target.value })}
                    required
                    placeholder="Super Fun Game"
                  />
                </div>
                <div>
                  <Label>Category *</Label>
                  <Select value={newGame.category} onValueChange={(val) => setNewGame({ ...newGame, category: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="puzzle">Puzzle</SelectItem>
                      <SelectItem value="action">Action</SelectItem>
                      <SelectItem value="strategy">Strategy</SelectItem>
                      <SelectItem value="rpg">RPG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea
                  value={newGame.description}
                  onChange={(e) => setNewGame({ ...newGame, description: e.target.value })}
                  required
                  rows={4}
                  placeholder="Describe your game..."
                />
              </div>

              <div>
                <Label>Download URL *</Label>
                <Input
                  value={newGame.download_url}
                  onChange={(e) => setNewGame({ ...newGame, download_url: e.target.value })}
                  required
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label>Game Icon</Label>
                <div className="flex gap-4 items-center">
                  <Input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'icon')} />
                  {newGame.icon_url && (
                    <img src={newGame.icon_url} alt="Icon" className="w-16 h-16 rounded-lg object-cover" />
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={createGameMutation.isPending} className="bg-gradient-to-r from-blue-600 to-blue-700">
                  Submit Game for Review
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowNewGameForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

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
      </div>
    </div>
  );
}