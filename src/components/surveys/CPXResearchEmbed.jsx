import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, TrendingUp } from 'lucide-react';

export default function CPXResearchEmbed({ userId, onSurveyComplete }) {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [surveyCount, setSurveyCount] = useState(0);

  useEffect(() => {
    // Load CPX Research script
    const script = document.createElement('script');
    script.src = 'https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js';
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    document.body.appendChild(script);

    // Configure CPX Research
    const configScript = document.createElement('script');
    configScript.innerHTML = `
      const cpxConfig = {
        general_config: {
          app_id: 'YOUR_CPX_APP_ID', // Replace with your CPX Research App ID
          ext_user_id: '${userId}',
          email: '',
          username: '',
          secure_hash: '',
          subid_1: '',
          subid_2: '',
        },
        style_config: {
          text_color: '#2b2b2b',
          survey_box: {
            topbar_background_color: '#dc2626',
            box_background_color: 'white',
            rounded_borders: true,
            stars_filled: '#dc2626',
          },
        },
        script_config: [{
          div_id: 'cpx-fullscreen',
          theme_style: 1,
          order_by: 2,
          limit_surveys: 10
        }],
        debug: false,
        useIFrame: true,
        iFramePosition: 1,
        functions: {
          no_surveys_available: () => {
            console.log('No CPX surveys available');
          },
          count_new_surveys: (count) => {
            console.log('CPX survey count:', count);
            if (window.setCPXSurveyCount) {
              window.setCPXSurveyCount(count);
            }
          },
          get_all_surveys: (surveys) => {
            console.log('CPX surveys:', surveys);
          },
          get_transaction: (transaction) => {
            console.log('CPX transaction:', transaction);
            if (window.handleCPXTransaction) {
              window.handleCPXTransaction(transaction);
            }
          }
        }
      };
      window.config = cpxConfig;
    `;
    document.head.appendChild(configScript);

    // Set up global callbacks
    window.setCPXSurveyCount = (count) => {
      setSurveyCount(count);
    };

    window.handleCPXTransaction = (transaction) => {
      console.log('CPX Survey completed:', transaction);
      if (onSurveyComplete && transaction.reward_amount) {
        onSurveyComplete(parseFloat(transaction.reward_amount));
      }
    };

    return () => {
      // Safely remove scripts only if they're still in the DOM
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (configScript.parentNode) {
        configScript.parentNode.removeChild(configScript);
      }
      delete window.setCPXSurveyCount;
      delete window.handleCPXTransaction;
      delete window.config;
    };
  }, [userId, onSurveyComplete]);

  return (
    <div className="space-y-4">
      <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">CPX Research Surveys</CardTitle>
                <CardDescription>
                  High-quality surveys with fair rewards
                </CardDescription>
              </div>
            </div>
            {surveyCount > 0 && (
              <div className="px-4 py-2 bg-red-600 text-white rounded-full font-bold">
                {surveyCount} Available
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border-2 border-red-100">
              <h3 className="font-semibold text-gray-900 mb-2">Setup Instructions:</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li>1. Sign up at <a href="https://publisher.cpx-research.com/index.php?page=register" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">CPX Research Publisher Portal</a></li>
                <li>2. Get your App ID from the dashboard</li>
                <li>3. Replace 'YOUR_CPX_APP_ID' in components/surveys/CPXResearchEmbed.jsx</li>
                <li>4. (Optional) Enable secure hash for additional security</li>
              </ol>
              <Button 
                variant="outline" 
                className="mt-4 w-full"
                onClick={() => window.open('https://publisher.cpx-research.com/', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Go to CPX Publisher Portal
              </Button>
            </div>

            {/* CPX Research widget container */}
            <div 
              id="cpx-fullscreen" 
              className="min-h-[400px] bg-white rounded-lg p-4"
            >
              {!isScriptLoaded && (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-red-600"></div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}