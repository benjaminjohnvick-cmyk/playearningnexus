import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FlaskConical, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ABTestingTools({ businessClient, games }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: abTests = [] } = useQuery({
    queryKey: ['abTests', businessClient.id],
    queryFn: async () => {
      const gameIds = games.map(g => g.id);
      if (gameIds.length === 0) return [];
      const allTests = await base44.entities.ABTest.list();
      return allTests.filter(t => gameIds.includes(t.game_id));
    },
    enabled: games.length > 0
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">A/B Testing</h3>
          <p className="text-gray-600">Test and optimize game features and pricing</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600"
        >
          <FlaskConical className="w-4 h-4 mr-2" />
          Create Test
        </Button>
      </div>

      {/* Active Tests */}
      <div className="grid md:grid-cols-2 gap-6">
        {abTests.filter(t => t.is_active).map((test) => (
          <TestCard key={test.id} test={test} games={games} />
        ))}
      </div>

      {abTests.filter(t => t.is_active).length === 0 && (
        <Card className="p-12 text-center">
          <FlaskConical className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg mb-2">No active A/B tests</p>
          <p className="text-sm text-gray-400">Create your first test to start optimizing</p>
        </Card>
      )}

      {/* Completed Tests */}
      {abTests.filter(t => !t.is_active).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Completed Tests</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {abTests.filter(t => !t.is_active).map((test) => (
              <TestCard key={test.id} test={test} games={games} />
            ))}
          </div>
        </div>
      )}

      {showCreateForm && (
        <CreateTestForm
          businessClient={businessClient}
          games={games}
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['abTests'] });
            setShowCreateForm(false);
          }}
        />
      )}
    </div>
  );
}

function TestCard({ test, games }) {
  const game = games.find(g => g.id === test.game_id);
  const totalUsers = (test.users_variant_a || 0) + (test.users_variant_b || 0);
  const conversionA = test.conversion_rate_a || 0;
  const conversionB = test.conversion_rate_b || 0;
  const improvement = conversionA > 0 ? ((conversionB - conversionA) / conversionA * 100).toFixed(1) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">{test.test_name}</span>
          <Badge variant={test.is_active ? 'default' : 'outline'}>
            {test.is_active ? 'Active' : 'Completed'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{game?.title}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Variant A</p>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="font-bold">{test.users_variant_a || 0}</span>
            </div>
            <p className="text-sm font-medium text-blue-600 mt-1">
              {conversionA.toFixed(1)}% CR
            </p>
          </div>

          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Variant B</p>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="font-bold">{test.users_variant_b || 0}</span>
            </div>
            <p className="text-sm font-medium text-purple-600 mt-1">
              {conversionB.toFixed(1)}% CR
            </p>
          </div>
        </div>

        {test.winner && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-bold text-green-900">Winner: Variant {test.winner.toUpperCase()}</p>
              {improvement !== 0 && (
                <p className="text-xs text-green-700">
                  {improvement > 0 ? '+' : ''}{improvement}% improvement
                </p>
              )}
            </div>
          </div>
        )}

        {!test.winner && test.is_active && totalUsers > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <TrendingUp className="w-4 h-4" />
            {totalUsers} total participants
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateTestForm({ businessClient, games, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    game_id: '',
    test_name: '',
    variant_a: {},
    variant_b: {}
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.ABTest.create({
        developer_id: businessClient.id,
        ...formData,
        is_active: true
      });
    },
    onSuccess: () => {
      toast.success('A/B test created!');
      onSuccess?.();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.game_id || !formData.test_name) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create A/B Test</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Game *</Label>
            <select
              className="w-full border rounded-md p-2"
              value={formData.game_id}
              onChange={(e) => setFormData({...formData, game_id: e.target.value})}
              required
            >
              <option value="">Select game</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>{game.title}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Test Name *</Label>
            <Input
              value={formData.test_name}
              onChange={(e) => setFormData({...formData, test_name: e.target.value})}
              placeholder="e.g., Price Point Test"
              required
            />
          </div>

          <div>
            <Label>Variant A Configuration (JSON)</Label>
            <Textarea
              value={JSON.stringify(formData.variant_a)}
              onChange={(e) => {
                try {
                  setFormData({...formData, variant_a: JSON.parse(e.target.value || '{}')});
                } catch {}
              }}
              placeholder='{"price": 4.99}'
              rows={3}
            />
          </div>

          <div>
            <Label>Variant B Configuration (JSON)</Label>
            <Textarea
              value={JSON.stringify(formData.variant_b)}
              onChange={(e) => {
                try {
                  setFormData({...formData, variant_b: JSON.parse(e.target.value || '{}')});
                } catch {}
              }}
              placeholder='{"price": 9.99}'
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Test'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}