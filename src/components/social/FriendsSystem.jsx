import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, MessageSquare, Check, X, User, Gamepad2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function FriendsSystem({ currentUser }) {
  const [searchEmail, setSearchEmail] = useState('');
  const queryClient = useQueryClient();

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: async () => {
      const connections = await base44.entities.SocialConnection.filter({ user_id: currentUser.id });
      const friendIds = connections.map(c => c.friend_id);
      if (friendIds.length === 0) return [];
      return await base44.entities.User.filter({ id: { $in: friendIds } });
    },
    enabled: !!currentUser
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['friendRequests', currentUser?.id],
    queryFn: () => base44.entities.FriendRequest.filter({ 
      receiver_id: currentUser.id,
      status: 'pending'
    }),
    enabled: !!currentUser
  });

  const { data: sentRequests = [] } = useQuery({
    queryKey: ['sentRequests', currentUser?.id],
    queryFn: () => base44.entities.FriendRequest.filter({ 
      sender_id: currentUser.id,
      status: 'pending'
    }),
    enabled: !!currentUser
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (email) => {
      const users = await base44.entities.User.filter({ email });
      if (users.length === 0) throw new Error('User not found');
      
      const targetUser = users[0];
      if (targetUser.id === currentUser.id) throw new Error('Cannot add yourself');

      // Check if already friends
      const existing = await base44.entities.SocialConnection.filter({
        user_id: currentUser.id,
        friend_id: targetUser.id
      });
      if (existing.length > 0) throw new Error('Already friends');

      // Check if request already sent
      const existingRequest = await base44.entities.FriendRequest.filter({
        sender_id: currentUser.id,
        receiver_id: targetUser.id,
        status: 'pending'
      });
      if (existingRequest.length > 0) throw new Error('Request already sent');

      await base44.entities.FriendRequest.create({
        sender_id: currentUser.id,
        receiver_id: targetUser.id,
        status: 'pending'
      });

      await base44.entities.Notification.create({
        user_id: targetUser.id,
        title: 'New Friend Request',
        message: `${currentUser.full_name} sent you a friend request`,
        notification_type: 'friend_request',
        related_entity_id: currentUser.id
      });
    },
    onSuccess: () => {
      toast.success('Friend request sent!');
      setSearchEmail('');
      queryClient.invalidateQueries(['sentRequests']);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (request) => {
      await base44.entities.FriendRequest.update(request.id, { status: 'accepted' });

      // Create bidirectional connection
      await base44.entities.SocialConnection.create({
        user_id: currentUser.id,
        friend_id: request.sender_id,
        status: 'active'
      });

      await base44.entities.SocialConnection.create({
        user_id: request.sender_id,
        friend_id: currentUser.id,
        status: 'active'
      });

      await base44.entities.Notification.create({
        user_id: request.sender_id,
        title: 'Friend Request Accepted',
        message: `${currentUser.full_name} accepted your friend request`,
        notification_type: 'friend_accepted',
        related_entity_id: currentUser.id
      });
    },
    onSuccess: () => {
      toast.success('Friend request accepted!');
      queryClient.invalidateQueries(['friends']);
      queryClient.invalidateQueries(['friendRequests']);
    }
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId) => {
      await base44.entities.FriendRequest.update(requestId, { status: 'rejected' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['friendRequests']);
    }
  });

  // Get online status for friends (simplified - check if they have recent activity)
  const { data: friendStatuses = {} } = useQuery({
    queryKey: ['friendStatuses', friends],
    queryFn: async () => {
      const statuses = {};
      for (const friend of friends) {
        const recentActivity = await base44.entities.GameEngagement.filter(
          { user_id: friend.id },
          '-session_start',
          1
        );
        
        if (recentActivity.length > 0) {
          const lastActivity = new Date(recentActivity[0].session_start);
          const isOnline = Date.now() - lastActivity.getTime() < 300000; // 5 minutes
          statuses[friend.id] = {
            online: isOnline,
            playing: isOnline ? recentActivity[0].game_id : null
          };
        } else {
          statuses[friend.id] = { online: false, playing: null };
        }
      }
      return statuses;
    },
    enabled: friends.length > 0,
    refetchInterval: 30000
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Friend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
            />
            <Button 
              onClick={() => sendRequestMutation.mutate(searchEmail)}
              disabled={sendRequestMutation.isPending || !searchEmail}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Send Request
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Friends ({friends.length})</TabsTrigger>
          <TabsTrigger value="requests">Requests ({pendingRequests.length})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({sentRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-2">
          {friends.map(friend => {
            const status = friendStatuses[friend.id] || {};
            return (
              <Card key={friend.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={friend.avatar_url} />
                          <AvatarFallback>{friend.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {status.online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{friend.full_name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={status.online ? 'default' : 'outline'} className="text-xs">
                            {status.online ? 'Online' : 'Offline'}
                          </Badge>
                          {status.playing && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Gamepad2 className="w-3 h-3" />
                              Playing
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={createPageUrl('UserProfile', `?user_id=${friend.id}`)}>
                        <Button size="sm" variant="outline">
                          <User className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {friends.length === 0 && (
            <p className="text-center text-gray-500 py-8">No friends yet</p>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-2">
          {pendingRequests.map(request => (
            <FriendRequestCard 
              key={request.id} 
              request={request}
              onAccept={() => acceptRequestMutation.mutate(request)}
              onReject={() => rejectRequestMutation.mutate(request.id)}
            />
          ))}
          {pendingRequests.length === 0 && (
            <p className="text-center text-gray-500 py-8">No pending requests</p>
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-2">
          {sentRequests.map(request => (
            <SentRequestCard key={request.id} request={request} />
          ))}
          {sentRequests.length === 0 && (
            <p className="text-center text-gray-500 py-8">No sent requests</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FriendRequestCard({ request, onAccept, onReject }) {
  const [sender, setSender] = useState(null);

  useEffect(() => {
    const fetchSender = async () => {
      const users = await base44.entities.User.filter({ id: request.sender_id });
      setSender(users[0]);
    };
    fetchSender();
  }, [request.sender_id]);

  if (!sender) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={sender.avatar_url} />
              <AvatarFallback>{sender.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{sender.full_name}</p>
              <p className="text-sm text-gray-600">{sender.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onAccept} className="bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onReject}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SentRequestCard({ request }) {
  const [receiver, setReceiver] = useState(null);

  useEffect(() => {
    const fetchReceiver = async () => {
      const users = await base44.entities.User.filter({ id: request.receiver_id });
      setReceiver(users[0]);
    };
    fetchReceiver();
  }, [request.receiver_id]);

  if (!receiver) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={receiver.avatar_url} />
              <AvatarFallback>{receiver.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{receiver.full_name}</p>
              <p className="text-sm text-gray-600">{receiver.email}</p>
            </div>
          </div>
          <Badge variant="outline">Pending</Badge>
        </div>
      </CardContent>
    </Card>
  );
}