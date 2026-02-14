import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Share2, Image, Video, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function EnhancedSocialFeed({ user }) {
  const [newPost, setNewPost] = useState({ content: '', media_url: '', media_type: '' });
  const queryClient = useQueryClient();

  const { data: posts = [] } = useQuery({
    queryKey: ['social-feed', user?.id],
    queryFn: async () => {
      const allPosts = await base44.entities.ActivityFeedItem.filter({}, '-created_date', 50);
      
      // AI-driven sorting based on user interests
      const userActivities = await base44.entities.UserActivity.filter({
        user_id: user.id
      }, '-created_date', 20);
      
      const userGameInterests = userActivities
        .filter(a => a.related_entity_id)
        .map(a => a.related_entity_id);
      
      return allPosts.sort((a, b) => {
        let scoreA = (a.likes || 0) * 2 + (a.comments || 0) * 3 + (a.shares || 0) * 4;
        let scoreB = (b.likes || 0) * 2 + (b.comments || 0) * 3 + (b.shares || 0) * 4;
        
        if (userGameInterests.includes(a.related_entity_id)) scoreA += 10;
        if (userGameInterests.includes(b.related_entity_id)) scoreB += 10;
        
        const ageA = (new Date() - new Date(a.created_date)) / (1000 * 60 * 60);
        const ageB = (new Date() - new Date(b.created_date)) / (1000 * 60 * 60);
        
        scoreA = scoreA / (1 + ageA * 0.1);
        scoreB = scoreB / (1 + ageB * 0.1);
        
        return scoreB - scoreA;
      });
    },
    enabled: !!user
  });

  const createPostMutation = useMutation({
    mutationFn: async (postData) => {
      return await base44.entities.ActivityFeedItem.create({
        user_id: user.id,
        user_name: user.full_name,
        content: postData.content,
        media_url: postData.media_url,
        media_type: postData.media_type,
        likes: 0,
        comments: 0,
        shares: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['social-feed']);
      setNewPost({ content: '', media_url: '', media_type: '' });
      toast.success('Post created!');
    }
  });

  const likePostMutation = useMutation({
    mutationFn: async (postId) => {
      const post = posts.find(p => p.id === postId);
      await base44.entities.ActivityFeedItem.update(postId, {
        likes: (post.likes || 0) + 1
      });

      await base44.entities.Notification.create({
        user_id: post.user_id,
        notification_type: 'social',
        title: 'New Like',
        message: `${user.full_name} liked your post`,
        action_url: `/feed?post=${postId}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['social-feed']);
    }
  });

  const sharePostMutation = useMutation({
    mutationFn: async (postId) => {
      const post = posts.find(p => p.id === postId);
      await base44.entities.ActivityFeedItem.update(postId, {
        shares: (post.shares || 0) + 1
      });

      await base44.entities.Notification.create({
        user_id: post.user_id,
        notification_type: 'social',
        title: 'Post Shared',
        message: `${user.full_name} shared your post`,
        action_url: `/feed?post=${postId}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['social-feed']);
      toast.success('Post shared!');
    }
  });

  const handleMediaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
      setNewPost({ ...newPost, media_url: file_url, media_type: mediaType });
      toast.success('Media uploaded!');
    } catch (error) {
      toast.error('Upload failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Post */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <Avatar>
            {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
            <AvatarFallback>{user?.full_name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder="Share your gaming achievements..."
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              className="min-h-[80px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <label>
                <input type="file" accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
                <Button size="sm" variant="outline" type="button" asChild>
                  <span>
                    <Image className="w-4 h-4 mr-2" />
                    Photo/Video
                  </span>
                </Button>
              </label>
              {newPost.media_url && (
                <Badge className="bg-green-100 text-green-700">Media attached</Badge>
              )}
            </div>
            <Button
              onClick={() => createPostMutation.mutate(newPost)}
              disabled={!newPost.content}
              className="bg-blue-600"
            >
              <Send className="w-4 h-4 mr-2" />
              Post
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Sorting Indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-600 px-2">
        <Sparkles className="w-4 h-4" />
        <span>Feed personalized based on your interests</span>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{post.user_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{post.user_name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(post.created_date).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-gray-800">{post.content}</p>
              
              {post.media_url && (
                <div className="rounded-lg overflow-hidden">
                  {post.media_type === 'image' ? (
                    <img src={post.media_url} alt="Post" className="w-full max-h-96 object-cover" />
                  ) : post.media_type === 'video' ? (
                    <video src={post.media_url} controls className="w-full max-h-96" />
                  ) : null}
                </div>
              )}

              <div className="flex items-center gap-4 pt-3 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => likePostMutation.mutate(post.id)}
                  className="flex items-center gap-2"
                >
                  <Heart className="w-4 h-4" />
                  <span>{post.likes || 0}</span>
                </Button>
                <Button size="sm" variant="ghost" className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>{post.comments || 0}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => sharePostMutation.mutate(post.id)}
                  className="flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{post.shares || 0}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}