import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, MessageSquare, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function GameGroups({ user }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', game_id: '' });
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ['game-groups'],
    queryFn: async () => {
      return await base44.entities.Guild.filter({ guild_type: 'game_group' }, '-created_date');
    }
  });

  const { data: myGroups = [] } = useQuery({
    queryKey: ['my-groups', user?.id],
    queryFn: async () => {
      return await base44.entities.Guild.filter({
        guild_type: 'game_group',
        members: { $contains: user.id }
      });
    },
    enabled: !!user
  });

  const createGroupMutation = useMutation({
    mutationFn: async (groupData) => {
      return await base44.entities.Guild.create({
        ...groupData,
        guild_type: 'game_group',
        leader_id: user.id,
        members: [user.id],
        member_count: 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['game-groups']);
      setShowCreateModal(false);
      setNewGroup({ name: '', description: '', game_id: '' });
      toast.success('Group created!');
    }
  });

  const joinGroupMutation = useMutation({
    mutationFn: async (groupId) => {
      const group = groups.find(g => g.id === groupId);
      await base44.entities.Guild.update(groupId, {
        members: [...(group.members || []), user.id],
        member_count: (group.member_count || 0) + 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['game-groups']);
      queryClient.invalidateQueries(['my-groups']);
      toast.success('Joined group!');
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Game Groups</h2>
        <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600">
          <Plus className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </div>

      {/* My Groups */}
      {myGroups.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">My Groups</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {myGroups.map((group) => (
              <Card key={group.id} className="border-2 border-purple-500">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{group.name}</span>
                    {group.leader_id === user.id && (
                      <Crown className="w-5 h-5 text-yellow-500" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">{group.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {group.member_count} members
                    </Badge>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Chat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Groups */}
      <div>
        <h3 className="font-semibold mb-3">Discover Groups</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {groups.filter(g => !myGroups.some(mg => mg.id === g.id)).map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="text-lg">{group.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">{group.description}</p>
                <div className="flex items-center justify-between">
                  <Badge className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {group.member_count}
                  </Badge>
                  <Button size="sm" onClick={() => joinGroupMutation.mutate(group.id)}>
                    Join
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create Group Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Group Name</label>
              <Input
                placeholder="Puzzle Masters"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                placeholder="A group for puzzle game enthusiasts..."
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createGroupMutation.mutate(newGroup)}
              disabled={!newGroup.name}
            >
              Create Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}