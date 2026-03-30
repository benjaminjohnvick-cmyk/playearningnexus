import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function SquadCreate({ onSquadCreated }) {
  const [squadName, setSquadName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('createReferralSquad', {
        squad_name: squadName,
        description,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`✓ Squad "${data.squad.squad_name}" created!`);
      onSquadCreated?.(data.squad);
      setSquadName('');
      setDescription('');
    },
    onError: () => {
      toast.error('Failed to create squad');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Create a Squad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-semibold block mb-2">Squad Name</label>
          <input
            type="text"
            value={squadName}
            onChange={(e) => setSquadName(e.target.value)}
            placeholder="e.g., Alpha Grinders"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="text-sm font-semibold block mb-2">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's your squad about?"
            className="w-full px-3 py-2 border rounded-lg h-20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!squadName || createMutation.isPending}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Squad'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}