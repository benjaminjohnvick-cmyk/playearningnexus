import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, DollarSign, TrendingUp, Users, Star, MessageSquare, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export default function GameManagementPortal({ game, developer }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const queryClient = useQueryClient();

  const { data: metrics } = useQuery({
    queryKey: ['game-metrics', game?.id],
    queryFn: async () => {
      const engagement = await base44.entities.GameEngagement.filter({ game_id: game.id }, '-created_date', 100);
      const reviews = await base44.entities.GameReview.filter({ game_id: game.id });
      const transactions = await base44.entities.Transaction.filter({ game_id: game.id });
      
      const avgSession = engagement.reduce((sum, e) => sum + (e.session_duration || 0), 0) / engagement.length || 0;
      const retention = engagement.filter(e => e.return_visit).length / engagement.length * 100 || 0;
      
      return {
        totalRevenue: game.total_revenue || 0,
        totalInstalls: game.total_installs || 0,
        avgRating: game.average_rating || 0,
        totalReviews: reviews.length,
        avgSessionTime: avgSession,
        retentionRate: retention,
        engagement,
        reviews,
        transactions
      };
    },
    enabled: !!game
  });

  const { data: supportRequests = [] } = useQuery({
    queryKey: ['game-support', game?.id],
    queryFn: async () => {
      return await base44.entities.BugReport.filter({ game_id: game.id }, '-created_date');
    },
    enabled: !!game
  });

  const updateGameMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Game.update(game.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-games']);
      setEditing(false);
      toast.success('Game updated!');
    }
  });

  const respondToReviewMutation = useMutation({
    mutationFn: async ({ reviewId, response }) => {
      await base44.entities.GameReview.update(reviewId, {
        developer_response: response,
        response_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['game-metrics']);
      toast.success('Response posted!');
    }
  });

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{game.title}</CardTitle>
              <p className="text-blue-100 capitalize">{game.category}</p>
            </div>
            <Button variant="secondary" onClick={() => {
              setEditData(game);
              setEditing(true);
            }}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Details
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Performance Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <p className="text-3xl font-bold">${metrics?.totalRevenue.toFixed(0)}</p>
            <p className="text-sm text-gray-600">Total Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <p className="text-3xl font-bold">{metrics?.totalInstalls}</p>
            <p className="text-sm text-gray-600">Installs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Star className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
            <p className="text-3xl font-bold">{metrics?.avgRating.toFixed(1)}</p>
            <p className="text-sm text-gray-600">Avg Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <p className="text-3xl font-bold">{metrics?.retentionRate.toFixed(0)}%</p>
            <p className="text-sm text-gray-600">Retention</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">Reviews ({metrics?.totalReviews})</TabsTrigger>
          <TabsTrigger value="support">Support ({supportRequests.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {metrics?.reviews.map((review) => (
                  <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">{new Date(review.created_date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{review.review_text}</p>
                    {review.developer_response ? (
                      <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Developer Response</p>
                        <p className="text-sm text-blue-800">{review.developer_response}</p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input placeholder="Write a response..." id={`response-${review.id}`} className="text-sm" />
                        <Button size="sm" onClick={() => {
                          const response = document.getElementById(`response-${review.id}`).value;
                          respondToReviewMutation.mutate({ reviewId: review.id, response });
                        }}>
                          Reply
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {supportRequests.map((request) => (
                  <div key={request.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={request.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                        {request.status}
                      </Badge>
                      <span className="text-xs text-gray-500">{new Date(request.created_date).toLocaleDateString()}</span>
                    </div>
                    <p className="font-semibold text-sm mb-1">{request.title}</p>
                    <p className="text-sm text-gray-600">{request.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Engagement Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Session Time</span>
                    <span className="font-semibold">{Math.floor(metrics?.avgSessionTime / 60)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Sessions</span>
                    <span className="font-semibold">{metrics?.engagement.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Retention Rate</span>
                    <span className="font-semibold">{metrics?.retentionRate.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Install Fees</span>
                    <span className="font-semibold">${metrics?.transactions.filter(t => t.transaction_type === 'install_fee').reduce((sum, t) => sum + t.amount, 0).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">In-App Purchases</span>
                    <span className="font-semibold">${metrics?.transactions.filter(t => t.transaction_type === 'in_app_purchase').reduce((sum, t) => sum + t.amount, 0).toFixed(0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Game Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input value={editData.title} onChange={(e) => setEditData({...editData, title: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea value={editData.description} onChange={(e) => setEditData({...editData, description: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Price ($)</label>
              <Input type="number" step="0.01" value={editData.price} onChange={(e) => setEditData({...editData, price: parseFloat(e.target.value)})} />
            </div>
            <Button className="w-full" onClick={() => updateGameMutation.mutate(editData)}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}