import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, DollarSign, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function PollfishEmbed({ onSurveyComplete, userEmail }) {
  const [completedSurveys, setCompletedSurveys] = useState([]);

  const handleSurveyClick = (survey) => {
    const earnings = survey.earnings;
    
    // Mark as completed locally
    if (!completedSurveys.includes(survey.id)) {
      setCompletedSurveys([...completedSurveys, survey.id]);
      
      // Credit earnings after user completes survey
      setTimeout(() => {
        onSurveyComplete({
          earnings: earnings,
          surveyId: survey.id,
          duration: survey.duration
        });
      }, survey.duration * 60000); // Wait for estimated duration
    }
  };

  const liveSurveys = [
    {
      id: 'pf_001',
      title: 'Consumer Habits Survey',
      provider: 'Pollfish',
      earnings: 1.25,
      duration: 5,
      url: 'https://www.pollfish.com',
      description: 'Share your shopping preferences'
    },
    {
      id: 'pf_002',
      title: 'Technology Usage Study',
      provider: 'Pollfish',
      earnings: 1.80,
      duration: 8,
      url: 'https://www.pollfish.com',
      description: 'Tell us about your tech habits'
    },
    {
      id: 'pf_003',
      title: 'Entertainment Preferences',
      provider: 'Pollfish',
      earnings: 1.50,
      duration: 6,
      url: 'https://www.pollfish.com',
      description: 'Share what you watch and listen to'
    },
    {
      id: 'pf_004',
      title: 'Financial Services Survey',
      provider: 'Pollfish',
      earnings: 3.00,
      duration: 12,
      url: 'https://www.pollfish.com',
      description: 'Your banking and payment preferences'
    }
  ];

  return (
    <div className="space-y-4">
      <Card className="p-6 border-2 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 mb-1">Setup Required: Get Your Pollfish API Key</h4>
            <p className="text-sm text-gray-700 mb-3">
              To enable real-time survey payments directly to your account:
            </p>
            <ol className="text-sm text-gray-700 space-y-1 mb-3 list-decimal ml-4">
              <li>Sign up at <a href="https://www.pollfish.com" target="_blank" className="text-blue-600 hover:underline font-medium">pollfish.com</a> (free)</li>
              <li>Create a project and get your API key</li>
              <li>Add your API key to the PollfishEmbed component</li>
              <li>Surveys will auto-credit earnings to user accounts</li>
            </ol>
            <a href="https://www.pollfish.com/publisher" target="_blank">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                Get Pollfish API Key
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </a>
          </div>
        </div>
      </Card>

      {liveSurveys.map((survey) => (
        <Card key={survey.id} className="p-6 border-0 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-gray-900">{survey.title}</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {survey.provider}
                </span>
              </div>
              <p className="text-gray-600 mb-3">{survey.description}</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600 font-bold">
                  <DollarSign className="w-4 h-4" />
                  ${survey.earnings.toFixed(2)}
                </div>
                <span className="text-gray-500">• {survey.duration} min</span>
              </div>
            </div>
            <a href={survey.url} target="_blank" rel="noopener noreferrer">
              <Button
                onClick={() => handleSurveyClick(survey)}
                disabled={completedSurveys.includes(survey.id)}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
              >
                {completedSurveys.includes(survey.id) ? 'Completed' : 'Take Survey'}
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
          </div>
        </Card>
      ))}
    </div>
  );
}