import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Plus, TrendingUp, DollarSign, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import IAPItemForm from '../components/developer/IAPItemForm';
import IAPAnalytics from '../components/developer/IAPAnalytics';
import DynamicPricingPanel from '../components/developer/DynamicPricingPanel';

export default function DeveloperIAPDashboard() {
  const [user, setUser] = useState(null);
  const [businessClient, setBusinessClient] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchData = async () => {
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
    fetchData();
  }, []);

  const { data: games = [] } = useQuery({
    queryKey: ['developerGames', businessClient?.id],
    queryFn: () => base44.entities.Game.filter({ developer_id: businessClient.id }),
    enabled: !!businessClient
  });

  const { data: items = [] } = useQuery({
    queryKey: ['iapItems', businessClient?.id],
    queryFn: async () => {
      const gameIds = games.map(g => g.id);
      if (gameIds.length === 0) return [];
      const allItems = await base44.entities.InAppPurchase.list();
      return allItems.filter(item => gameIds.includes(item.game_id));
    },
    enabled: games.length > 0
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['iapTransactions', businessClient?.id],
    queryFn: async () => {
      const gameIds = games.map(g => g.id);
      if (gameIds.length === 0) return [];
      const allTransactions = await base44.entities.Transaction.filter({
        transaction_type: 'in_app_purchase'
      });
      return allTransactions.filter(t => gameIds.includes(t.game_id));
    },
    enabled: games.length > 0
  });

  if (!user || !businessClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const totalRevenue = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalSales = transactions.filter(t => t.status === 'completed').length;
  const activeItems = items.filter(i => i.is_active).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              In-App Purchase Dashboard
            </h1>
            <p className="text-gray-600">Manage and optimize your in-app purchases</p>
          </div>
          <div className="flex gap-3">
            <Link to={createPageUrl('BusinessDashboard')}>
              <Button variant="outline">
                Back to Dashboard
              </Button>
            </Link>
            <Button
              onClick={() => {
                setEditingItem(null);
                setShowItemForm(true);
              }}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Item
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
                </div>
                <DollarSign className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Sales</p>
                  <p className="text-2xl font-bold">{totalSales}</p>
                </div>
                <ShoppingBag className="w-10 h-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Items</p>
                  <p className="text-2xl font-bold">{activeItems}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Avg Purchase</p>
                  <p className="text-2xl font-bold">
                    ${totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : '0.00'}
                  </p>
                </div>
                <Users className="w-10 h-10 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Item Form Modal */}
        {showItemForm && (
          <IAPItemForm
            item={editingItem}
            games={games}
            onClose={() => {
              setShowItemForm(false);
              setEditingItem(null);
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['iapItems'] });
              setShowItemForm(false);
              setEditingItem(null);
            }}
          />
        )}

        {/* Tabs */}
        <Tabs defaultValue="items" className="space-y-6">
          <TabsList>
            <TabsTrigger value="items">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Items
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <Zap className="w-4 h-4 mr-2" />
              Dynamic Pricing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <ItemsList 
              items={items} 
              games={games}
              onEdit={(item) => {
                setEditingItem(item);
                setShowItemForm(true);
              }}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <IAPAnalytics items={items} transactions={transactions} games={games} />
          </TabsContent>

          <TabsContent value="pricing">
            <DynamicPricingPanel 
              businessClient={businessClient}
              games={games}
              items={items}
              transactions={transactions}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ItemsList({ items, games, onEdit }) {
  if (items.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 text-lg mb-2">No items created yet</p>
        <p className="text-sm text-gray-400">Create your first in-app purchase item</p>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => {
        const game = games.find(g => g.id === item.game_id);
        return (
          <Card key={item.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-bold text-lg">{item.item_name}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(item)}
                >
                  Edit
                </Button>
              </div>
              <p className="text-sm text-gray-600 mb-3">{game?.title}</p>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold text-purple-600">
                  ${item.price.toFixed(2)}
                </span>
                <span className="text-sm text-gray-500 capitalize">{item.item_type}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{item.total_purchases || 0} sales</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {item.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}