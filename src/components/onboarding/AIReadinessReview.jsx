import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

const SCORE_COLOR = (n) => n >= 80 ? 'text-green-600' : n >= 55 ? 'text-yellow-600' : 'text-red-500';
const SCORE_BG = (n) => n >= 80 ? 'bg-green-100' : n >= 55 ? 'bg-yellow-100' : 'bg-red-100';

export default function AIReadinessReview({ profile, assets, revenue }) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);

  const runReview = async () => {
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a senior app store review specialist at GamerGain, a gaming + survey earning platform.
Evaluate this developer's submission for app store readiness.

Developer Profile:
- Studio: ${profile.company_name}
- Bio length: ${profile.bio?.length || 0} chars
- Website: ${profile.website || 'none'}
- Social links provided: ${Object.values(profile.social_links || {}).filter(Boolean).length}

Game Assets Submitted:
- Game Title: ${assets.game_title}
- Category: ${assets.game_category}
- Description length: ${assets.game_description?.length || 0} chars
- Screenshots uploaded: ${assets.screenshots?.length || 0}
- Icon uploaded: ${assets.icon_url ? 'yes' : 'no'}
- Demo/store URL: ${assets.demo_url || 'none'}
- Supported platforms: ${(assets.platforms || []).join(', ') || 'none'}
- Age rating provided: ${assets.age_rating || 'none'}

Revenue Configuration:
- Payout method: ${revenue.payout_method || 'not set'}
- Tax info completed: ${revenue.tax_completed ? 'yes' : 'no'}
- Payout threshold: $${revenue.min_threshold || 0}
- Revenue model: ${revenue.revenue_model || 'not set'}

Score each category 0-100 and provide specific, actionable feedback.
Be honest - highlight real gaps that could delay approval.

Return JSON:
{
  "overall_score": number,
  "ready_to_submit": boolean,
  "summary": "1 sentence overall assessment",
  "categories": [
    { "name": "string", "score": number, "status": "pass|warn|fail", "feedback": "string" }
  ],
  "blockers": ["string"],
  "improvements": ["string"],
  "estimated_approval_time": "string"
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_score: { type: 'number' },
            ready_to_submit: { type: 'boolean' },
            summary: { type: 'string' },
            categories: { type: 'array', items: { type: 'object' } },
            blockers: { type: 'array', items: { type: 'string' } },
            improvements: { type: 'array', items: { type: 'string' } },
            estimated_approval_time: { type: 'string' },
          }
        }
      });
      setReview(result);
    } catch {
      setReview(null);
    }
    setLoading(false);
  };

  const StatusIcon = ({ status }) => {
    if (status === 'pass') return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />;
    if (status === 'warn') return <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
    return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  };

  return (
    <div className="space-y-4">
      {/* Trigger */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white text-center">
        <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <Bot className="w-7 h-7 text-white" />
        </div>
        <h3 className="font-bold text-lg mb-1">AI Readiness Review</h3>
        <p className="text-sm text-indigo-100 mb-4">
          Get instant feedback on your submission before it goes to the GamerGain review team.
        </p>
        <Button
          onClick={runReview}
          disabled={loading}
          className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          {loading ? 'Analyzing your submission...' : review ? 'Re-run Analysis' : 'Run AI Review'}
        </Button>
      </div>

      {/* Results */}
      {review && (
        <div className="space-y-3">
          {/* Score */}
          <div className={`rounded-2xl p-4 ${SCORE_BG(review.overall_score)} border`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall Score</p>
                <p className={`text-4xl font-black ${SCORE_COLOR(review.overall_score)}`}>{review.overall_score}<span className="text-lg">/100</span></p>
              </div>
              <div className="text-right">
                <Badge className={`text-sm px-3 py-1 ${review.ready_to_submit ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {review.ready_to_submit ? '✓ Ready to Submit' : '✗ Needs Work'}
                </Badge>
                <p className="text-xs text-gray-500 mt-1">Est. approval: {review.estimated_approval_time}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700">{review.summary}</p>
          </div>

          {/* Category breakdown */}
          <div className="space-y-2">
            {(review.categories || []).map((cat, i) => (
              <div key={i} className="flex items-start gap-3 bg-white border rounded-xl p-3">
                <StatusIcon status={cat.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{cat.name}</p>
                    <span className={`text-xs font-bold ${SCORE_COLOR(cat.score)}`}>{cat.score}/100</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.feedback}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Blockers */}
          {review.blockers?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-bold text-red-700 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Must Fix Before Submission</p>
              {review.blockers.map((b, i) => <p key={i} className="text-xs text-red-600">• {b}</p>)}
            </div>
          )}

          {/* Improvements */}
          {review.improvements?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-bold text-amber-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Recommended Improvements</p>
              {review.improvements.map((imp, i) => <p key={i} className="text-xs text-amber-700">• {imp}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}