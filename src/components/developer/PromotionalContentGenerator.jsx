import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Copy, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function PromotionalContentGenerator({ game }) {
  const [platform, setPlatform] = useState('twitter');
  const [contentType, setContentType] = useState('promotional');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generatedContent, setGeneratedContent] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const platforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok'];
  const contentTypes = ['promotional', 'educational', 'engagement', 'announcement', 'behind_the_scenes'];

  const generateContent = async () => {
    setIsGenerating(true);
    try {
      const prompt = `Create ${contentType} social media content for ${platform} about the game "${game.title}".

Game Details:
- Title: ${game.title}
- Description: ${game.description}
- Genre: ${game.category}
- Price: ${game.price > 0 ? `$${game.price}` : 'Free'}

Platform: ${platform}
Content Type: ${contentType}
${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

Create engaging, platform-appropriate content with hashtags and call-to-action.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } },
            image_prompt: { type: 'string' }
          }
        }
      });

      setGeneratedContent(response);
      toast.success('Content generated successfully!');
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImage = async () => {
    if (!generatedContent?.image_prompt) return;
    
    setIsGenerating(true);
    try {
      const imageResponse = await base44.integrations.Core.GenerateImage({
        prompt: generatedContent.image_prompt
      });
      
      setGeneratedContent({
        ...generatedContent,
        image_url: imageResponse.url
      });
      toast.success('Image generated!');
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Generate Promotional Content
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Platform</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map(p => (
                <Badge
                  key={p}
                  className={`cursor-pointer ${platform === p ? 'bg-purple-600' : 'bg-gray-200 text-gray-700'}`}
                  onClick={() => setPlatform(p)}
                >
                  {p}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Content Type</label>
            <div className="flex flex-wrap gap-2">
              {contentTypes.map(t => (
                <Badge
                  key={t}
                  className={`cursor-pointer ${contentType === t ? 'bg-blue-600' : 'bg-gray-200 text-gray-700'}`}
                  onClick={() => setContentType(t)}
                >
                  {t.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Additional Instructions (Optional)</label>
            <Textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g., Focus on action features, mention discount code..."
              rows={3}
            />
          </div>

          <Button 
            onClick={generateContent} 
            disabled={isGenerating}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Content</CardTitle>
        </CardHeader>
        <CardContent>
          {!generatedContent ? (
            <div className="text-center py-12 text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Click "Generate Content" to create promotional material</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Textarea 
                  value={generatedContent.content}
                  readOnly
                  rows={8}
                  className="pr-10"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(generatedContent.content)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              {generatedContent.hashtags?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Suggested Hashtags:</p>
                  <div className="flex flex-wrap gap-2">
                    {generatedContent.hashtags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="cursor-pointer" onClick={() => copyToClipboard(tag)}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {generatedContent.image_url ? (
                <div>
                  <img 
                    src={generatedContent.image_url} 
                    alt="Generated promotional" 
                    className="w-full rounded-lg"
                  />
                </div>
              ) : generatedContent.image_prompt && (
                <Button 
                  onClick={generateImage} 
                  disabled={isGenerating}
                  variant="outline"
                  className="w-full"
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Generate Promotional Image
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}