import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CheckCircle, Clock, Zap, Library, Copy } from 'lucide-react';

export default function AffiliateContentSchedulerCalendar() {
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Generate next month's schedule
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateAffiliateContentSchedule', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliateSchedules'] });
    }
  });

  // Fetch schedules
  const { data: schedules = [] } = useQuery({
    queryKey: ['affiliateSchedules'],
    queryFn: async () => {
      if (!user) return [];
      const data = await base44.entities.AffiliateContentSchedule.filter(
        { affiliate_user_id: user.id },
        '-generated_at',
        12
      );
      return data || [];
    },
    enabled: !!user
  });

  // Clone template mutation
  const cloneMutation = useMutation({
    mutationFn: async ({ templateId, postDate }) => {
      const response = await base44.functions.invoke('cloneTemplateToSchedule', {
        template_id: templateId,
        schedule_id: currentSchedule?.id,
        post_date: postDate
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliateSchedules'] });
      setShowLibrary(false);
    }
  });

  // Auto-approve post (skip manual approval)
  const autoApproveMutation = useMutation({
    mutationFn: async ({ scheduleId, postIndex }) => {
      const schedule = schedules.find(s => s.id === scheduleId);
      const updatedPosts = [...schedule.scheduled_posts];
      updatedPosts[postIndex].status = 'approved';
      updatedPosts[postIndex].approved_by = 'system_auto';
      updatedPosts[postIndex].approved_date = new Date().toISOString();

      return await base44.entities.AffiliateContentSchedule.update(scheduleId, {
        scheduled_posts: updatedPosts,
        posts_approved: updatedPosts.filter(p => p.status === 'approved').length
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliateSchedules'] });
    }
  });

  const currentSchedule = schedules.find(s => s.schedule_month === selectedMonth);

  const getDaysInMonth = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const contentTypeColors = {
    educational: 'bg-blue-100 text-blue-800',
    promotional: 'bg-purple-100 text-purple-800',
    testimonial: 'bg-emerald-100 text-emerald-800',
    trending_topic: 'bg-orange-100 text-orange-800',
    engagement_question: 'bg-pink-100 text-pink-800',
    contest_announcement: 'bg-red-100 text-red-800',
    product_showcase: 'bg-cyan-100 text-cyan-800'
  };

  const platformEmojis = {
    twitter: '𝕏',
    instagram: '📷',
    tiktok: '🎵',
    facebook: '👍',
    linkedin: '💼'
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Please log in to view your content calendar.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Content Scheduler Calendar</h1>
          <p className="text-slate-600">AI-generated 30-day posting plan for social media</p>
        </div>

        {/* Month Navigation & Generate Button */}
        <Card className="mb-6">
          <CardContent className="pt-6 flex gap-4 items-center justify-between">
            <div className="flex gap-3 items-center">
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const newMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
                  setSelectedMonth(newMonth);
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-bold text-slate-900 w-32 text-center">
                {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const newMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
                  setSelectedMonth(newMonth);
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !!currentSchedule}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Zap className="w-4 h-4 mr-2" />
                {generateMutation.isPending
                  ? 'Generating...'
                  : currentSchedule
                    ? 'Schedule Exists'
                    : 'Generate 30-Day Plan'}
              </Button>
              {currentSchedule && (
                <Button
                  onClick={() => setShowLibrary(!showLibrary)}
                  variant="outline"
                  className="bg-purple-50 border-purple-300"
                >
                  <Library className="w-4 h-4 mr-2" />
                  Browse Templates
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {currentSchedule ? (
          <>
            {/* Schedule Summary */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-slate-600 mb-1">Total Posts</p>
                  <p className="text-2xl font-bold text-slate-900">{currentSchedule.total_posts_planned}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-green-600 mb-1">Approved</p>
                  <p className="text-2xl font-bold text-green-900">{currentSchedule.posts_approved}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-blue-600 mb-1">Posted</p>
                  <p className="text-2xl font-bold text-blue-900">{currentSchedule.posts_posted}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-slate-600 mb-1">Pending Review</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {currentSchedule.scheduled_posts.filter(p => p.status === 'draft').length}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Content Type Breakdown */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Generation Basis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 font-semibold mb-3">Top Content Types</p>
                    <div className="space-y-2">
                      {currentSchedule.generation_basis?.past_top_content_types?.map((type, idx) => (
                        <Badge key={idx} className={contentTypeColors[type] || 'bg-slate-100'}>
                          {type.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 font-semibold mb-3">Trending Topics</p>
                    <div className="space-y-2">
                      {currentSchedule.generation_basis?.trending_topics?.slice(0, 3).map((topic, idx) => (
                        <p key={idx} className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                          {topic}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 font-semibold mb-3">Engagement Forecast</p>
                    <p className="text-sm text-slate-800 bg-emerald-50 p-3 rounded border border-emerald-200">
                      {currentSchedule.engagement_forecast}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Template Library Modal */}
            {showLibrary && <TemplateLibraryPanel scheduleId={currentSchedule?.id} onClone={() => setShowLibrary(false)} />}

            {/* Calendar Grid */}
            <Card>
              <CardHeader>
                <CardTitle>30-Day Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-bold text-slate-600 p-2 text-sm">
                      {day}
                    </div>
                  ))}

                  {currentSchedule.scheduled_posts.map((post, idx) => {
                    const date = new Date(post.post_date);
                    const dayOfWeek = date.getDay();

                    return (
                      <div
                        key={idx}
                        className={`p-2 border rounded-lg text-center cursor-pointer hover:shadow-md transition-shadow ${
                          post.status === 'approved'
                            ? 'bg-green-50 border-green-300'
                            : post.status === 'draft'
                              ? 'bg-yellow-50 border-yellow-300'
                              : 'bg-blue-50 border-blue-300'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900 mb-1">{date.getDate()}</div>
                        <div className="space-y-1">
                          <div className="text-2xl">{platformEmojis[post.platform]}</div>
                          <Badge className={`text-xs ${contentTypeColors[post.content_type]}`}>
                            {post.content_type.slice(0, 3)}
                          </Badge>

                          {post.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-xs mt-1 p-1 h-auto"
                              onClick={() => {
                                // Show preview modal (would need modal component)
                                const postData = JSON.stringify(post, null, 2);
                                alert(`Post Preview:\n\n${post.post_content}\n\nHashtags: ${post.hashtags?.join(' ')}`);
                              }}
                            >
                              Preview
                            </Button>
                          )}

                          {post.status === 'draft' && (
                            <Button
                              size="sm"
                              className="w-full text-xs mt-1 p-1 h-auto bg-green-600 hover:bg-green-700"
                              onClick={() => autoApproveMutation.mutate({ scheduleId: currentSchedule.id, postIndex: idx })}
                              disabled={autoApproveMutation.isPending}
                            >
                              {autoApproveMutation.isPending ? 'Approving...' : 'Auto-Approve'}
                            </Button>
                          )}

                          {post.status === 'approved' && (
                            <div className="flex items-center justify-center gap-1 text-green-700 text-xs">
                              <CheckCircle className="w-3 h-3" />
                              Approved
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No schedule for this month</p>
              <Button onClick={() => generateMutation.mutate()} className="bg-blue-600 hover:bg-blue-700">
                Generate Content Schedule
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TemplateLibraryPanel({ scheduleId, onClone }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [cloneDate, setCloneDate] = useState('');
  const queryClient = useQueryClient();

  const cloneMutation = useMutation({
    mutationFn: async ({ templateId, postDate }) => {
      const response = await base44.functions.invoke('cloneTemplateToSchedule', {
        template_id: templateId,
        schedule_id: scheduleId,
        post_date: postDate
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliateSchedules'] });
      setSelectedTemplate(null);
      onClone();
    }
  });

  React.useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await base44.entities.ContentLibraryTemplate.filter(
          { status: 'active', featured: true },
          '-performance_metrics.performance_score',
          20
        );
        setTemplates(data || []);
      } catch (err) {
        console.error('Error loading templates:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  return (
    <Card className="mb-6 bg-purple-50 border-purple-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Library className="w-5 h-5 text-purple-600" />
            Clone High-Performing Templates
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onClone}>×</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading templates...</div>
        ) : selectedTemplate ? (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded border border-purple-200">
              <h4 className="font-bold text-slate-900 mb-2">{selectedTemplate.template_name}</h4>
              <p className="text-sm text-slate-700 mb-3">{selectedTemplate.base_content}</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {selectedTemplate.hashtags?.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">#{tag}</Badge>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 p-3 rounded">
                <div><p className="text-xs text-slate-600">Performance</p><p className="font-bold">{selectedTemplate.performance_metrics?.performance_score?.toFixed(0)}%</p></div>
                <div><p className="text-xs text-slate-600">Used</p><p className="font-bold">{selectedTemplate.times_cloned}x</p></div>
                <div><p className="text-xs text-slate-600">Engagement</p><p className="font-bold">{(selectedTemplate.performance_metrics?.engagement_rate * 100)?.toFixed(0)}%</p></div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Post Date</label>
              <input
                type="date"
                value={cloneDate}
                onChange={(e) => setCloneDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => cloneMutation.mutate({ templateId: selectedTemplate.id, postDate: cloneDate })}
                disabled={!cloneDate || cloneMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                {cloneMutation.isPending ? 'Cloning...' : 'Clone to Calendar'}
              </Button>
              <Button onClick={() => setSelectedTemplate(null)} variant="outline" className="flex-1">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className="p-3 bg-white rounded border border-purple-200 cursor-pointer hover:border-purple-400 hover:shadow-md transition-all"
              >
                <p className="font-semibold text-sm text-slate-900 mb-1">{template.template_name}</p>
                <p className="text-xs text-slate-600 line-clamp-2 mb-2">{template.base_content}</p>
                <div className="flex items-center justify-between">
                  <Badge className="text-xs bg-purple-100 text-purple-800">{template.platform}</Badge>
                  <span className="text-xs font-bold text-purple-600">{template.performance_metrics?.performance_score?.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}