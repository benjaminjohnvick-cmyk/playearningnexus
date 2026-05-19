import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, Send, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerFeedbackSurvey() {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [closed, setClosed] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim() || rating === 0) {
      toast.error('Please provide a rating and feedback');
      return;
    }

    setSubmitting(true);
    try {
      // Store feedback in database
      await base44.asServiceRole.entities.DailyFeedbackSurvey?.create?.({
        user_feedback: feedback,
        rating,
        submitted_at: new Date().toISOString(),
        survey_type: 'customer_experience'
      }).catch(() => null);

      // Log feedback for AI learning
      await base44.functions.invoke('aiAgentLearningSystem', {
        agent_name: 'user_feedback_processor',
        action_taken: 'collect_feedback',
        outcome: rating / 5,
        success: rating >= 4,
        user_feedback: feedback,
        improvement_notes: `User rated experience ${rating}/5: ${feedback.substring(0, 100)}`
      }).catch(() => null);

      setSubmitted(true);
      toast.success('Thank you for your feedback!');
      
      setTimeout(() => {
        setRating(0);
        setFeedback('');
        setSubmitted(false);
      }, 2000);
    } catch (e) {
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (closed) {
    return null;
  }

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6 text-center">
          <p className="text-green-700 font-medium">✓ Feedback received! Thank you for helping us improve.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          How's Your Experience?
        </CardTitle>
        <button
          onClick={() => setClosed(true)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Close survey"
        >
          <X className="w-5 h-5" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-3">Rate your experience (1-5 stars)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Tell us more (optional)</label>
          <Textarea
            placeholder="What can we improve? What did you love? Any issues?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            maxLength={500}
            className="h-24 resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">{feedback.length}/500</p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1 gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Your feedback helps our AI agents learn and improve ✨
        </p>
      </CardContent>
    </Card>
  );
}