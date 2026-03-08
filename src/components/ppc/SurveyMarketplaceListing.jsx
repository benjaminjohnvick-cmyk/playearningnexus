import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Users, BarChart2, ShoppingBag, Play, Loader2, FileText } from "lucide-react";
import PPCSurveyTaker from '@/components/ppc/PPCSurveyTaker';

export default function SurveyMarketplaceListing({ user, tier }) {
  const [activeSurvey, setActiveSurvey] = useState(null);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['ppc-surveys-active', tier],
    queryFn: () => base44.entities.PPCSurvey.filter({ status: 'active', tier }),
  });

  if (isLoading) return (
    <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" /></div>
  );

  if (activeSurvey) {
    return <PPCSurveyTaker survey={activeSurvey} user={user} onClose={() => setActiveSurvey(null)} />;
  }

  if (surveys.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="font-semibold text-gray-600">No active surveys yet</h3>
        <p className="text-sm text-gray-400 mt-1">Check back soon — surveys are added regularly</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {surveys.map(survey => (
        <SurveyCard key={survey.id} survey={survey} onTake={() => setActiveSurvey(survey)} />
      ))}
    </div>
  );
}

function SurveyCard({ survey, onTake }) {
  const isProductListing = survey.survey_type === 'product_listing';
  const progress = survey.survey_type === 'data_collection'
    ? Math.min(100, ((survey.responses_count || 0) / (survey.sample_size || 100)) * 100)
    : null;

  return (
    <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {isProductListing && survey.product_image_url && (
        <div className="h-40 overflow-hidden">
          <img src={survey.product_image_url} alt={survey.title} className="w-full h-full object-cover" />
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge className={isProductListing ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'} >
              {isProductListing ? <><ShoppingBag className="w-3 h-3 mr-1" />Product Listing</> : <><BarChart2 className="w-3 h-3 mr-1" />Data Collection</>}
            </Badge>
            <h3 className="font-bold text-gray-900 mt-1.5 text-sm">{survey.title}</h3>
          </div>
          <Badge className="bg-green-100 text-green-700 whitespace-nowrap text-sm font-bold">
            ${survey.cost_per_response?.toFixed(2) || '4.00'}
          </Badge>
        </div>

        {isProductListing && survey.product_description && (
          <p className="text-xs text-gray-500 line-clamp-2">{survey.product_description}</p>
        )}

        {isProductListing && survey.product_price && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Price: <span className="font-bold text-gray-900">${survey.product_price?.toFixed(2)}</span></span>
            <span className="text-gray-400">+10% fee = <span className="font-semibold text-gray-700">${survey.price_with_fee?.toFixed(2)}</span></span>
          </div>
        )}

        {progress !== null && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span><Users className="w-3 h-3 inline mr-1" />{survey.responses_count || 0} / {survey.sample_size || 100} responses</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-400">{(survey.questions || []).length} questions · A/B/C/D</span>
          <Button size="sm" onClick={onTake} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <Play className="w-3.5 h-3.5 mr-1" /> Take Survey
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}