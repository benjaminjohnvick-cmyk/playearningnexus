import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Share2, X, Sparkles, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function LogoutPromptModal({ isOpen, onClose, onLogout, user, contextData = {} }) {
  const [message, setMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const { 
    completedActivity = null, // 'game', 'survey', 'achievement'
    activityName = '',
    points = 0 
  } = contextData;

  const handleShare = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message to share');
      return;
    }

    setIsPosting(true);
    try {
      // Update user's last social post date
      await base44.auth.updateMe({
        last_social_post_date: new Date().toISOString()
      });

      // Copy message to clipboard for easy sharing
      await navigator.clipboard.writeText(message);
      
      toast.success('Message copied! Share it on your social media.');
      
      // Update localStorage to track this prompt was shown
      localStorage.setItem('lastLogoutPromptShown', new Date().toISOString());
      
      onClose();
      onLogout();
    } catch (error) {
      toast.error('Failed to prepare share');
    } finally {
      setIsPosting(false);
    }
  };

  const handleSkip = () => {
    // Update localStorage even when skipped
    localStorage.setItem('lastLogoutPromptShown', new Date().toISOString());
    onClose();
    onLogout();
  };

  // Generate suggested message based on context
  const getSuggestedMessage = () => {
    if (completedActivity === 'survey') {
      return `Just completed a survey on GamerGain and earned ${points} points! 💰 Join me and start earning while gaming! #GamerGain #EarnMoney #Gaming`;
    } else if (completedActivity === 'game') {
      return `Had an amazing gaming session playing ${activityName} on GamerGain! 🎮 Earning rewards while playing my favorite games! #GamerGain #Gaming`;
    } else if (completedActivity === 'achievement') {
      return `Unlocked the "${activityName}" achievement on GamerGain! 🏆 Leveling up and earning rewards! #GamerGain #Achievement #Gaming`;
    }
    return `Just had a great session on GamerGain! 🎮 Playing games, completing surveys, and earning real rewards. Check it out! #GamerGain #Gaming #EarnWhileYouPlay`;
  };

  const suggestedMessage = getSuggestedMessage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Share2 className="w-6 h-6 text-blue-600" />
            Share Your Success!
          </DialogTitle>
          <DialogDescription>
            Before you go, share your GamerGain experience with your friends!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {completedActivity && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                {completedActivity === 'achievement' && <Trophy className="w-5 h-5 text-yellow-600" />}
                {completedActivity === 'survey' && <Sparkles className="w-5 h-5 text-green-600" />}
                <p className="font-semibold text-gray-900">
                  {completedActivity === 'survey' && 'Survey Completed!'}
                  {completedActivity === 'game' && 'Game Session Finished!'}
                  {completedActivity === 'achievement' && 'Achievement Unlocked!'}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                {activityName && `"${activityName}"`}
                {points > 0 && ` - Earned ${points} points!`}
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Your message
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={suggestedMessage}
              rows={5}
              className="resize-none"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMessage(suggestedMessage)}
            className="w-full"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Use Suggested Message
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={handleShare}
              disabled={isPosting}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {isPosting ? 'Preparing...' : 'Copy & Share'}
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              className="flex-1"
            >
              Skip
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Message will be copied to your clipboard for easy sharing on social media
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}