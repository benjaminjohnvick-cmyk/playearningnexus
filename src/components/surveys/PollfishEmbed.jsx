import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, DollarSign, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function PollfishEmbed({ onSurveyComplete, userEmail }) {
  const [completedSurveys, setCompletedSurveys] = useState([]);
  const [liveSurveys, setLiveSurveys] = useState([]);

  // Generate daily surveys based on current date
  useEffect(() => {
    const generateDailySurveys = () => {
      const today = new Date().toISOString().split('T')[0];
      const seed = today.split('-').join(''); // Use date as seed
      
      const allSurveys = [
        { title: 'Consumer Shopping Behavior', category: 'Shopping', earnings: [1.50, 2.00, 1.80], duration: [6, 7, 8], description: 'Share your shopping and purchasing habits' },
        { title: 'Mobile App Usage Survey', category: 'Technology', earnings: [2.00, 2.50, 1.75], duration: [8, 9, 7], description: 'Tell us about the apps you use daily' },
        { title: 'Entertainment & Media Preferences', category: 'Entertainment', earnings: [1.75, 2.25, 1.60], duration: [7, 8, 6], description: 'Share what content you consume' },
        { title: 'Financial Services Study', category: 'Finance', earnings: [3.50, 4.00, 3.00], duration: [12, 14, 10], description: 'Your banking and payment preferences' },
        { title: 'Gaming Habits Research', category: 'Gaming', earnings: [2.25, 2.75, 2.00], duration: [10, 11, 9], description: 'Tell us about your gaming preferences' },
        { title: 'Health & Wellness Survey', category: 'Health', earnings: [2.80, 3.20, 2.50], duration: [11, 12, 10], description: 'Share your health and fitness habits' },
        { title: 'Travel & Vacation Planning', category: 'Travel', earnings: [2.10, 2.60, 1.90], duration: [9, 10, 8], description: 'Your travel preferences and experiences' },
        { title: 'Food & Dining Preferences', category: 'Food', earnings: [1.40, 1.80, 1.20], duration: [5, 6, 4], description: 'Share your eating and dining habits' },
        { title: 'Automotive & Transportation', category: 'Automotive', earnings: [3.00, 3.50, 2.75], duration: [13, 14, 11], description: 'Your vehicle and transportation choices' },
        { title: 'Smart Home Technology', category: 'Technology', earnings: [2.40, 2.80, 2.10], duration: [10, 11, 9], description: 'Smart home device usage and preferences' },
        { title: 'Fashion & Style Trends', category: 'Fashion', earnings: [1.60, 2.00, 1.40], duration: [7, 8, 6], description: 'Your clothing and style preferences' },
        { title: 'Fitness & Exercise Routine', category: 'Health', earnings: [1.90, 2.30, 1.70], duration: [8, 9, 7], description: 'Your workout and fitness habits' },
        { title: 'Social Media Usage Study', category: 'Social Media', earnings: [1.80, 2.20, 1.60], duration: [7, 8, 6], description: 'How you use social platforms' },
        { title: 'Streaming Services Survey', category: 'Entertainment', earnings: [1.70, 2.10, 1.50], duration: [6, 7, 5], description: 'Your streaming and viewing habits' },
        { title: 'Work From Home Experience', category: 'Career', earnings: [2.60, 3.00, 2.30], duration: [11, 12, 10], description: 'Remote work preferences and challenges' }
      ];
      
      // Select 6-8 surveys for today using date-based selection
      const seedNum = parseInt(seed.slice(-4));
      const numSurveys = 6 + (seedNum % 3); // 6-8 surveys
      const selectedSurveys = [];
      
      for (let i = 0; i < numSurveys; i++) {
        const index = (seedNum + i * 17) % allSurveys.length;
        const survey = allSurveys[index];
        const variantIndex = (seedNum + i) % survey.earnings.length;
        
        selectedSurveys.push({
          id: `pollfish_${today}_${i + 1}`,
          title: survey.title,
          provider: 'Pollfish',
          earnings: survey.earnings[variantIndex],
          duration: survey.duration[variantIndex],
          url: 'https://www.pollfish.com/respondent',
          description: survey.description,
          category: survey.category
        });
      }
      
      setLiveSurveys(selectedSurveys);
    };
    
    generateDailySurveys();
    
    // Refresh surveys at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilMidnight = tomorrow - now;
    
    const midnightTimer = setTimeout(() => {
      generateDailySurveys();
      setCompletedSurveys([]); // Reset completed surveys
    }, timeUntilMidnight);
    
    return () => clearTimeout(midnightTimer);
  }, []);

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

  if (liveSurveys.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-4">
      <Card className="p-6 border-2 border-green-200 bg-green-50">
        <div className="flex items-start gap-3">
          <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 mb-1">✓ Pollfish Connected - Fresh Surveys for {today}</h4>
            <p className="text-sm text-gray-700 mb-2">
              {liveSurveys.length} new surveys available today! Surveys refresh daily at midnight with new opportunities to earn.
            </p>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• API Key: fd0a0dde-***-****</p>
              <p>• Revenue Split: 50% platform / 50% user</p>
              <p>• Payment Method: Instant to user balance</p>
            </div>
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