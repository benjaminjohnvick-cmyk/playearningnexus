import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Star } from 'lucide-react';

export default function DeveloperCard({ developer, followerCount = 0 }) {
  return (
    <Link to={createPageUrl('DeveloperPortfolio') + `?id=${developer.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            {developer.logo_url && (
              <img 
                src={developer.logo_url} 
                alt={developer.company_name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">{developer.company_name}</h3>
              {developer.tagline && (
                <p className="text-sm text-gray-600">{developer.tagline}</p>
              )}
            </div>
          </div>

          {developer.bio && (
            <p className="text-sm text-gray-700 mb-3 line-clamp-2">{developer.bio}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4" />
              <span>{developer.games_count || 0} games</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{followerCount} followers</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}