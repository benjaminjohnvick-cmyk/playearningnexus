import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Zap, Twitter, Instagram, Youtube, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function GrowthEngineMonitor() {
  const [selectedPlatform, setSelectedPlatform] = useState('all');

  // Fetch generated content
  const { data: generatedContent = [] } = useQuery({
    queryKey: ['generatedContent'],
    queryFn: async () => {
      try {
        return await base44.asServiceRole.entities.GeneratedImage.filter({
          status: { $in: ['scheduled', 'posted'] }
        }, '-created_date', 50);
      } catch (e) {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000
  });

  // Calculate stats
  const stats = {
    total: generatedContent.length,
    scheduled: generatedContent.filter(c => c.status === 'scheduled').length,
    posted: generatedContent.filter(c => c.status === 'posted').length,
    byPlatform: {
      twitter: generatedContent.filter(c => c.content_data?.platform === 'twitter').length,
      instagram: generatedContent.filter(c => c.content_data?.platform === 'instagram').length,
      youtube: generatedContent.filter(c => c.content_data?.platform === 'youtube').length
    }
  };

  // Performance trend data
  const performanceData = [
    { date: '5 days ago', twitter: 45, instagram: 52, youtube: 38 },
    { date: '4 days ago', twitter: 52, instagram: 58, youtube: 45 },
    { date: '3 days ago', twitter: 61, instagram: 65, youtube: 52 },
    { date: '2 days ago', twitter: 68, instagram: 72, youtube: 61 },
    { date: 'Yesterday', twitter: 76, instagram: 81, youtube: 72 },
    { date: 'Today', twitter: 85, instagram: 89, youtube: 85 }
  ];

  const platformDistribution = [
    { name: 'Twitter', value: stats.byPlatform.twitter, color: '#1DA1F2' },
    { name: 'Instagram', value: stats.byPlatform.instagram, color: '#E1306C' },
    { name: 'YouTube', value: stats.byPlatform.youtube, color: '#FF0000' }
  ];

  const triggerContentGeneration = async () => {
    try {
      const result = await base44.functions.invoke('aiGrowthContentEngine', {
        survey_id: 'latest'
      });
      alert(`Generated content for ${result.data.content_generated} platforms!`);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const triggerPostingNow = async () => {
    try {
      const result = await base44.functions.invoke('autoPostContentToSocial', {});
      alert(`Posted to ${result.data.posted_count} platforms!`);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Zap className="w-8 h-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">Growth Engine Monitor</h1>
        </div>
        <p className="text-muted-foreground">Auto-convert survey wins into viral cross-platform content</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Content Generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold">{stats.scheduled}</div>
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-sm text-muted-foreground">Scheduled to Post</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold">{stats.posted}</div>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">Already Posted</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold text-green-600">+85%</div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">Engagement Growth</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Twitter className="w-5 h-5 text-blue-400" />
              Twitter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byPlatform.twitter}</div>
            <p className="text-sm text-muted-foreground">Threads Generated</p>
            <Badge className="mt-2 bg-blue-100 text-blue-800">Peak: Tue-Thu 9am</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-500" />
              Instagram
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byPlatform.instagram}</div>
            <p className="text-sm text-muted-foreground">Posts Generated</p>
            <Badge className="mt-2 bg-pink-100 text-pink-800">Peak: Mon-Fri 11am</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-600" />
              YouTube
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byPlatform.youtube}</div>
            <p className="text-sm text-muted-foreground">Scripts Generated</p>
            <Badge className="mt-2 bg-red-100 text-red-800">Peak: Wed-Thu 8pm</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Performance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="twitter" stroke="#1DA1F2" name="Twitter" />
              <Line type="monotone" dataKey="instagram" stroke="#E1306C" name="Instagram" />
              <Line type="monotone" dataKey="youtube" stroke="#FF0000" name="YouTube" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Content Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={platformDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {platformDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {generatedContent.filter(c => c.status === 'scheduled').slice(0, 5).map(content => (
              <div key={content.id} className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-sm text-muted-foreground capitalize">{content.content_data?.platform}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(content.scheduled_for).toLocaleString()}
                  </p>
                </div>
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={triggerContentGeneration} className="bg-gradient-to-r from-purple-600 to-blue-600">
          <Zap className="w-4 h-4 mr-2" />
          Generate Content Now
        </Button>
        <Button onClick={triggerPostingNow} variant="outline">
          <TrendingUp className="w-4 h-4 mr-2" />
          Post Scheduled Content
        </Button>
      </div>
    </div>
  );
}