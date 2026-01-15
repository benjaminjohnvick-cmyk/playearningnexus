import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Star, Users, Heart, Globe, Twitter, Linkedin, Github, Facebook, Instagram, Youtube } from 'lucide-react';
import { toast } from 'sonner';

export default function DeveloperPortfolio() {
  const [user, setUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const developerId = urlParams.get('id');
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Not authenticated');
      }
    };
    fetchUser();
  }, []);

  const { data: developer } = useQuery({
    queryKey: ['developer', developerId],
    queryFn: async () => {
      const devs = await base44.entities.BusinessClient.list();
      return devs.find(d => d.id === developerId);
    },
    enabled: !!developerId
  });

  const { data: games = [] } = useQuery({
    queryKey: ['developerGames', developerId],
    queryFn: () => base44.entities.Game.filter({ 
      developer_id: developerId,
      marketplace_approved: true 
    }),
    enabled: !!developerId
  });

  const { data: isFollowing = false } = useQuery({
    queryKey: ['isFollowing', developerId, user?.id],
    queryFn: async () => {
      const follows = await base44.entities.DeveloperFollow.filter({
        user_id: user.id,
        developer_id: developerId
      });
      return follows.length > 0;
    },
    enabled: !!user && !!developerId
  });

  const { data: followerCount = 0 } = useQuery({
    queryKey: ['followerCount', developerId],
    queryFn: async () => {
      const follows = await base44.entities.DeveloperFollow.filter({ developer_id: developerId });
      return follows.length;
    },
    enabled: !!developerId
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        const follows = await base44.entities.DeveloperFollow.filter({
          user_id: user.id,
          developer_id: developerId
        });
        if (follows[0]) {
          await base44.entities.DeveloperFollow.delete(follows[0].id);
        }
      } else {
        await base44.entities.DeveloperFollow.create({
          user_id: user.id,
          developer_id: developerId
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['isFollowing']);
      queryClient.invalidateQueries(['followerCount']);
      toast.success(isFollowing ? 'Unfollowed developer' : 'Following developer!');
    }
  });

  if (!developer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const socialIcons = {
    website: Globe,
    twitter: Twitter,
    linkedin: Linkedin,
    github: Github,
    facebook: Facebook,
    instagram: Instagram,
    youtube: Youtube
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link to={createPageUrl('GameStore')}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Store
          </Button>
        </Link>

        {/* Developer Header */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {developer.logo_url && (
                <img 
                  src={developer.logo_url} 
                  alt={developer.company_name}
                  className="w-32 h-32 rounded-xl object-cover shadow-lg"
                />
              )}
              
              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-2">{developer.company_name}</h1>
                
                {developer.tagline && (
                  <p className="text-xl text-gray-600 mb-4">{developer.tagline}</p>
                )}

                {developer.bio && (
                  <p className="text-gray-700 mb-4 leading-relaxed">{developer.bio}</p>
                )}

                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{developer.games_count || 0}</span>
                    <span>Games</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-5 h-5" />
                    <span className="font-semibold">{followerCount}</span>
                    <span>Followers</span>
                  </div>
                </div>

                {/* Social Links */}
                {developer.social_links && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {Object.entries(developer.social_links).map(([platform, url]) => {
                      if (!url) return null;
                      const Icon = socialIcons[platform] || Globe;
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm capitalize">{platform}</span>
                        </a>
                      );
                    })}
                  </div>
                )}

                {user && (
                  <Button
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                    variant={isFollowing ? "outline" : "default"}
                    className={!isFollowing ? "bg-red-600 hover:bg-red-700" : ""}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${isFollowing ? 'fill-red-600' : ''}`} />
                    {isFollowing ? 'Following' : 'Follow Developer'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Games Portfolio */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Games by {developer.company_name}</h2>
          
          {games.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <p>No published games yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map(game => (
                <Link key={game.id} to={createPageUrl('GameDetail') + `?id=${game.id}`}>
                  <Card className="h-full hover:shadow-xl transition-shadow cursor-pointer">
                    <CardContent className="p-0">
                      {game.icon_url && (
                        <img 
                          src={game.icon_url} 
                          alt={game.title}
                          className="w-full h-48 object-cover rounded-t-xl"
                        />
                      )}
                      <div className="p-6">
                        <h3 className="font-bold text-xl mb-2">{game.title}</h3>
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {game.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-semibold">
                              {(game.average_rating || 0).toFixed(1)}
                            </span>
                            <span className="text-sm text-gray-500">
                              ({game.total_ratings || 0})
                            </span>
                          </div>
                          <Badge className="capitalize">{game.category}</Badge>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t">
                          <span className="text-lg font-bold text-green-700">
                            {!game.price || game.price === 0 ? 'FREE' : `$${game.price.toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}