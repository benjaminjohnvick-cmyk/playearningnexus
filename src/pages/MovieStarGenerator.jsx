import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Download, Share2, Loader2, Copy, Check, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ImageEditor from '@/components/image/ImageEditor';
import ImageGallery from '@/components/image/ImageGallery';
import SocialShareButtons from '@/components/social/SocialShareButtons';

export default function MovieStarGenerator() {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatedImageId, setGeneratedImageId] = useState(null);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState(null);
  const [referralLink, setReferralLink] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: galleryImages = [] } = useQuery({
    queryKey: ['generated-images', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await base44.entities.GeneratedImage.filter({ user_id: user.id }, '-created_date', 50);
    },
    enabled: !!user
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setUploadedImageUrl(result.file_url);
      setUploadedImage(file);
      
      // Create referral link for uploaded image
      const linkCode = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await base44.entities.CustomReferralLink.create({
        user_id: user.id,
        link_code: linkCode,
        link_type: 'campaign',
        campaign_name: `Uploaded Image - ${file.name}`,
        clicks: 0,
        conversions: 0,
        total_earned: 0
      });
      
      const fullReferralLink = `${window.location.origin}/?ref=${linkCode}`;
      setReferralLink(fullReferralLink);
      
      toast.success('Image uploaded with referral link!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const generateImageMutation = useMutation({
    mutationFn: async () => {
      let prompt;
      
      if (uploadedImageUrl) {
        // Transform uploaded photo
        prompt = `Create a high-quality, creative transformation of ${userName} in the reference image. ${imageDescription ? imageDescription : 'Transform them into an epic, cinematic style'}.
        Include subtle GamerGain branding elements (logo or text) integrated naturally into the scene. 
        The image should be vibrant, professional, and social media ready. 
        Style: photorealistic, dynamic lighting, 4K quality.`;
      } else {
        // Generate stock brand image
        prompt = `Create a high-quality promotional image for GamerGain gaming platform featuring ${userName}. ${imageDescription}.
        Include GamerGain branding elements (logo or text) integrated naturally. Gaming aesthetic, vibrant colors, professional, social media ready.
        Style: photorealistic, dynamic lighting, 4K quality, modern gaming brand.`;
      }
      
      const result = await base44.integrations.Core.GenerateImage({
        prompt,
        existing_image_urls: uploadedImageUrl ? [uploadedImageUrl] : undefined
      });
      
      // Save to database
      const savedImage = await base44.entities.GeneratedImage.create({
        user_id: user.id,
        user_name: userName,
        image_url: result.url,
        original_image_url: uploadedImageUrl,
        description: imageDescription
      });
      
      // Create referral link
      const linkCode = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const referralLinkData = await base44.entities.CustomReferralLink.create({
        user_id: user.id,
        link_code: linkCode,
        link_type: 'campaign',
        campaign_name: `AI Image - ${userName}`,
        clicks: 0,
        conversions: 0,
        total_earned: 0
      });
      
      const fullReferralLink = `${window.location.origin}/?ref=${linkCode}`;
      
      return { imageUrl: result.url, imageId: savedImage.id, referralLink: fullReferralLink };
    },
    onSuccess: ({ imageUrl, imageId, referralLink }) => {
      setGeneratedImage(imageUrl);
      setGeneratedImageId(imageId);
      setReferralLink(referralLink);
      setEditedImageUrl(null);
      toast.success('Image generated successfully with referral link!');
    },
    onError: () => {
      toast.error('Failed to generate image');
    }
  });

  const handleSaveEdit = async (editedUrl) => {
    if (generatedImageId) {
      await base44.entities.GeneratedImage.update(generatedImageId, {
        edited_image_url: editedUrl
      });
      setEditedImageUrl(editedUrl);
      setShowEditor(false);
    }
  };

  const handleGalleryImageSelect = (image) => {
    setSelectedGalleryImage(image);
    setGeneratedImage(image.edited_image_url || image.image_url);
    setGeneratedImageId(image.id);
    setUserName(image.user_name);
    setImageDescription(image.description);
  };

  const handleDownload = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `GamerGain_AI_Image.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Image downloaded!');
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const shareCaption = `🌟 Check out this amazing AI-generated image! 

Created with GamerGain's AI Image Generator 🎮✨

#GamerGain #AIArt #AIGenerated #Gaming #CreativeAI`;

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(shareCaption);
    setCaptionCopied(true);
    toast.success('Caption copied to clipboard!');
    setTimeout(() => setCaptionCopied(false), 3000);
  };

  const handleShareToSocial = (platform) => {
    handleCopyCaption();
    
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareCaption)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'width=600,height=400');
      toast.info('Caption copied! Paste it with your image on social media.');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent mb-2">
            AI Image Generator
          </h1>
          <p className="text-gray-600">Upload your photo or create GamerGain brand images with AI</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Create Your Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Upload Your Photo (Optional)</Label>
                <div className="mt-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    className="cursor-pointer"
                  />
                  {uploadedImage && (
                    <div className="mt-2 space-y-2">
                      <div className="relative">
                        <img
                          src={URL.createObjectURL(uploadedImage)}
                          alt="Uploaded"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setUploadedImage(null);
                            setUploadedImageUrl(null);
                            setReferralLink(null);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                      {referralLink && (
                        <div className="bg-green-50 p-2 rounded border border-green-200">
                          <p className="text-xs text-green-800 font-medium mb-1">📎 Tracking Link Created</p>
                          <div className="flex gap-1">
                            <Input
                              value={referralLink}
                              readOnly
                              className="text-xs h-7"
                            />
                            <Button
                              size="sm"
                              className="h-7"
                              onClick={() => {
                                navigator.clipboard.writeText(referralLink);
                                toast.success('Link copied!');
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Upload from phone/PC to transform your photo, or skip to create stock AI images
                </p>
              </div>

              <div>
                <Label>Your Name</Label>
                <Input
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Name to feature in the image
                </p>
              </div>

              <div>
                <Label>{uploadedImageUrl ? 'Transformation Style' : 'Image Description'}</Label>
                <Input
                  placeholder={uploadedImageUrl ? "e.g., as a superhero, cyberpunk style" : "e.g., gaming champion holding a trophy, futuristic gamer setup"}
                  value={imageDescription}
                  onChange={(e) => setImageDescription(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {uploadedImageUrl ? 'How to transform your photo' : 'Describe the GamerGain brand image to create'}
                </p>
              </div>

              <Button
                onClick={() => generateImageMutation.mutate()}
                disabled={!userName.trim() || !imageDescription.trim() || generateImageMutation.isPending}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {generateImageMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating... (may take 10-15 seconds)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Image
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Images include GamerGain branding for promotional use
              </p>
            </CardContent>
          </Card>

          {/* Generated Image Section */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Image</CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {generatedImage ? (
                  <motion.div
                    key={generatedImage}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="space-y-4"
                  >
                    <img
                      src={generatedImage}
                      alt="AI-generated image"
                      className="w-full rounded-lg shadow-lg"
                    />

                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => setShowEditor(true)}
                          variant="outline"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          onClick={handleDownload}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>

                      {referralLink && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-200 mb-3">
                          <Label className="text-sm font-semibold text-green-800 mb-2 block">Your Tracking Link</Label>
                          <div className="flex gap-2">
                            <Input
                              value={referralLink}
                              readOnly
                              className="text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(referralLink);
                                toast.success('Referral link copied!');
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-green-700 mt-2">
                            💰 Share this link to earn 10% from all referrals!
                          </p>
                        </div>
                      )}

                      <SocialShareButtons
                        imageUrl={generatedImage}
                        caption={`🎮 Check out my amazing AI-generated image by GamerGain! ${userName ? `Featuring ${userName}!` : ''} Create yours now and start earning! 💰 ${referralLink ? `\n\nJoin here: ${referralLink}` : ''} #GamerGain #AIArt #${userName?.replace(/\s+/g, '')}`}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300"
                  >
                    <div className="text-center text-gray-500">
                      <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Your generated image will appear here</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Image Editor Modal */}
        {showEditor && generatedImage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="max-w-2xl w-full">
              <ImageEditor
                imageUrl={editedImageUrl || generatedImage}
                imageId={generatedImageId}
                onSave={handleSaveEdit}
                onClose={() => setShowEditor(false)}
              />
            </div>
          </div>
        )}

        {/* Gallery */}
        <div className="mt-6">
          <ImageGallery
            images={galleryImages}
            onImageSelect={handleGalleryImageSelect}
          />
        </div>

        {/* How It Works */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-purple-700 font-bold">1</span>
                </div>
                <p className="text-sm font-semibold">Upload or Skip</p>
                <p className="text-xs text-gray-500">Upload photo or create stock image</p>
              </div>
              <div className="text-center">
                <div className="bg-pink-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-pink-700 font-bold">2</span>
                </div>
                <p className="text-sm font-semibold">Enter Name & Style</p>
                <p className="text-xs text-gray-500">Add your name and transformation style</p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-blue-700 font-bold">3</span>
                </div>
                <p className="text-sm font-semibold">Generate</p>
                <p className="text-xs text-gray-500">AI creates your image</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-green-700 font-bold">4</span>
                </div>
                <p className="text-sm font-semibold">Share</p>
                <p className="text-xs text-gray-500">Download & post to social</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}