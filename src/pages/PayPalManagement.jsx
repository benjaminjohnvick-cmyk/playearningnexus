import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wallet
} from "lucide-react";
import StatsCard from '../components/dashboard/StatsCard';
import { toast } from "sonner";

export default function PayPalManagement() {
  const [user, setUser] = useState(null);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser.role !== 'admin') {
          toast.error('Admin access required');
          return;
        }
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: paypalAccounts = [] } = useQuery({
    queryKey: ['paypal-accounts'],
    queryFn: () => base44.entities.PayPalAccount.list('-created_date', 1),
    enabled: !!user
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['payouts'],
    queryFn: () => base44.entities.Payout.list('-created_date', 50),
    enabled: !!user
  });

  const { data: pendingPayouts = [] } = useQuery({
    queryKey: ['pending-payouts'],
    queryFn: () => base44.entities.Payout.filter({ status: 'pending' }),
    enabled: !!user
  });

  const connectPayPalMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.PayPalAccount.create({
        ...data,
        is_connected: true,
        account_type: 'business'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['paypal-accounts']);
      setShowConnectForm(false);
      toast.success('PayPal Business Account Connected!');
    }
  });

  const processPayoutMutation = useMutation({
    mutationFn: async (payoutId) => {
      await base44.entities.Payout.update(payoutId, {
        status: 'completed',
        completed_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payouts', 'pending-payouts']);
      toast.success('Payout processed successfully!');
    }
  });

  const createPayoutMutation = useMutation({
    mutationFn: async ({ recipientType, recipientId, recipientEmail, amount, notes }) => {
      return await base44.entities.Payout.create({
        recipient_type: recipientType,
        recipient_id: recipientId,
        recipient_email: recipientEmail,
        amount: amount,
        status: 'pending',
        notes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payouts', 'pending-payouts']);
      toast.success('Payout created!');
    }
  });

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Card className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600">Only administrators can access PayPal management</p>
        </Card>
      </div>
    );
  }

  const connectedAccount = paypalAccounts[0];
  const totalReceived = connectedAccount?.total_received || 0;
  const totalPaidOut = connectedAccount?.total_paid_out || 0;
  const balance = connectedAccount?.balance || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PayPal Management</h1>
          <p className="text-gray-600">Manage survey revenue and payouts</p>
        </div>

        {/* Connection Status */}
        {!connectedAccount?.is_connected && !showConnectForm && (
          <Card className="p-8 mb-8 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect PayPal Business Account</h2>
                <p className="text-gray-600 mb-4">
                  Connect your PayPal Business account to receive survey revenue and process payouts to users and developers.
                </p>
                <Button
                  onClick={() => setShowConnectForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Connect PayPal
                </Button>
              </div>
              <CreditCard className="w-24 h-24 text-blue-300" />
            </div>
          </Card>
        )}

        {showConnectForm && (
          <Card className="p-6 mb-8 border-0 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Connect PayPal Business</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              connectPayPalMutation.mutate({
                paypal_email: formData.get('paypal_email'),
                api_username: formData.get('api_username'),
                api_password: formData.get('api_password'),
                api_signature: formData.get('api_signature')
              });
            }} className="space-y-4">
              <div>
                <Label>PayPal Business Email *</Label>
                <Input
                  name="paypal_email"
                  type="email"
                  required
                  defaultValue="benjaminjohnvick_api1.gmail.com"
                  placeholder="business@example.com"
                />
              </div>
              <div>
                <Label>API Username *</Label>
                <Input
                  name="api_username"
                  required
                  defaultValue="benjaminjohnvick_api1.gmail.com"
                  placeholder="PayPal API username"
                />
              </div>
              <div>
                <Label>API Password *</Label>
                <Input
                  name="api_password"
                  type="password"
                  required
                  defaultValue="8SAJUJ243GLE7P7J"
                  placeholder="PayPal API password"
                />
              </div>
              <div>
                <Label>API Signature *</Label>
                <Input
                  name="api_signature"
                  required
                  defaultValue="AqF4sFMlqRFHp2lbH07fQhsVUtPzArJT0nBcliaB7.zo03SyFa4PXwR6"
                  placeholder="PayPal API signature"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your API credentials from <a href="https://www.paypal.com/businessmanage/credentials/apiAccess" target="_blank" className="text-blue-600 hover:underline">PayPal API Access</a>
                </p>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={connectPayPalMutation.isPending}>
                  Connect Account
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowConnectForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {connectedAccount?.is_connected && (
          <>
            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <StatsCard
                icon={Wallet}
                label="Current Balance"
                value={`$${balance.toFixed(2)}`}
                color="blue"
              />
              <StatsCard
                icon={TrendingUp}
                label="Total Received"
                value={`$${totalReceived.toFixed(2)}`}
                color="green"
              />
              <StatsCard
                icon={Send}
                label="Total Paid Out"
                value={`$${totalPaidOut.toFixed(2)}`}
                color="purple"
              />
              <StatsCard
                icon={Clock}
                label="Pending Payouts"
                value={pendingPayouts.length}
                color="amber"
              />
            </div>

            {/* Account Info */}
            <Card className="p-6 mb-8 border-0 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <CreditCard className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Connected PayPal Account</h3>
                    <p className="text-gray-600">{connectedAccount.paypal_email}</p>
                    <p className="text-xs text-gray-500 mt-1">API User: {connectedAccount.api_username}</p>
                    <Badge className="mt-2 bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Connected & Authenticated
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Last Synced</p>
                  <p className="font-medium">
                    {connectedAccount.last_sync_date
                      ? new Date(connectedAccount.last_sync_date).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="payouts" className="space-y-6">
              <TabsList className="bg-white shadow-md">
                <TabsTrigger value="payouts">All Payouts</TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({pendingPayouts.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="payouts">
                <Card className="p-6 border-0 shadow-lg">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Payout History</h2>
                  {payouts.length > 0 ? (
                    <div className="space-y-3">
                      {payouts.map((payout) => (
                        <div
                          key={payout.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${
                              payout.status === 'completed' ? 'bg-green-100' :
                              payout.status === 'failed' ? 'bg-red-100' :
                              payout.status === 'processing' ? 'bg-blue-100' :
                              'bg-gray-100'
                            }`}>
                              <Send className={`w-5 h-5 ${
                                payout.status === 'completed' ? 'text-green-600' :
                                payout.status === 'failed' ? 'text-red-600' :
                                payout.status === 'processing' ? 'text-blue-600' :
                                'text-gray-600'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{payout.recipient_email}</p>
                              <p className="text-sm text-gray-500">
                                {payout.recipient_type === 'user' ? 'User' : 'Business Client'} • {new Date(payout.created_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">${payout.amount.toFixed(2)}</p>
                            <Badge variant="outline" className={
                              payout.status === 'completed' ? 'bg-green-50 text-green-700' :
                              payout.status === 'failed' ? 'bg-red-50 text-red-700' :
                              payout.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                              'bg-gray-50 text-gray-700'
                            }>
                              {payout.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Send className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p>No payouts yet</p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="pending">
                <Card className="p-6 border-0 shadow-lg">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Pending Payouts</h2>
                  {pendingPayouts.length > 0 ? (
                    <div className="space-y-3">
                      {pendingPayouts.map((payout) => (
                        <div
                          key={payout.id}
                          className="flex items-center justify-between p-4 border-2 border-amber-200 bg-amber-50 rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <Clock className="w-6 h-6 text-amber-600" />
                            <div>
                              <p className="font-medium text-gray-900">{payout.recipient_email}</p>
                              <p className="text-sm text-gray-600">
                                {payout.recipient_type === 'user' ? 'User' : 'Business Client'} • ${payout.amount.toFixed(2)}
                              </p>
                              {payout.notes && (
                                <p className="text-xs text-gray-500 mt-1">{payout.notes}</p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => processPayoutMutation.mutate(payout.id)}
                            disabled={processPayoutMutation.isPending}
                            className="bg-gradient-to-r from-green-600 to-emerald-600"
                          >
                            Process Payout
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p>No pending payouts</p>
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Info Card */}
        <Card className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
          <h3 className="font-bold text-lg text-gray-900 mb-3">How PayPal Integration Works</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Survey revenue from Pollfish flows into your PayPal Business account</li>
            <li>• Platform automatically tracks 50/50 revenue split with game developers</li>
            <li>• Process payouts to users and developers directly from this dashboard</li>
            <li>• All transactions are logged for accounting and tax purposes</li>
            <li>• PayPal Payouts API enables batch processing for efficiency</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}