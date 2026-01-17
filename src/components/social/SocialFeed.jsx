import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Trophy, Gamepad2, Star, Send, Users, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function SocialFeed({ currentUser }) {
  const [commentText, setCommentText] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFindFriends, setShowFindFriends] = useState(false);
  const queryClient = useQueryClient();

  // Fetch friend connections
  const { data: friendConnections = [] } = useQuery({
    queryKey: ['friend-connections', currentUser?.id],
    queryFn: async () => {
      const connections = await base44.entities.SocialConnection.filter({
        user_id: currentUser.id,
        connection_type: 'friend',
        status: 'accepted'
      });
      return connections;
    },
    enabled: !!currentUser
  });

  const friendIds = friendConnections.map(c => c.connected_user_id);

  // Fetch activity feed from friends
  const { data: activityFeed = [], isLoading } = useQuery({
    queryKey: ['social-feed', currentUser?.id],
    queryFn: async () => {
      if (friendIds.length === 0) return [];
      const activities = await base44.entities.ActivityFeedItem.filter(
        { user_id: { $in: friendIds } },
        '-created_date',
        50
      );
      
      // Fetch user details for all activities
      const userIds = [...new Set(activities.map(a => a.user_id))];
      const users = await base44.entities.User.filter({ id: { $in: userIds } });
      const usersMap = Object.fromEntries(users.map(u => [u.id, u]));
      
      return activities.map(a => ({ ...a, user: usersMap[a.user_id] }));
    },
    enabled: !!currentUser && friendIds.length > 0,
    refetchInterval: 30000
  });

  // Search users for finding friends
  const { data: searchResults = [] } = useQuery({
    queryKey: ['user-search', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const users = await base44.entities.User.list();
      return users.filter(u => 
        u.id !== currentUser.id &&
        !friendIds.includes(u.id) &&
        (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 10);
    },
    enabled: searchQuery.length >= 2
  });

  // Like/Unlike mutation
  const toggleLikeMutation = useMutation({
    mutationFn: async (activity) => {
      const likes = activity.likes || [];
      const hasLiked = likes.includes(currentUser.id);
      
      await base44.entities.ActivityFeedItem.update(activity.id, {
        likes: hasLiked 
          ? likes.filter(id => id !== currentUser.id)
          : [...likes, currentUser.id]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['social-feed']);
    }
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ activityId, text }) => {
      const activity = activityFeed.find(a => a.id === activityId);
      const comments = activity.comments || [];
      
      await base44.entities.ActivityFeedItem.update(activityId, {
        comments: [...comments, {
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          text,
          timestamp: new Date().toISOString()
        }]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['social-feed']);
      setCommentText({});
      toast.success('Comment added!');
    }
  });

  // Send friend request
  const sendFriendRequestMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.entities.SocialConnection.create({
        user_id: currentUser.id,
        connected_user_id: userId,
        connection_type: 'friend',
        status: 'pending'
      });
    },
    onSuccess: () => {
      toast.success('Friend request sent!');
      queryClient.invalidateQueries(['friend-connections']);
    }
  });

  const getActivityIcon = (type) => {
    switch (type) {
      case 'achievement': return <Trophy className="w-5 h-5 text-amber-500" />;
      case 'game_install': return <Gamepad2 className="w-5 h-5 text-blue-500" />;
      case 'review': return <Star className="w-5 h-5 text-yellow-500" />;
      default: return <Gamepad2 className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-6 h-6" />
              Friends Activity
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFindFriends(!showFindFriends)}
            >
              <Search className="w-4 h-4 mr-2" />
              Find Friends
            </Button>
          </div>
        </CardHeader>

        {showFindFriends && (
          <CardContent className="border-t">
            <div className="space-y-4">
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{user.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => sendFriendRequestMutation.mutate(user.id)}
                      >
                        Add Friend
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        )}

        <CardContent>
          {activityFeed.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No friend activity yet</p>
              <p className="text-sm text-gray-400">Add friends to see their gaming activity!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {activityFeed.map((activity) => {
                  const likes = activity.likes || [];
                  const comments = activity.comments || [];
                  const hasLiked = likes.includes(currentUser.id);

                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="bg-white border rounded-lg p-4 space-y-3"
                    >
                      {/* Activity Header */}
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {activity.user?.full_name?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Link to={createPageUrl('UserProfile') + `?id=${activity.user_id}`}>
                              <span className="font-semibold hover:underline">
                                {activity.user?.full_name}
                              </span>
                            </Link>
                            {getActivityIcon(activity.activity_type)}
                          </div>
                          <p className="text-gray-700">{activity.description}</p>
                          {activity.metadata?.game_title && (
                            <Badge variant="outline" className="mt-2">
                              {activity.metadata.game_title}
                            </Badge>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(activity.created_date).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Like and Comment Actions */}
                      <div className="flex items-center gap-4 pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleLikeMutation.mutate(activity)}
                          className={hasLiked ? 'text-red-500' : ''}
                        >
                          <Heart className={`w-4 h-4 mr-1 ${hasLiked ? 'fill-current' : ''}`} />
                          {likes.length > 0 && likes.length}
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MessageCircle className="w-4 h-4 mr-1" />
                          {comments.length > 0 && comments.length}
                        </Button>
                      </div>

                      {/* Comments Section */}
                      {comments.length > 0 && (
                        <div className="space-y-2 pl-4 border-l-2">
                          {comments.map((comment, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{comment.user_name}: </span>
                              <span className="text-gray-700">{comment.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Comment */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Write a comment..."
                          value={commentText[activity.id] || ''}
                          onChange={(e) => setCommentText({ ...commentText, [activity.id]: e.target.value })}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && commentText[activity.id]?.trim()) {
                              addCommentMutation.mutate({
                                activityId: activity.id,
                                text: commentText[activity.id]
                              });
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            if (commentText[activity.id]?.trim()) {
                              addCommentMutation.mutate({
                                activityId: activity.id,
                                text: commentText[activity.id]
                              });
                            }
                          }}
                          disabled={!commentText[activity.id]?.trim()}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}