import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Ticket, Plus, Copy, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function PromoCodeManager({ games, developerId }) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    game_id: '',
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    max_uses: 100,
    expiry_date: ''
  });

  const queryClient = useQueryClient();

  const { data: promoCodes = [] } = useQuery({
    queryKey: ['promoCodes', developerId],
    queryFn: () => base44.entities.PromoCode.filter({ developer_id: developerId })
  });

  const createPromoMutation = useMutation({
    mutationFn: (data) => base44.entities.PromoCode.create({
      ...data,
      developer_id: developerId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['promoCodes']);
      setIsCreating(false);
      setFormData({
        game_id: '',
        code: '',
        discount_type: 'percentage',
        discount_value: 10,
        max_uses: 100,
        expiry_date: ''
      });
      toast.success('Promo code created successfully!');
    }
  });

  const deletePromoMutation = useMutation({
    mutationFn: (id) => base44.entities.PromoCode.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['promoCodes']);
      toast.success('Promo code deleted');
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.PromoCode.update(id, { is_active: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries(['promoCodes']);
    }
  });

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setFormData({ ...formData, code });
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.game_id || !formData.code || !formData.discount_value) {
      toast.error('Please fill in all required fields');
      return;
    }
    createPromoMutation.mutate(formData);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-blue-600" />
            Promo Code Manager
          </CardTitle>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create Promo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Promo Code</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Game</Label>
                  <Select value={formData.game_id} onValueChange={(v) => setFormData({ ...formData, game_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select game" />
                    </SelectTrigger>
                    <SelectContent>
                      {games.map(game => (
                        <SelectItem key={game.id} value={game.id}>{game.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Promo Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="SUMMER2024"
                      maxLength={20}
                    />
                    <Button type="button" variant="outline" onClick={generateRandomCode}>
                      Generate
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Discount Type</Label>
                    <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Discount Value</Label>
                    <Input
                      type="number"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                      min="0"
                      max={formData.discount_type === 'percentage' ? 100 : undefined}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Max Uses</Label>
                    <Input
                      type="number"
                      value={formData.max_uses}
                      onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) })}
                      min="1"
                    />
                  </div>

                  <div>
                    <Label>Expiry Date</Label>
                    <Input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createPromoMutation.isPending}>
                  {createPromoMutation.isPending ? 'Creating...' : 'Create Promo Code'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {promoCodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No promo codes yet. Create your first discount code!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {promoCodes.map(promo => {
              const game = games.find(g => g.id === promo.game_id);
              const usagePercent = (promo.current_uses / promo.max_uses) * 100;
              const isExpired = promo.expiry_date && new Date(promo.expiry_date) < new Date();
              
              return (
                <Card key={promo.id} className={!promo.is_active || isExpired ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <code className="text-lg font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded">
                            {promo.code}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyToClipboard(promo.code)}
                            className="h-8 w-8"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-gray-600">{game?.title}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={promo.is_active ? 'outline' : 'default'}
                          onClick={() => toggleActiveMutation.mutate({ id: promo.id, isActive: promo.is_active })}
                        >
                          {promo.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deletePromoMutation.mutate(promo.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-600">Discount</p>
                        <p className="font-semibold text-green-600">
                          {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `$${promo.discount_value}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Usage</p>
                        <p className="font-semibold">{promo.current_uses} / {promo.max_uses}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Revenue</p>
                        <p className="font-semibold text-purple-600">${(promo.revenue_generated || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Expires</p>
                        <p className="font-semibold text-sm">
                          {promo.expiry_date ? new Date(promo.expiry_date).toLocaleDateString() : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{usagePercent.toFixed(0)}%</span>
                    </div>

                    {isExpired && (
                      <Badge variant="destructive" className="mt-2">Expired</Badge>
                    )}
                    {!promo.is_active && (
                      <Badge variant="secondary" className="mt-2">Inactive</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}