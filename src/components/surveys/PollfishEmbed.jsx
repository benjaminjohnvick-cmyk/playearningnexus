import React, { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function PollfishEmbed({ onSurveyComplete, userEmail }) {
  const [loading, setLoading] = useState(true);
  const [surveyAvailable, setSurveyAvailable] = useState(false);

  useEffect(() => {
    // Simulate survey availability and completion
    setLoading(true);
    
    // Simulate loading delay
    const loadTimer = setTimeout(() => {
      setLoading(false);
      setSurveyAvailable(true);
    }, 1500);

    // Simulate a survey being available
    const surveyTimer = setTimeout(() => {
      // Auto-complete a survey after 30 seconds for demo
      const randomEarnings = (Math.random() * (3.0 - 0.5) + 0.5).toFixed(2);
      onSurveyComplete({
        earnings: parseFloat(randomEarnings),
        surveyId: `pollfish_${Date.now()}`,
        duration: Math.floor(Math.random() * 10) + 5
      });
    }, 30000);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(surveyTimer);
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