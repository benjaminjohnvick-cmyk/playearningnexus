import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, UserPlus, UserMinus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function SocialConnections({ userId, connections }) {
  const queryClient = useQueryClient();

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list()
  });

  const addFriendMutation = useMutation({
    mutationFn: async (friendId) => {
      await base44.entities.SocialConnection.create({
        user_id: userId,
        connection_user_id: friendId,
        connection_type: 'friend',
        status: 'pending'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userConnections'] });
      toast.success('Friend request sent!');
    }
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (connectionId) => {
      await base44.entities.SocialConnection.delete(connectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userConnections'] });
      toast.success('Friend removed');
    }
  });

  const friends = connections
    .filter(c => c.status === 'accepted')
    .map(c => allUsers.find(u => u.id === c.connection_user_id))
    .filter(Boolean);

  const pendingRequests = connections.filter(c => c.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Friends List */}
      <div>
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Friends ({friends.length})
        </h3>
        
        {friends.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {friends.map((friend) => {
              const connection = connections.find(c => c.connection_user_id === friend.id);
              return (
                <Card key={friend.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {friend.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Link to={createPageUrl('UserProfile') + `?user_id=${friend.id}`}>
                          <p className="font-semibold hover:text-blue-600">{friend.full_name}</p>
                        </Link>
                        <p className="text-xs text-gray-500">
                          ${(friend.total_earnings || 0).toFixed(2)} earned
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFriendMutation.mutate(connection.id)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No friends yet</p>
          </Card>
        )}
      </div>

      {/* Suggested Friends */}
      <div>
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Suggested Friends
        </h3>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allUsers
            .filter(u => 
              u.id !== userId && 
              !connections.some(c => c.connection_user_id === u.id)
            )
            .slice(0, 6)
            .map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-purple-100 text-purple-600">
                        {user.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{user.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {user.total_surveys_completed || 0} surveys
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFriendMutation.mutate(user.id)}
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}