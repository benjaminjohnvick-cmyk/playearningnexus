import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Send, ArrowRightLeft, Loader2, Users, Bell, Check, X, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function MoneyTransfer() {
  const [user, setUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

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

  // Fetch approved transfer contacts
  const { data: approvedContacts = [] } = useQuery({
    queryKey: ['transfer-contacts', user?.id],
    queryFn: async () => {
      const requests = await base44.entities.TransferRequest.filter({
        requester_user_id: user.id,
        status: 'approved'
      });
      
      const allUsers = await base44.entities.User.list();
      return requests.map(req => {
        const contactUser = allUsers.find(u => u.id === req.requested_user_id);
        return contactUser;
      }).filter(Boolean);
    },
    enabled: !!user
  });

  // Fetch pending requests I sent
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pending-requests', user?.id],
    queryFn: async () => {
      return await base44.entities.TransferRequest.filter({
        requester_user_id: user.id,
        status: 'pending'
      });
    },
    enabled: !!user
  });

  // Fetch pending requests I received
  const { data: incomingRequests = [] } = useQuery({
    queryKey: ['incoming-requests', user?.id],
    queryFn: async () => {
      const requests = await base44.entities.TransferRequest.filter({
        requested_user_id: user.id,
        status: 'pending'
      });
      
      const allUsers = await base44.entities.User.list();
      return requests.map(req => ({
        ...req,
        requester: allUsers.find(u => u.id === req.requester_user_id)
      }));
    },
    enabled: !!user
  });

  // Search all users
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      return await base44.entities.User.list();
    }
  });

  const filteredUsers = allUsers.filter(u => 
    u.id !== user?.id && 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const requestAccessMutation = useMutation({
    mutationFn: async (targetUser) => {
      // Check if request already exists
      const existing = await base44.entities.TransferRequest.filter({
        requester_user_id: user.id,
        requested_user_id: targetUser.id
      });

      if (existing.length > 0) {
        throw new Error('Request already sent to this user');
      }

      await base44.entities.TransferRequest.create({
        requester_user_id: user.id,
        requested_user_id: targetUser.id,
        status: 'pending',
        message: `${user.full_name} wants to add you to their transfer list`
      });

      await base44.entities.Notification.create({
        user_id: targetUser.id,
        type: 'referral_earnings',
        title: 'Transfer Request',
        message: `${user.full_name} wants to add you to their money transfer contacts`,
        action_url: '/MoneyTransfer'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-requests']);
      toast.success('Request sent!');
      setSearchQuery('');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleRequestMutation = useMutation({
    mutationFn: async ({ requestId, approved }) => {
      await base44.entities.TransferRequest.update(requestId, {
        status: approved ? 'approved' : 'rejected'
      });

      if (approved) {
        const request = incomingRequests.find(r => r.id === requestId);
        await base44.entities.Notification.create({
          user_id: request.requester_user_id,
          type: 'referral_earnings',
          title: 'Transfer Request Approved',
          message: `${user.full_name} approved your transfer request`,
          action_url: '/MoneyTransfer'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['incoming-requests']);
      queryClient.invalidateQueries(['transfer-contacts']);
      toast.success('Request handled');
    }
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const transferAmount = parseFloat(amount);
      
      if (!selectedUser || !transferAmount) {
        throw new Error('Please select a recipient and amount');
      }

      if (transferAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (transferAmount > user.current_balance) {
        throw new Error('Insufficient balance');
      }

      const receiver = selectedUser;

      // Deduct from sender
      await base44.auth.updateMe({
        current_balance: user.current_balance - transferAmount
      });

      // Add to receiver
      const receiverCurrentBalance = receiver.current_balance || 0;
      await base44.entities.User.update(receiver.id, {
        current_balance: receiverCurrentBalance + transferAmount
      });

      // Create transfer record
      await base44.entities.MoneyTransfer.create({
        sender_user_id: user.id,
        receiver_user_id: receiver.id,
        receiver_email: receiver.email,
        amount: transferAmount,
        status: 'completed',
        note: note || ''
      });

      // Create transaction records
      await base44.entities.Transaction.create({
        user_id: user.id,
        amount: -transferAmount,
        transaction_type: 'transfer_sent',
        status: 'completed',
        description: `Sent $${transferAmount.toFixed(2)} to ${receiver.full_name}`
      });

      await base44.entities.Transaction.create({
        user_id: receiver.id,
        amount: transferAmount,
        transaction_type: 'transfer_received',
        status: 'completed',
        description: `Received $${transferAmount.toFixed(2)} from ${user.full_name}`
      });

      // Create notification for receiver
      await base44.entities.Notification.create({
        user_id: receiver.id,
        type: 'purchase_complete',
        title: 'Money Received',
        message: `You received $${transferAmount.toFixed(2)} from ${user.full_name}${note ? `: ${note}` : ''}`,
        action_url: '/MoneyTransfer',
        icon: 'DollarSign'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Money transferred successfully!');
      setSelectedUser(null);
      setAmount('');
      setNote('');
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <ArrowRightLeft className="w-10 h-10 text-green-600" />
            Transfer Money
          </h1>
          <p className="text-gray-600">Send money from your survey earnings to other users</p>
        </div>

        <Card className="mb-6 border-2 border-green-500">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Available Balance</p>
              <p className="text-4xl font-bold text-green-600">
                ${(user.current_balance || 0).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="send" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="send">Send Money</TabsTrigger>
            <TabsTrigger value="contacts">
              <Users className="w-4 h-4 mr-2" />
              Contacts ({approvedContacts.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              <Bell className="w-4 h-4 mr-2" />
              Requests ({incomingRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send">
            <Card>
              <CardHeader>
                <CardTitle>Send Money</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Select Recipient</Label>
                  {selectedUser ? (
                    <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{selectedUser.full_name}</p>
                        <p className="text-sm text-gray-600">{selectedUser.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUser(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {approvedContacts.length > 0 ? (
                        <>
                          <p className="text-sm text-gray-600">Choose from your contacts:</p>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {approvedContacts.map((contact) => (
                              <div
                                key={contact.id}
                                className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer"
                                onClick={() => setSelectedUser(contact)}
                              >
                                <p className="font-medium text-gray-900">{contact.full_name}</p>
                                <p className="text-sm text-gray-600">{contact.email}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600">No approved contacts yet</p>
                          <p className="text-sm text-gray-500">Add users from the Contacts tab</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedUser && (
                  <>
                    <div>
                      <Label htmlFor="amount">Amount ($)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          className="pl-10"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Max: ${(user.current_balance || 0).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="note">Note (Optional)</Label>
                      <Textarea
                        id="note"
                        placeholder="Add a message..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => transferMutation.mutate()}
                      disabled={transferMutation.isPending}
                    >
                      {transferMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Transferring...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send ${amount || '0.00'}
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card>
              <CardHeader>
                <CardTitle>Add New Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search users by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                {searchQuery && (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredUsers.map((targetUser) => {
                      const alreadyRequested = pendingRequests.some(r => r.requested_user_id === targetUser.id);
                      const alreadyApproved = approvedContacts.some(c => c.id === targetUser.id);

                      return (
                        <div key={targetUser.id} className="p-3 border rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{targetUser.full_name}</p>
                            <p className="text-sm text-gray-600">{targetUser.email}</p>
                          </div>
                          {alreadyApproved ? (
                            <Badge className="bg-green-600">Approved</Badge>
                          ) : alreadyRequested ? (
                            <Badge className="bg-yellow-600">Pending</Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => requestAccessMutation.mutate(targetUser)}
                              disabled={requestAccessMutation.isPending}
                            >
                              <UserPlus className="w-4 h-4 mr-2" />
                              Request
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Your Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                {approvedContacts.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No contacts yet</p>
                ) : (
                  <div className="space-y-2">
                    {approvedContacts.map((contact) => (
                      <div key={contact.id} className="p-3 border rounded-lg">
                        <p className="font-medium text-gray-900">{contact.full_name}</p>
                        <p className="text-sm text-gray-600">{contact.email}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Pending Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {incomingRequests.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending requests</p>
                ) : (
                  <div className="space-y-3">
                    {incomingRequests.map((request) => (
                      <div key={request.id} className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-bold text-gray-900">{request.requester?.full_name}</p>
                            <p className="text-sm text-gray-600">{request.requester?.email}</p>
                            <p className="text-sm text-gray-700 mt-1">{request.message}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => handleRequestMutation.mutate({ requestId: request.id, approved: true })}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            className="flex-1"
                            variant="outline"
                            onClick={() => handleRequestMutation.mutate({ requestId: request.id, approved: false })}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}