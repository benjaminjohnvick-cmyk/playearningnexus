import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';

export default function PollfishWebEmbed({ userId, onSurveyComplete }) {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [surveyAvailable, setSurveyAvailable] = useState(false);

  useEffect(() => {
    let script = null;
    let mounted = true;

    // Load Pollfish Web Plugin
    script = document.createElement('script');
    script.src = 'https://storage.googleapis.com/pollfish_production/sdk/webplugin/pollfish.min.js';
    script.async = true;
    script.onload = () => {
      if (mounted && window.Pollfish) {
        // Initialize Pollfish
        window.Pollfish.initWebPlugin({
          api_key: 'YOUR_POLLFISH_API_KEY', // Replace with actual API key
          user_id: userId,
          ready: () => {
            if (mounted) {
              setIsScriptLoaded(true);
            }
          },
          surveyAvailable: () => {
            if (mounted) {
              setSurveyAvailable(true);
            }
          },
          surveyNotAvailable: () => {
            if (mounted) {
              setSurveyAvailable(false);
            }
          },
          surveyCompleted: (data) => {
            if (mounted && onSurveyComplete) {
              // Pollfish typically pays $0.30 - $3.00 per survey
              const estimatedPayout = 0.50; // You'll get actual payout from server callback
              onSurveyComplete(estimatedPayout);
            }
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
        
        if (window.Pollfish) {
          delete window.Pollfish;
        }
      }, 100);
    };
  }, [userId, onSurveyComplete]);

  const showPollfish = () => {
    if (window.Pollfish) {
      window.Pollfish.showFullSurvey();
    }
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Pollfish Surveys
        </CardTitle>
        <CardDescription>
          Mobile-first survey experience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScriptLoaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading Pollfish surveys...</span>
          </div>
        ) : (
          <>
            <div className={`rounded-lg p-4 text-center ${surveyAvailable ? 'bg-green-100' : 'bg-gray-100'}`}>
              <p className="text-lg font-bold">
                {surveyAvailable ? '✓ Survey Available' : '⏳ No Surveys Yet'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {surveyAvailable ? 'Ready to start earning!' : 'Check back soon'}
              </p>
            </div>

            <Button 
              onClick={showPollfish}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={!surveyAvailable}
            >
              Start Pollfish Survey
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>

            <div className="text-xs text-gray-500 space-y-1">
              <p>• Earn $0.30 - $3.00 per survey</p>
              <p>• Mobile-optimized experience</p>
              <p>• Setup: Get your API key from <a href="https://www.pollfish.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Pollfish Dashboard</a></p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}