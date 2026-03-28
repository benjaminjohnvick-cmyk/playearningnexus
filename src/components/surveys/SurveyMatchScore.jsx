import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';

/**
 * Computes a 0-100 match score between a user's respondent profile and a survey.
 * Higher = more likely to qualify and complete.
 */
export function computeMatchScore(survey, respondentProfile) {
  if (!respondentProfile || !survey) return 50;

  let score = 50;
  const p = respondentProfile;

  // Category/interest alignment
  const surveyTitle = (survey.title || '').toLowerCase();
  const surveyDesc = (survey.product_description || '').toLowerCase();
  const combined = `${surveyTitle} ${surveyDesc}`;

  const INTEREST_KEYWORDS = {
    'Gaming': ['game', 'gaming', 'gamer', 'play', 'console', 'esport'],
    'Technology': ['tech', 'software', 'app', 'digital', 'computer', 'device'],
    'Finance': ['finance', 'money', 'invest', 'bank', 'credit', 'loan', 'insurance'],
    'Health & Fitness': ['health', 'fitness', 'wellness', 'workout', 'diet', 'exercise'],
    'Travel': ['travel', 'vacation', 'trip', 'hotel', 'flight', 'tourism'],
    'Food & Cooking': ['food', 'recipe', 'restaurant', 'cook', 'meal', 'dining'],
    'Fashion': ['fashion', 'clothing', 'style', 'apparel', 'wear'],
    'Sports': ['sport', 'athlete', 'team', 'football', 'basketball', 'soccer'],
    'Automotive': ['car', 'vehicle', 'auto', 'driver', 'transport'],
    'Parenting': ['parent', 'child', 'family', 'kid', 'baby'],
    'Business': ['business', 'entrepreneur', 'startup', 'company', 'brand', 'marketing'],
  };

  const userInterests = p.interests || [];
  let interestHits = 0;
  userInterests.forEach(interest => {
    const keywords = INTEREST_KEYWORDS[interest] || [];
    if (keywords.some(kw => combined.includes(kw))) interestHits++;
  });
  score += Math.min(interestHits * 8, 24); // up to +24

  // Profile completeness bonus
  const coreFields = ['age_range', 'gender', 'country', 'employment_status', 'education_level', 'household_income'];
  const filled = coreFields.filter(f => p[f]).length;
  score += Math.round((filled / coreFields.length) * 10); // up to +10

  // Verified profile bonus
  if (p.profile_verified) score += 8;
  if ((p.verified_skills || []).length >= 3) score += 5;

  // Quality score bonus (if stored on profile)
  if (p.avg_quality_score >= 85) score += 7;
  else if (p.avg_quality_score >= 70) score += 4;

  // Clamp
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function MatchScoreBadge({ score, size = 'sm' }) {
  if (score == null) return null;

  const config =
    score >= 85 ? { label: 'Excellent Match', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' } :
    score >= 70 ? { label: 'Good Match', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' } :
    score >= 55 ? { label: 'Fair Match', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400' } :
    { label: 'Low Match', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <Target className="w-2.5 h-2.5" />
      {score}% {config.label}
    </span>
  );
}