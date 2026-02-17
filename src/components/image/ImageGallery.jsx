import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Share2, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';

export default function ImageGallery({ images, onImageSelect }) {
  const queryClient = useQueryClient();

  const deleteImageMutation = useMutation({
    mutationFn: async (imageId) => {
      await base44.entities.GeneratedImage.delete(imageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['generated-images']);
      toast.success('Image deleted');
    }
  });

  const handleDownload = async (imageUrl, imageName) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${imageName}_GamerGain.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Image downloaded!');
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const handleShare = (image) => {
    const shareCaption = `🌟 Check out my AI-generated image created with GamerGain! 🎮✨\n\n#GamerGain #AIArt #AIGenerated`;
    navigator.clipboard.writeText(shareCaption);
    toast.success('Caption copied! Share on social media');
  };

  if (!images || images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Your Gallery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No images yet. Generate your first image!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Your Gallery ({images.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="group relative"
            >
              <img
                src={image.edited_image_url || image.image_url}
                alt={image.description}
                className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onImageSelect(image)}
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(image.edited_image_url || image.image_url, image.user_name);
                  }}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(image);
                  }}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-400 hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this image?')) {
                      deleteImageMutation.mutate(image.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-1 truncate">{image.description}</p>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}