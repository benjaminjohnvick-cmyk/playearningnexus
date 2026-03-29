import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

export default function BitLabsSurveys({ user, onEarningsUpdate }) {
  const [surveyUrl, setSurveyUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [surveyLoaded, setSurveyLoaded] = useState(false);

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getBitLabsSurveyUrl', {
        userId: user.id,
        userEmail: user.email
      });
      if (response.data?.url) {
        setSurveyUrl(response.data.url);
      } else {
        toast.error('Could not load surveys. Please try again.');
      }
    } catch (error) {
      toast.error('Survey service temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  // Listen for survey completion / disqualification via postMessage
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'survey_completed') {
        const userEarnings = (event.data.reward || 0) / 2;
        toast.success(`Survey completed! You earned $${userEarnings.toFixed(2)}`);
        if (onEarningsUpdate) onEarningsUpdate(userEarnings);
      }
      // BitLabs sends 'survey_screenout' or 'survey_disqualified' on DQ
      if (event.data?.type === 'survey_screenout' || event.data?.type === 'survey_disqualified') {
        window.__smartRouting?.triggerDisqualification(event.data?.survey_id || null);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onEarningsUpdate]);

  return (
    <div className="space-y-4">
      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">How Surveys Work</p>
              <p className="text-sm text-blue-800">
                Complete surveys powered by BitLabs. Each survey has a <strong>50/50 revenue split</strong> — 
                you keep <strong>50% of the survey value</strong>. Complete $6 worth to earn your $3 daily goal.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earnings split visual */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-700">50%</p>
            <p className="text-sm text-green-700 font-medium">Your Share</p>
            <p className="text-xs text-gray-500 mt-1">Goes to your balance</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-700">50%</p>
            <p className="text-sm text-purple-700 font-medium">Platform Share</p>
            <p className="text-xs text-gray-500 mt-1">Keeps site running</p>
          </CardContent>
        </Card>
      </div>

      {/* Survey Wall */}
      {!surveyUrl ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">BitLabs Survey Wall</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Click below to load available surveys. Complete them to earn money toward your daily $3 goal.
            </p>
            <Button
              onClick={loadSurveys}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Loading Surveys...
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5 mr-2" />
                  Load Available Surveys
                </>
              )}
            </Button>
            <div className="mt-6 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> Survey availability varies by region. You need at least 1 survey completed to start earning.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Available Surveys</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadSurveys}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <iframe
              src={surveyUrl}
              className="w-full"
              style={{ height: '600px', border: 'none' }}
              onLoad={() => setSurveyLoaded(true)}
              title="BitLabs Survey Wall"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}