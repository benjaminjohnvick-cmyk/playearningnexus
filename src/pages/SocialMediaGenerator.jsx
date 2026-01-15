import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Sparkles, Copy, Calendar, Check, Twitter, Facebook, Instagram, Linkedin, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function SocialMediaGenerator() {
  const [user, setUser] = useState(null);
  const [businessClient, setBusinessClient] = useState(null);
  const [selectedGame, setSelectedGame] = useState('');
  const [platform, setPlatform] = useState('twitter');
  const [postType, setPostType] = useState('promotional');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        const clients = await base44.entities.BusinessClient.filter({
          owner_user_id: currentUser.id
        });
        
        if (clients.length > 0) {
          setBusinessClient(clients[0]);
        }
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: games = [] } = useQuery({
    queryKey: ['my-games', businessClient?.id],
    queryFn: async () => {
      if (!businessClient) return [];
      return await base44.entities.Game.filter({
        developer_id: businessClient.id,
        marketplace_approved: true
      });
    },
    enabled: !!businessClient
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['social-posts', businessClient?.id],
    queryFn: async () => {
      if (!businessClient) return [];
      return await base44.entities.SocialMediaPost.filter({
        developer_id: businessClient.id
      }, '-created_date');
    },
    enabled: !!businessClient
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const game = games.find(g => g.id === selectedGame);
      if (!game) throw new Error('Select a game first');

      const prompt = customPrompt || `Create an engaging ${postType} social media post for ${platform} promoting the game "${game.title}". 
      Game description: ${game.description}
      Category: ${game.category}
      Price: ${game.price === 0 ? 'Free' : `$${game.price}`}
      
      Make it catchy, include emojis where appropriate, and suggest 3-5 relevant hashtags. Keep it within platform character limits.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            content: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } }
          }
        }
      });

      return await base44.entities.SocialMediaPost.create({
        developer_id: businessClient.id,
        game_id: selectedGame,
        platform,
        post_type: postType,
        content: result.content,
        hashtags: result.hashtags || []
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['social-posts']);
      toast.success('Post generated successfully!');
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error('Failed to generate post');
      setIsGenerating(false);
    }
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate();
  };

  const handleCopy = (post) => {
    const fullText = `${post.content}\n\n${post.hashtags.map(tag => `#${tag}`).join(' ')}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(post.id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteMutation = useMutation({
    mutationFn: (postId) => base44.entities.SocialMediaPost.delete(postId),
    onSuccess: () => {
      queryClient.invalidateQueries(['social-posts']);
      toast.success('Post deleted');
    }
  });

  const platformIcons = {
    twitter: Twitter,
    facebook: Facebook,
    instagram: Instagram,
    linkedin: Linkedin,
    tiktok: Sparkles
  };

  if (!businessClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link to={createPageUrl('BusinessDashboard')}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">AI Social Media Generator</h1>
          <p className="text-gray-600">Create engaging social media content for your games</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Generator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Generate Post
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Game</Label>
                <Select value={selectedGame} onValueChange={setSelectedGame}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map(game => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Post Type</Label>
                <Select value={postType} onValueChange={setPostType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promotional">Promotional</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="behind_the_scenes">Behind the Scenes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Custom Instructions (Optional)</Label>
                <Textarea
                  placeholder="Add specific instructions for the AI..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!selectedGame || isGenerating}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Post
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Posts</CardTitle>
            </CardHeader>
            <CardContent>
              {posts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No posts generated yet</p>
                  <p className="text-sm">Create your first AI-powered post!</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {posts.map(post => {
                    const Icon = platformIcons[post.platform];
                    return (
                      <Card key={post.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              <Badge variant="outline" className="capitalize">
                                {post.platform}
                              </Badge>
                              <Badge className="capitalize">{post.post_type}</Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopy(post)}
                            >
                              {copiedId === post.id ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>

                          <p className="text-sm mb-3 whitespace-pre-wrap">{post.content}</p>

                          {post.hashtags?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {post.hashtags.map((tag, idx) => (
                                <span key={idx} className="text-xs text-blue-600">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2 pt-3 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopy(post)}
                              className="flex-1"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(post.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}