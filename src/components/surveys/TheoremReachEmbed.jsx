import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';

export default function TheoremReachEmbed({ userId, onSurveyComplete }) {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [surveyCount, setSurveyCount] = useState(0);

  useEffect(() => {
    let script = null;
    let mounted = true;

    // Load TheoremReach script
    script = document.createElement('script');
    script.innerHTML = `
      window.theoremReachSettings = {
        apiKey: 'YOUR_THEOREMREACH_API_KEY', // Replace with actual API key
        userId: '${userId}',
        onReward: function(data) {
          window.theoremReachReward && window.theoremReachReward(data);
        },
        onSurveyAvailable: function(count) {
          window.theoremReachSurveyCount && window.theoremReachSurveyCount(count);
        }
      };
      
      (function() {
        var s = document.createElement('script');
        s.src = 'https://theoremreach.com/static/js/widget.js';
        s.async = true;
        document.head.appendChild(s);
      })();
    `;
    document.head.appendChild(script);

    // Set up callbacks
    window.theoremReachSurveyCount = (count) => {
      if (mounted) {
        setSurveyCount(count);
        setIsScriptLoaded(true);
      }
    };

    window.theoremReachReward = (data) => {
      if (mounted && onSurveyComplete && data.reward_amount) {
        onSurveyComplete(data.reward_amount);
      }
    };

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
        
        delete window.theoremReachSettings;
        delete window.theoremReachSurveyCount;
        delete window.theoremReachReward;
      }, 100);
    };
  }, [userId, onSurveyComplete]);

  const openTheoremReach = () => {
    if (window.TheoremReach) {
      window.TheoremReach.showRewardCenter();
    }
  };

  return (
    <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          TheoremReach Surveys
        </CardTitle>
        <CardDescription>
          Rewarded surveys and offers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScriptLoaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            <span className="ml-2 text-gray-600">Loading TheoremReach...</span>
          </div>
        ) : (
          <>
            <div className="bg-green-100 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{surveyCount}</p>
              <p className="text-sm text-green-600 mt-1">Available Surveys</p>
            </div>

            <Button 
              onClick={openTheoremReach}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={surveyCount === 0}
            >
              Open TheoremReach
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>

            <div className="text-xs text-gray-500 space-y-1">
              <p>• Surveys + rewarded offers</p>
              <p>• Quick qualification process</p>
              <p>• Setup: Get your API key from <a href="https://theoremreach.com/publisher" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">TheoremReach Publisher Portal</a></p>
            </div>
          </>
        )}

        <div id="theoremreach-container" />
      </CardContent>
    </Card>
  );
}