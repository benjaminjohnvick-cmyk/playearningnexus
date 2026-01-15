import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingBag, CreditCard, FileText, Calendar, DollarSign } from 'lucide-react';
import moment from 'moment';

export default function MyPurchases() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: transactions = [] } = useQuery({
    queryKey: ['myPurchases', user?.id],
    queryFn: () => base44.entities.Transaction.filter({ user_id: user.id }, '-created_date'),
    enabled: !!user
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['mySubscriptions', user?.id],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user.id }),
    enabled: !!user
  });

  const inAppPurchases = transactions.filter(t => t.transaction_type === 'in_app_purchase');
  const gamePurchases = transactions.filter(t => t.transaction_type === 'game_purchase');
  const totalSpent = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            My Purchases
          </h1>
          <p className="text-gray-600">Track your purchase history and subscriptions</p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Spent</p>
                  <p className="text-2xl font-bold">${totalSpent.toFixed(2)}</p>
                </div>
                <DollarSign className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Purchases</p>
                  <p className="text-2xl font-bold">{transactions.length}</p>
                </div>
                <ShoppingBag className="w-10 h-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Subscriptions</p>
                  <p className="text-2xl font-bold">
                    {subscriptions.filter(s => s.is_active).length}
                  </p>
                </div>
                <Calendar className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">All Purchases</TabsTrigger>
            <TabsTrigger value="iap">In-App Purchases</TabsTrigger>
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <PurchaseList transactions={transactions} />
          </TabsContent>

          <TabsContent value="iap">
            <PurchaseList transactions={inAppPurchases} />
          </TabsContent>

          <TabsContent value="games">
            <PurchaseList transactions={gamePurchases} />
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionList subscriptions={subscriptions} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PurchaseList({ transactions }) {
  if (transactions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No purchases yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <Card key={transaction.id}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg">{transaction.description || 'Purchase'}</h3>
                  <Badge variant={transaction.status === 'completed' ? 'default' : 'outline'}>
                    {transaction.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {moment(transaction.created_date).format('MMM D, YYYY')}
                  </div>
                  <div className="flex items-center gap-1">
                    {transaction.payment_method === 'survey' ? (
                      <FileText className="w-4 h-4" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    {transaction.payment_method === 'survey' ? 'Survey Payment' : 'Credit Card'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-600">
                  ${(transaction.amount || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SubscriptionList({ subscriptions }) {
  if (subscriptions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No subscriptions yet</p>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {subscriptions.map((sub) => (
        <Card key={sub.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="capitalize">{sub.plan_type} Plan</span>
              <Badge variant={sub.is_active ? 'default' : 'outline'}>
                {sub.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600 mb-4">
              ${sub.price_monthly.toFixed(2)}/mo
            </p>
            <div className="space-y-2 mb-4">
              {sub.benefits?.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                  {benefit}
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-600 mb-4">
              <p>Started: {moment(sub.start_date).format('MMM D, YYYY')}</p>
              {sub.end_date && <p>Ends: {moment(sub.end_date).format('MMM D, YYYY')}</p>}
            </div>
            {sub.is_active && (
              <Button variant="outline" className="w-full">
                Manage Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}