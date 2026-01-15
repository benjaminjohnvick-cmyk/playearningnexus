import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Twitter, Facebook, Linkedin, Share2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function SocialSharePrompt({ isOpen, onClose, game, action = "purchased" }) {
  const shareText = `Just ${action} ${game.title}! ${game.description?.substring(0, 100)}... Check it out on GameRewards! 🎮`;
  const shareUrl = window.location.origin;

  const handleShare = (platform) => {
    let url = '';
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareUrl);

    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
    }

    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
      toast.success('Share window opened!');
      onClose();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    toast.success('Copied to clipboard!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-purple-600" />
            Share Your Experience!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
            <p className="text-sm text-gray-700 mb-2">Tell your friends about {game.title}!</p>
            <p className="text-xs text-gray-600 italic">"{shareText}"</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Button
              onClick={() => handleShare('twitter')}
              className="bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
            >
              <Twitter className="w-4 h-4 mr-2" />
              Twitter
            </Button>
            <Button
              onClick={() => handleShare('facebook')}
              className="bg-[#4267B2] hover:bg-[#365899] text-white"
            >
              <Facebook className="w-4 h-4 mr-2" />
              Facebook
            </Button>
            <Button
              onClick={() => handleShare('linkedin')}
              className="bg-[#0077B5] hover:bg-[#006399] text-white"
            >
              <Linkedin className="w-4 h-4 mr-2" />
              LinkedIn
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={handleCopy}
            className="w-full"
          >
            Copy Share Text
          </Button>

          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-gray-600"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}