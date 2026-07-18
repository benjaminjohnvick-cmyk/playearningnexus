import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function ShareWishlistButton({ userId, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const [shareLink, setShareLink] = useState(null);

  const generateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateWishlistShareLink', {
      wishlist_item_ids: [],
    }),
    onSuccess: (data) => {
      setShareLink(data.share_link);
    },
    onError: () => {
      toast.error('Failed to generate share link');
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Share link copied! 📋');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out my wishlist!',
          text: 'Browse my wishlist and help me win Prize Pool Points',
          url: shareLink,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={size}
          variant="outline"
          onClick={() => {
            if (!shareLink) {
              generateMutation.mutate();
            }
          }}
          className="gap-2"
        >
          <Share2 className="w-4 h-4" />
          Share Wishlist
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Wishlist</DialogTitle>
          <DialogDescription>
            Share with friends to earn Prize Pool Points & credit
          </DialogDescription>
        </DialogHeader>

        {generateMutation.isPending ? (
          <div className="text-center py-4">
            <div className="text-sm text-gray-500">Generating your share link...</div>
          </div>
        ) : shareLink ? (
          <div className="space-y-4">
            <div className="bg-gray-100 p-3 rounded-lg overflow-hidden">
              <code className="text-xs break-all">{shareLink}</code>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                className="flex-1"
                variant="outline"
              >
                Copy Link
              </Button>
              <Button
                onClick={handleShare}
                className="flex-1"
              >
                Share
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}