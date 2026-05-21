import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Copy,
  Star,
  TrendingUp,
  Filter,
  Search,
  Zap,
  Heart,
  MessageCircle,
  Share2
} from 'lucide-react';

export default function ContentLibraryBrowser() {
  const [user, setUser] = useState(null);
  const [filters, setFilters] = useState({ platform: 'all', category: 'all', search: '' });
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['contentLibrary', filters],
    queryFn: async () => {
      let data = await base44.entities.ContentLibraryTemplate.filter(
        { status: 'active' },
        '-performance_metrics.performance_score',
        500
      );

      if (filters.platform !== 'all') {
        data = data.filter(t => t.platform === filters.platform);
      }
      if (filters.category !== 'all') {
        data = data.filter(t => t.category === filters.category);
      }
      if (filters.search) {
        data = data.filter(t =>
          t.template_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
          t.template_description?.toLowerCase().includes(filters.search.toLowerCase()) ||
          t.base_content?.toLowerCase().includes(filters.search.toLowerCase())
        );
      }

      return data;
    },
    enabled: !!user
  });

  const featuredTemplates = templates.filter(t => t.featured);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Please log in to access the content library.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Content Library</h1>
          <p className="text-slate-600">High-performing templates from top affiliates. Clone and customize for your campaigns.</p>
        </div>

        {/* Featured Section */}
        {featuredTemplates.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500" /> Featured Templates
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {featuredTemplates.slice(0, 3).map((template) => (
                <TemplateCard key={template.id} template={template} user={user} isFeatured={true} />
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
                <Input
                  placeholder="Template name, type..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Platform</label>
                <select
                  value={filters.platform}
                  onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                >
                  <option value="all">All Platforms</option>
                  <option value="twitter">Twitter</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                >
                  <option value="all">All Categories</option>
                  <option value="high_engagement">High Engagement</option>
                  <option value="high_conversion">High Conversion</option>
                  <option value="viral_potential">Viral Potential</option>
                  <option value="evergreen">Evergreen</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({ platform: 'all', category: 'all', search: '' })}
                  variant="outline"
                  className="w-full"
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-12 pb-12 flex justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
            </CardContent>
          </Card>
        ) : templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} user={user} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No templates match your filters.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template, user, isFeatured = false }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const cloneMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('cloneTemplateToSchedule', {
        template_id: template.id,
        schedule_id: user.id, // This should be passed properly in real implementation
        post_date: new Date().toISOString().split('T')[0],
        platform: template.platform
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentLibrary'] });
    }
  });

  return (
    <Card className={`cursor-pointer hover:shadow-lg transition-all ${isFeatured ? 'border-2 border-yellow-400' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <CardTitle className="text-lg text-slate-900">{template.template_name}</CardTitle>
            <p className="text-xs text-slate-600 mt-1">{template.template_description}</p>
          </div>
          {isFeatured && <Star className="w-5 h-5 text-yellow-500" />}
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          <Badge className="bg-blue-100 text-blue-800 text-xs">
            {template.platform.charAt(0).toUpperCase() + template.platform.slice(1)}
          </Badge>
          <Badge className="bg-purple-100 text-purple-800 text-xs">{template.content_type}</Badge>
          {template.featured && <Badge className="bg-yellow-100 text-yellow-800 text-xs">Featured</Badge>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded">
          <div className="text-center">
            <p className="text-xs text-slate-600">Performance</p>
            <p className="text-lg font-bold text-slate-900">
              {template.performance_metrics?.performance_score?.toFixed(0) || 0}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600">Used</p>
            <p className="text-lg font-bold text-slate-900">{template.times_cloned || 0}x</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600">Engagement</p>
            <p className="text-lg font-bold text-slate-900">
              {(template.performance_metrics?.engagement_rate * 100)?.toFixed(0) || 0}%
            </p>
          </div>
        </div>

        {/* Content Preview */}
        <div>
          <p className="text-xs text-slate-600 font-semibold mb-2">Content Preview</p>
          <p className="text-sm text-slate-700 line-clamp-3 bg-white p-2 rounded border border-slate-200">
            {template.base_content}
          </p>
          {expanded && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs text-slate-600 font-semibold mb-1">Customization Tips</p>
                <p className="text-xs text-slate-700">{template.customization_guide}</p>
              </div>
              {template.ai_suggested_variations?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-600 font-semibold mb-2">Copy Variations</p>
                  <div className="space-y-2">
                    {template.ai_suggested_variations.slice(0, 2).map((variation, idx) => (
                      <p key={idx} className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                        "{variation}"
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hashtags */}
        <div>
          <p className="text-xs text-slate-600 font-semibold mb-2">Hashtags</p>
          <div className="flex flex-wrap gap-1">
            {template.hashtags?.slice(0, 5).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {template.hashtags?.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{template.hashtags.length - 5} more
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => setExpanded(!expanded)}
            variant="outline"
            className="flex-1 text-xs"
          >
            {expanded ? 'Show Less' : 'Details'}
          </Button>
          <Button
            onClick={() => cloneMutation.mutate()}
            disabled={cloneMutation.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs"
          >
            <Copy className="w-3 h-3 mr-1" />
            {cloneMutation.isPending ? 'Cloning...' : 'Clone'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}