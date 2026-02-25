import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TolunaEmbed({ userId, onSurveyComplete }) {
  const [isLoading, setIsLoading] = useState(false);

  // Toluna requires server-side integration for member routing
  // This component provides UI to redirect users to Toluna surveys
  const openTolunaSurvey = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, you'd call your backend to get a survey URL from Toluna API
      // For now, showing the integration approach
      const surveyUrl = `https://surveywall.toluna.com/integrate?memberCode=${userId}&partnerGUID=YOUR_PARTNER_GUID`;
      window.open(surveyUrl, '_blank');
    } catch (error) {
      console.error('Error opening Toluna survey:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🌍</span>
          Toluna Surveys
        </CardTitle>
        <CardDescription>
          Global survey network with member routing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-orange-50 border-orange-200">
          <Info className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-sm text-orange-800">
            Toluna requires backend integration. Contact Toluna to get your Partner GUID and set up member routing API.
          </AlertDescription>
        </Alert>

        <div className="bg-orange-100 rounded-lg p-4 text-center">
          <p className="text-lg font-bold text-orange-700">Enterprise Solution</p>
          <p className="text-sm text-orange-600 mt-1">Server-side API required</p>
        </div>

        <Button 
          onClick={openTolunaSurvey}
          className="w-full bg-orange-600 hover:bg-orange-700"
          disabled={isLoading}
        >
          {isLoading ? 'Opening...' : 'Open Toluna Surveys'}
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Global survey availability</p>
          <p>• Member routing API for targeting</p>
          <p>• Setup: Apply at <a href="https://www.toluna.com/corporate/partnerships" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Toluna Corporate Partnerships</a></p>
          <p>• Documentation: <a href="https://docs.integratedpanel.toluna.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Toluna Integration Docs</a></p>
        </div>
      </CardContent>
    </Card>
  );
}