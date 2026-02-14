import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserMinus, MessageSquare, Search, Check, X, Activity } from "lucide-react";
import { toast } from "sonner";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function FriendSystem({ user }) {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: friendRequests = [] } = useQuery({
    queryKey: ['friend-requests', user?.id],
    queryFn: async () => {
      return await base44.entities.FriendRequest.filter({
        receiver_user_id: user.id,
        status: 'pending'
      });
    },
    enabled: !!user
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: async () => {
      const accepted = await base44.entities.FriendRequest.filter({
        $or: [
          { sender_user_id: user.id, status: 'accepted' },
          { receiver_user_id: user.id, status: 'accepted' }
        ]
      });
      
      const friendIds = accepted.map(req => 
        req.sender_user_id === user.id ? req.receiver_user_id : req.sender_user_id
      );
      
      if (friendIds.length === 0) return [];
      
      return await base44.entities.User.filter({
        id: { $in: friendIds }
      });
    },
    enabled: !!user
  });

  const { data: friendActivity = [] } = useQuery({
    queryKey: ['friend-activity'],
    queryFn: async () => {
      if (friends.length === 0) return [];
      const friendIds = friends.map(f => f.id);
      return await base44.entities.UserActivity.filter({
        user_id: { $in: friendIds }
      }, '-created_date', 10);
    },
    enabled: friends.length > 0
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (email) => {
      const users = await base44.entities.User.filter({ email });
      if (users.length === 0) throw new Error('User not found');
      
      const targetUser = users[0];
      if (targetUser.id === user.id) throw new Error('Cannot add yourself');
      
      const existing = await base44.entities.FriendRequest.filter({
        $or: [
          { sender_user_id: user.id, receiver_user_id: targetUser.id },
          { sender_user_id: targetUser.id, receiver_user_id: user.id }
        ]
      });
      
      if (existing.length > 0) throw new Error('Request already exists');
      
      return await base44.entities.FriendRequest.create({
        sender_user_id: user.id,
        receiver_user_id: targetUser.id,
        status: 'pending'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['friend-requests']);
      toast.success('Friend request sent!');
      setSearchQuery('');
    },
    onError: (error) => toast.error(error.message)
  });

  const respondRequestMutation = useMutation({
    mutationFn: async ({ requestId, accept }) => {
      await base44.entities.FriendRequest.update(requestId, {
        status: accept ? 'accepted' : 'rejected'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['friend-requests']);
      queryClient.invalidateQueries(['friends']);
      toast.success('Request updated');
    }
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId) => {
      const requests = await base44.entities.FriendRequest.filter({
        $or: [
          { sender_user_id: user.id, receiver_user_id: friendId },
          { sender_user_id: friendId, receiver_user_id: user.id }
        ],
        status: 'accepted'
      });
      
      if (requests.length > 0) {
        await base44.entities.FriendRequest.delete(requests[0].id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['friends']);
      toast.success('Friend removed');
    }
  });

  return (
    <div className="space-y-6">
      {/* Add Friend */}
      <Card>
        <CardHeader>
          <CardTitle>Add Friend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter friend's email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button onClick={() => sendRequestMutation.mutate(searchQuery)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Requests */}
      {friendRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Friend Requests ({friendRequests.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {friendRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-semibold">{request.sender_email}</p>
                  <p className="text-sm text-gray-600">Wants to be friends</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => respondRequestMutation.mutate({ requestId: request.id, accept: true })}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => respondRequestMutation.mutate({ requestId: request.id, accept: false })}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Friends List */}
      <Card>
        <CardHeader>
          <CardTitle>Friends ({friends.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {friends.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No friends yet</p>
          ) : (
            friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <Link to={createPageUrl('UserProfile') + `?user_id=${friend.id}`} className="flex items-center gap-3 flex-1">
                  <Avatar>
                    {friend.avatar_url && <AvatarImage src={friend.avatar_url} />}
                    <AvatarFallback>{friend.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{friend.full_name}</p>
                    <p className="text-sm text-gray-600">Level {friend.level || 1}</p>
                  </div>
                </Link>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={createPageUrl('UserInbox') + `?chat_with=${friend.id}`}>
                      <MessageSquare className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeFriendMutation.mutate(friend.id)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Friend Activity */}
      {friendActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Friend Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {friendActivity.map((activity) => (
              <div key={activity.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                <p className="font-medium">{activity.description}</p>
                <p className="text-xs text-gray-500">
                  {new Date(activity.created_date).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}