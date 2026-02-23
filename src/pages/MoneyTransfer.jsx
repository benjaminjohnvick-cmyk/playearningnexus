import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DollarSign, Send, ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MoneyTransfer() {
  const [user, setUser] = useState(null);
  const [receiverEmail, setReceiverEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
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

  const transferMutation = useMutation({
    mutationFn: async () => {
      const transferAmount = parseFloat(amount);
      
      if (!receiverEmail || !transferAmount) {
        throw new Error('Please fill in all required fields');
      }

      if (transferAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (transferAmount > user.current_balance) {
        throw new Error('Insufficient balance');
      }

      // Find receiver by email
      const allUsers = await base44.entities.User.list();
      const receiver = allUsers.find(u => u.email === receiverEmail);

      if (!receiver) {
        throw new Error('User not found with that email');
      }

      if (receiver.id === user.id) {
        throw new Error('Cannot transfer to yourself');
      }

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
        receiver_email: receiverEmail,
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
        description: `Sent $${transferAmount.toFixed(2)} to ${receiverEmail}`
      });

      await base44.entities.Transaction.create({
        user_id: receiver.id,
        amount: transferAmount,
        transaction_type: 'transfer_received',
        status: 'completed',
        description: `Received $${transferAmount.toFixed(2)} from ${user.email}`
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
      setReceiverEmail('');
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

        <Card>
          <CardHeader>
            <CardTitle>Send Money</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter recipient's email"
                value={receiverEmail}
                onChange={(e) => setReceiverEmail(e.target.value)}
              />
            </div>

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
                  Send Money
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}