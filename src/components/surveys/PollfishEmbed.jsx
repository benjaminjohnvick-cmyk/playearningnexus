import React, { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function PollfishEmbed({ onSurveyComplete, userEmail }) {
  const [loading, setLoading] = useState(true);
  const [surveyAvailable, setSurveyAvailable] = useState(false);

  useEffect(() => {
    // Load Pollfish SDK
    const script = document.createElement('script');
    script.src = 'https://storage.googleapis.com/pollfish_production/sdk/webplugin/pollfish.min.js';
    script.async = true;
    
    script.onload = () => {
      // Initialize Pollfish
      window.Pollfish = window.Pollfish || {};
      window.Pollfish.init({
        api_key: 'YOUR_POLLFISH_API_KEY', // Replace with actual key
        indicator_position: 'MIDDLE_RIGHT',
        indicator_padding: 10,
        ready: () => {
          setLoading(false);
          setSurveyAvailable(true);
          console.log('Pollfish ready');
        },
        surveyCompleted: (data) => {
          const earnings = data.survey_price / 100; // Convert cents to dollars
          onSurveyComplete({
            earnings: earnings,
            surveyId: data.survey_cpa,
            duration: data.survey_loi
          });
          toast.success(`Survey completed! You earned $${earnings.toFixed(2)}`);
        },
        userNotEligible: () => {
          toast.info('No surveys available right now. Check back later!');
          setLoading(false);
        },
        surveyNotAvailable: () => {
          setSurveyAvailable(false);
          setLoading(false);
        }
      });
    };

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [onSurveyComplete]);

  return (
    <Card className="p-8 border-0 shadow-xl bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="text-center">
        {loading ? (
          <>
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Loading Pollfish Surveys...</h3>
            <p className="text-gray-600">Finding the best surveys for you</p>
          </>
        ) : surveyAvailable ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Surveys Ready!</h3>
            <p className="text-gray-600 mb-4">Click the Pollfish indicator on the right side of your screen to start earning</p>
            <div className="flex items-center justify-center gap-2 text-green-600">
              <DollarSign className="w-5 h-5" />
              <span className="font-bold">Earn $0.30 - $5.00 per survey</span>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">😴</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Surveys Right Now</h3>
            <p className="text-gray-600">Check back in a few hours for new surveys</p>
          </>
        )}
      </div>
    </Card>
  );
}