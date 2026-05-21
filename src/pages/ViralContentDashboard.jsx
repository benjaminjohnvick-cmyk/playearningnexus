import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, Share2, BarChart3, RefreshCw } from 'lucide-react';

export default function ViralContentDashboard() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch generated content posts
  const { data: generatedPosts = [], isLoading } = useQuery({
    queryKey: ['viralContent'],
    queryFn: async () => {
      const posts = await base44.entities.SocialMediaPost.filter(
        { is_ai_generated: true },
        '-created_date',
        50
      );
      return posts || [];
    },
    refetchInterval: 60000 // Refresh every minute
  });

  // Generate viral content
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('viralContentGenerator', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viralContent'] });
    }
  });

  // Publish content to social media
  const publishMutation = useMutation({
    mutationFn: async (postId) => {
      await base44.entities.SocialMediaPost.update(postId, {
        status: 'published',
        published_at: new Date().toISOString()
      });
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viralContent'] });
    }
  });

  // Calculate stats
  const publishedPosts = generatedPosts.filter(p => p.status === 'published');
  const pendingPosts = generatedPosts.filter(p => p.status === 'pending_review');
  const avgEngagement = publishedPosts.length > 0
    ? (publishedPosts.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / publishedPosts.length).toFixed(0)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Viral Content Generator</h1>
          <p className="text-slate-600">AI-powered trending content with automatic social posting</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-slate-900">{generatedPosts.length}</div>
              <p className="text-sm text-slate-600 mt-1">Total Generated Posts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-emerald-600">{publishedPosts.length}</div>
              <p className="text-sm text-slate-600 mt-1">Published</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-600">{pendingPosts.length}</div>
              <p className="text-sm text-slate-600 mt-1">Awaiting Review</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-purple-600">{avgEngagement}</div>
              <p className="text-sm text-slate-600 mt-1">Avg Engagement</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Bar */}
        <Card className="mb-8">
          <CardContent className="pt-6 flex gap-3">
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              {generateMutation.isPending ? 'Generating...' : 'Generate New Content'}
            </Button>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['viralContent'] })}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>

        {/* Content Grid */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6 flex justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
              </CardContent>
            </Card>
          ) : generatedPosts.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No content generated yet. Click "Generate New Content" to start.</p>
              </CardContent>
            </Card>
          ) : (
            generatedPosts.map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          className={
                            post.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800'
                              : post.status === 'pending_review'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-800'
                          }
                        >
                          {post.status?.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{post.platform || 'Multi'}</Badge>
                        {post.is_ai_generated && <Badge className="bg-purple-100 text-purple-800">AI-Generated</Badge>}
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{post.content}</p>
                    </div>
                  </div>

                  {/* Engagement & Metadata */}
                  <div className="grid grid-cols-3 gap-4 mb-4 bg-slate-50 p-3 rounded-lg">
                    <div>
                      <p className="text-xs text-slate-600">Engagement Score</p>
                      <p className="text-lg font-bold text-slate-900">{post.engagement_score || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Hashtags</p>
                      <p className="text-sm text-slate-900">
                        {post.hashtags?.length || 0} tags
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Topic</p>
                      <p className="text-sm text-slate-900">{post.topic || 'general'}</p>
                    </div>
                  </div>

                  {/* Hashtags Display */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {post.hashtags.map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {post.status === 'pending_review' && (
                      <>
                        <Button
                          onClick={() => publishMutation.mutate(post.id)}
                          disabled={publishMutation.isPending}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          size="sm"
                        >
                          <Share2 className="w-3 h-3 mr-1" />
                          Approve & Publish
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          Edit
                        </Button>
                      </>
                    )}
                    {post.status === 'published' && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1">
                          <BarChart3 className="w-3 h-3 mr-1" />
                          View Analytics
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}