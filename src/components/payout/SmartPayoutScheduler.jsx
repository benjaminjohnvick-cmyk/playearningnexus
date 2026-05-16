import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SmartPayoutScheduler({ userId }) {
  const [upcomingBills, setUpcomingBills] = useState([]);
  const [billInput, setBillInput] = useState({ name: '', amount: '', dueDate: '' });

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ['wishlist', userId],
    queryFn: () => base44.entities.ProductWishlistItem.filter({ user_id: userId, status: 'active' }),
    enabled: !!userId,
  });

  const { data: recommendation, isLoading } = useQuery({
    queryKey: ['payoutRecommendation', userId, upcomingBills],
    queryFn: () => base44.functions.invoke('aiPayoutSchedulerEngine', {
      upcoming_bills: upcomingBills,
      wishlist_items: wishlistItems,
    }),
    enabled: !!userId && upcomingBills.length > 0,
  });

  const acceptMutation = useMutation({
    mutationFn: () => base44.entities.PayoutRecommendation.update(recommendation?.recommendation_id, {
      status: 'accepted'
    }),
    onSuccess: () => {
      toast.success('✅ Payout scheduled for ' + recommendation?.recommended_date);
    }
  });

  const handleAddBill = () => {
    if (billInput.name && billInput.amount && billInput.dueDate) {
      setUpcomingBills([...upcomingBills, {
        name: billInput.name,
        amount: parseFloat(billInput.amount),
        due_date: billInput.dueDate
      }]);
      setBillInput({ name: '', amount: '', dueDate: '' });
    }
  };

  if (!userId) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Smart Payout Scheduler
          </CardTitle>
          <CardDescription>AI-powered payout timing based on your bills & earnings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Bills */}
          <div className="bg-slate-50 p-4 rounded-lg space-y-3">
            <h4 className="font-semibold text-sm">Add Upcoming Bills</h4>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Bill name"
                value={billInput.name}
                onChange={(e) => setBillInput({...billInput, name: e.target.value})}
                className="px-3 py-2 border rounded text-sm"
              />
              <input
                type="number"
                placeholder="Amount ($)"
                value={billInput.amount}
                onChange={(e) => setBillInput({...billInput, amount: e.target.value})}
                className="px-3 py-2 border rounded text-sm"
              />
              <input
                type="date"
                value={billInput.dueDate}
                onChange={(e) => setBillInput({...billInput, dueDate: e.target.value})}
                className="px-3 py-2 border rounded text-sm"
              />
            </div>
            <Button onClick={handleAddBill} size="sm" variant="outline">Add Bill</Button>
          </div>

          {/* Bills List */}
          {upcomingBills.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Bills to Cover</h4>
              {upcomingBills.map((bill, idx) => (
                <div key={idx} className="flex justify-between text-sm p-2 bg-blue-50 rounded">
                  <span>{bill.name}</span>
                  <span className="font-semibold">${bill.amount.toFixed(2)} due {new Date(bill.due_date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* AI Recommendation */}
          {isLoading && <p className="text-sm text-gray-500">Analyzing your earnings & bills...</p>}

          {recommendation && (
            <Alert className="bg-emerald-50 border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-900">
                <div className="space-y-2">
                  <div className="font-semibold">Recommended Payout: ${recommendation.recommended_amount.toFixed(2)}</div>
                  <div className="text-sm">📅 Best date: {new Date(recommendation.recommended_date).toLocaleDateString()}</div>
                  <div className="text-sm">💡 {recommendation.reasoning}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4" />
                    Confidence: {recommendation.confidence_score}%
                  </div>
                  <Button
                    onClick={() => acceptMutation.mutate()}
                    disabled={acceptMutation.isPending}
                    className="mt-3 w-full"
                  >
                    Accept Recommendation
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}