import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function IAPItemForm({ item, games, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    game_id: item?.game_id || '',
    item_name: item?.item_name || '',
    item_type: item?.item_type || 'currency',
    description: item?.description || '',
    price: item?.price || 0,
    currency_amount: item?.currency_amount || 0,
    icon_url: item?.icon_url || '',
    is_active: item?.is_active !== undefined ? item.is_active : true
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (item) {
        return await base44.entities.InAppPurchase.update(item.id, formData);
      } else {
        return await base44.entities.InAppPurchase.create(formData);
      }
    },
    onSuccess: () => {
      toast.success(item ? 'Item updated!' : 'Item created!');
      onSuccess?.();
    },
    onError: (error) => {
      toast.error('Failed to save item');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.game_id || !formData.item_name || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    saveMutation.mutate();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : 'Create New Item'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Game *</Label>
            <Select value={formData.game_id} onValueChange={(value) => setFormData({...formData, game_id: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select game" />
              </SelectTrigger>
              <SelectContent>
                {games.map((game) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Item Name *</Label>
            <Input
              value={formData.item_name}
              onChange={(e) => setFormData({...formData, item_name: e.target.value})}
              placeholder="e.g., 1000 Gems"
              required
            />
          </div>

          <div>
            <Label>Item Type *</Label>
            <Select value={formData.item_type} onValueChange={(value) => setFormData({...formData, item_type: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="currency">Currency</SelectItem>
                <SelectItem value="powerup">Power-up</SelectItem>
                <SelectItem value="cosmetic">Cosmetic</SelectItem>
                <SelectItem value="unlock">Unlock</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe this item..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Price (USD) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                required
              />
            </div>

            {formData.item_type === 'currency' && (
              <div>
                <Label>Currency Amount</Label>
                <Input
                  type="number"
                  value={formData.currency_amount}
                  onChange={(e) => setFormData({...formData, currency_amount: parseInt(e.target.value) || 0})}
                />
              </div>
            )}
          </div>

          <div>
            <Label>Icon URL</Label>
            <Input
              value={formData.icon_url}
              onChange={(e) => setFormData({...formData, icon_url: e.target.value})}
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={saveMutation.isPending}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {saveMutation.isPending ? 'Saving...' : (item ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}