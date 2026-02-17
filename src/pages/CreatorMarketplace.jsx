import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users, Star, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function CreatorMarketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('subscribers');

  const { data: creators = [], isLoading } = useQuery({
    queryKey: ['creatorMarketplace'],
    queryFn: () => base44.entities.CreatorProfile.list()
  });

  const { data: allTiers = [] } = useQuery({
    queryKey: ['allCreatorTiers'],
    queryFn: () => base44.entities.CreatorSubscriptionTier.list()
  });

  const filteredCreators = creators
    .filter(creator => {
      const matchesSearch = creator.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.bio?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesContentType = contentTypeFilter === 'all' || 
        creator.content_types?.includes(contentTypeFilter);
      
      return matchesSearch && matchesContentType;
    })
    .sort((a, b) => {
      if (sortBy === 'subscribers') return b.total_subscribers - a.total_subscribers;
      if (sortBy === 'engagement') return b.average_engagement_rate - a.average_engagement_rate;
      if (sortBy === 'followers') return b.total_followers - a.total_followers;
      return 0;
    });

  const getCreatorTiers = (creatorId) => {
    return allTiers.filter(t => t.creator_user_id === creatorId && t.is_active);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Discover Content Creators
          </h1>
          <p className="text-gray-600">
            Find and support your favorite gaming creators
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search creators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Content Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Content Types</SelectItem>
                  <SelectItem value="streams">Streams</SelectItem>
                  <SelectItem value="videos">Videos</SelectItem>
                  <SelectItem value="guides">Guides</SelectItem>
                  <SelectItem value="reviews">Reviews</SelectItem>
                  <SelectItem value="tutorials">Tutorials</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscribers">Most Subscribers</SelectItem>
                  <SelectItem value="engagement">Highest Engagement</SelectItem>
                  <SelectItem value="followers">Most Followers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Featured Creators */}
        {creators.filter(c => c.featured).length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Featured Creators</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {creators.filter(c => c.featured).slice(0, 3).map(creator => (
                <CreatorCard key={creator.id} creator={creator} tiers={getCreatorTiers(creator.user_id)} featured />
              ))}
            </div>
          </div>
        )}

        {/* All Creators */}
        <h2 className="text-2xl font-bold mb-4">
          {searchQuery || contentTypeFilter !== 'all' ? 'Search Results' : 'All Creators'}
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {filteredCreators.map(creator => (
            <CreatorCard key={creator.id} creator={creator} tiers={getCreatorTiers(creator.user_id)} />
          ))}
        </div>

        {filteredCreators.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-gray-600">No creators found matching your criteria</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function CreatorCard({ creator, tiers, featured }) {
  return (
    <Card className={`overflow-hidden hover:shadow-xl transition-all ${featured ? 'border-2 border-purple-500' : ''}`}>
      {creator.banner_image_url && (
        <div className="h-32 bg-gradient-to-r from-purple-500 to-pink-500" 
          style={{ backgroundImage: `url(${creator.banner_image_url})`, backgroundSize: 'cover' }} 
        />
      )}
      <CardContent className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
            {creator.display_name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-lg">{creator.display_name}</h3>
              {creator.is_verified && (
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
              )}
              {featured && <Badge className="bg-purple-600">Featured</Badge>}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{creator.bio}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {creator.content_types?.slice(0, 3).map((type, idx) => (
            <Badge key={idx} variant="outline">{type}</Badge>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-600">Subscribers</p>
            <p className="font-bold">{creator.total_subscribers.toLocaleString()}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-pink-600 mb-1">
              <Star className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-600">Followers</p>
            <p className="font-bold">{creator.total_followers.toLocaleString()}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-600">Engagement</p>
            <p className="font-bold">{creator.average_engagement_rate}%</p>
          </div>
        </div>

        {tiers.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-600 mb-2">Subscription Tiers</p>
            <div className="space-y-1">
              {tiers.slice(0, 2).map(tier => (
                <div key={tier.id} className="flex justify-between text-sm">
                  <span>{tier.tier_name}</span>
                  <span className="font-bold">${tier.price_monthly}/mo</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link to={createPageUrl('UserProfile') + '?userId=' + creator.user_id}>
          <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
            View Profile
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}