import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';

export default function BitLabsEmbed({ userId, onSurveyComplete }) {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [surveyCount, setSurveyCount] = useState(0);

  useEffect(() => {
    let script = null;
    let mounted = true;

    // Load BitLabs script
    script = document.createElement('script');
    script.src = 'https://web.bitlabs.ai/bitlabs-sdk.min.js';
    script.async = true;
    script.onload = () => {
      if (mounted && window.BitLabs) {
        // Initialize BitLabs
        window.BitLabs.init({
          token: 'YOUR_BITLABS_TOKEN', // Replace with actual token from BitLabs dashboard
          uid: userId,
        });

        // Get survey count
        window.BitLabs.getSurveys().then((surveys) => {
          if (mounted) {
            setSurveyCount(surveys.length);
            setIsScriptLoaded(true);
          }
        });

        // Handle survey completion
        window.BitLabs.on('reward', (data) => {
          if (mounted && onSurveyComplete) {
            onSurveyComplete(data.payout / 100); // Convert from cents to dollars
          }
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      mounted = false;
      setTimeout(() => {
        if (script && document.contains(script)) {
          try {
            script.remove();
          } catch (e) {
            // Already removed
          }
        }
        
        if (window.BitLabs) {
          delete window.BitLabs;
        }
      }, 100);
    };
  }, [userId, onSurveyComplete]);

  const openBitLabs = () => {
    if (window.BitLabs) {
      window.BitLabs.show();
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🔬</span>
          BitLabs Surveys
        </CardTitle>
        <CardDescription>
          High-quality surveys from multiple providers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScriptLoaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span className="ml-2 text-gray-600">Loading BitLabs surveys...</span>
          </div>
        ) : (
          <>
            <div className="bg-purple-100 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-700">{surveyCount}</p>
              <p className="text-sm text-purple-600 mt-1">Available Surveys</p>
            </div>

            <Button 
              onClick={openBitLabs}
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={surveyCount === 0}
            >
              Start BitLabs Surveys
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>

            <div className="text-xs text-gray-500 space-y-1">
              <p>• Surveys from 7+ major marketplaces</p>
              <p>• Instant rewards upon completion</p>
              <p>• Setup: Get your token from <a href="https://publisher.bitlabs.ai" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">BitLabs Publisher Dashboard</a></p>
            </div>
          </>
        )}

        <div id="bitlabs-container" />
      </CardContent>
    </Card>
  );
}