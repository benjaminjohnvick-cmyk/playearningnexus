import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Download, Share2, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function MovieStarGenerator() {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setUploadedImageUrl(result.file_url);
      setUploadedImage(file);
      toast.success('Image uploaded successfully!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const generateImageMutation = useMutation({
    mutationFn: async () => {
      const prompt = `Create a high-quality, creative transformation of ${userName} in the reference image. ${imageDescription ? imageDescription : 'Transform them into an epic, cinematic style'}.
      Include subtle GamerGain branding elements (logo or text) integrated naturally into the scene. 
      The image should be vibrant, professional, and social media ready. 
      Style: photorealistic, dynamic lighting, 4K quality.`;
      
      const result = await base44.integrations.Core.GenerateImage({
        prompt,
        existing_image_urls: [uploadedImageUrl]
      });
      
      return result.url;
    },
    onSuccess: (imageUrl) => {
      setGeneratedImage(imageUrl);
      toast.success('Image generated successfully!');
    },
    onError: () => {
      toast.error('Failed to generate image');
    }
  });

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
          <p className="text-gray-600">Upload your photo, enter your name, and let AI create something amazing</p>
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
                <Label>Upload Your Photo</Label>
                <div className="mt-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    className="cursor-pointer"
                  />
                  {uploadedImage && (
                    <div className="mt-2 relative">
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
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Upload your photo from phone or PC
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
                  This will be used in the AI transformation
                </p>
              </div>

              <div>
                <Label>Transformation Style</Label>
                <Input
                  placeholder="e.g., as a superhero, cyberpunk style, fantasy character"
                  value={imageDescription}
                  onChange={(e) => setImageDescription(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Describe how to transform your photo
                </p>
              </div>

              <Button
                onClick={() => generateImageMutation.mutate()}
                disabled={!uploadedImageUrl || !userName.trim() || !imageDescription.trim() || generateImageMutation.isPending}
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
                      <Button
                        onClick={handleDownload}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Image
                      </Button>

                      <div className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-700">Social Media Caption</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCopyCaption}
                            className="h-7"
                          >
                            {captionCopied ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{shareCaption}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShareToSocial('twitter')}
                          className="text-xs"
                        >
                          <Share2 className="w-3 h-3 mr-1" />
                          Twitter
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShareToSocial('facebook')}
                          className="text-xs"
                        >
                          <Share2 className="w-3 h-3 mr-1" />
                          Facebook
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShareToSocial('linkedin')}
                          className="text-xs"
                        >
                          <Share2 className="w-3 h-3 mr-1" />
                          LinkedIn
                        </Button>
                      </div>

                      <p className="text-xs text-gray-500 text-center mt-2">
                        Caption copied automatically - paste it when sharing!
                      </p>
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

        {/* Gallery of Previous Generations */}
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
                <p className="text-sm font-semibold">Upload Photo</p>
                <p className="text-xs text-gray-500">Upload your photo</p>
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