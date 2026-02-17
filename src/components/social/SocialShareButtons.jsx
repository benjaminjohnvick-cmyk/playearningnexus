import React from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Twitter, Facebook, Instagram, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function SocialShareButtons({ imageUrl, caption, platform = null }) {
  const encodedCaption = encodeURIComponent(caption);
  const encodedImageUrl = encodeURIComponent(imageUrl);

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedCaption}&url=${encodedImageUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedImageUrl}&quote=${encodedCaption}`,
    instagram: null // Instagram doesn't support direct URL sharing, needs to be done via app
  };

  const handleShare = (platform) => {
    if (platform === 'instagram') {
      // Copy caption for Instagram
      navigator.clipboard.writeText(caption);
      toast.success('Caption copied! Open Instagram app to share your image.');
      return;
    }

    const url = shareUrls[platform];
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(caption);
    toast.success('Caption copied to clipboard!');
  };

  const handleDownloadAndShare = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gamergain-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      handleCopyCaption();
      toast.success('Image downloaded and caption copied! Share on your preferred platform.');
    } catch (error) {
      toast.error('Failed to download image');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Share Your Image:</p>
      
      <div className="grid grid-cols-2 gap-2">
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
          onClick={() => handleShare('instagram')}
          className="bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90 text-white"
        >
          <Instagram className="w-4 h-4 mr-2" />
          Instagram
        </Button>
        
        <Button
          onClick={handleCopyCaption}
          variant="outline"
        >
          <Copy className="w-4 h-4 mr-2" />
          Copy Caption
        </Button>
      </div>

      <Button
        onClick={handleDownloadAndShare}
        variant="outline"
        className="w-full"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Download & Share
      </Button>

      {platform && (
        <p className="text-xs text-center text-gray-500 mt-2">
          📱 Today's platform: <span className="font-semibold">{platform}</span>
        </p>
      )}
    </div>
  );
}