import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Plus, Edit2, Users, DollarSign, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const DEFAULT_TIERS = [
  { name: 'Fan', price: 4.99, perks: ['Early access to content', 'Exclusive badge'], color: 'bg-blue-100 text-blue-800' },
  { name: 'Supporter', price: 9.99, perks: ['All Fan perks', 'Monthly 1:1 chat', 'Behind-the-scenes'], color: 'bg-purple-100 text-purple-800' },
  { name: 'VIP', price: 24.99, perks: ['All Supporter perks', 'Custom shoutout', 'Priority support'], color: 'bg-yellow-100 text-yellow-800' },
];

export default function ExclusiveSubscriptions({ user }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newTier, setNewTier] = useState({ name: '', price: '', perks: '' });

  const { data: tiers = [] } = useQuery({
    queryKey: ['subTiers', user?.id],
    queryFn: () => base44.entities.CreatorSubscriptionTier.filter({ creator_user_id: user.id }),
    enabled: !!user,
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.CreatorSubscriptionTier.create({
      creator_user_id: user.id,
      tier_name: newTier.name,
      price: parseFloat(newTier.price),
      perks: newTier.perks.split(',').map(p => p.trim()).filter(Boolean),
      is_active: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['subTiers', user?.id]);
      setShowForm(false);
      setNewTier({ name: '', price: '', perks: '' });
      toast.success('Subscription tier created!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CreatorSubscriptionTier.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['subTiers', user?.id]),
  });

  const displayTiers = tiers.length > 0 ? tiers : DEFAULT_TIERS;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="w-5 h-5 text-purple-600" />
          Subscription Tiers
          <Button size="sm" variant="outline" className="ml-auto text-xs" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add Tier
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="bg-purple-50 rounded-lg p-3 space-y-2 border border-purple-200">
            <p className="text-xs font-medium text-purple-700">New Subscription Tier</p>
            <Input placeholder="Tier name (e.g. Gold)" value={newTier.name} onChange={e => setNewTier({ ...newTier, name: e.target.value })} className="text-sm" />
            <Input type="number" placeholder="Price per month ($)" value={newTier.price} onChange={e => setNewTier({ ...newTier, price: e.target.value })} className="text-sm" />
            <Input placeholder="Perks (comma separated)" value={newTier.perks} onChange={e => setNewTier({ ...newTier, perks: e.target.value })} className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="bg-purple-600 hover:bg-purple-700 flex-1">Create</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {displayTiers.map((tier, i) => (
          <div key={tier.id || i} className="flex items-start justify-between p-3 rounded-lg border bg-gray-50">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge className={tier.color || 'bg-gray-100 text-gray-700'}>{tier.name || tier.tier_name}</Badge>
                <span className="font-bold text-green-700 text-sm">${(tier.price || 0).toFixed(2)}/mo</span>
              </div>
              <div className="space-y-0.5">
                {(tier.perks || []).map((perk, j) => (
                  <p key={j} className="text-xs text-gray-600">✓ {perk}</p>
                ))}
              </div>
              <p className="text-xs text-purple-600 font-medium mt-1.5">
                You earn: ${((tier.price || 0) * 0.85).toFixed(2)}/subscriber (85%)
              </p>
            </div>
            {tier.id && (
              <button onClick={() => deleteMutation.mutate(tier.id)} className="text-gray-300 hover:text-red-500 ml-2">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        <div className="bg-purple-50 rounded-lg p-3 text-xs text-gray-600 border border-purple-100">
          <p className="font-semibold text-purple-700 mb-1">Revenue Model</p>
          <p>You keep <strong>85%</strong> of all subscription revenue. Platform takes 15% for processing & hosting.</p>
        </div>
      </CardContent>
    </Card>
  );
}