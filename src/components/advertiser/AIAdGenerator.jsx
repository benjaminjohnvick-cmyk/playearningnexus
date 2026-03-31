import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Globe, Loader2, RefreshCw, CheckCircle, Image, Tag, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function AIAdGenerator({ onApply }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const analyzeUrl = async () => {
    if (!url) { toast.error('Enter a landing page URL first'); return; }
    setLoading(true);
    setResult(null);
    try {
      const data = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert advertising copywriter. Analyze the business at this URL and generate ad creative assets: ${url}
        
Return a JSON with exactly these fields:
- brand_name: Short brand/company name (2-4 words max)
- taglines: Array of 4 punchy taglines (max 8 words each), from bold to playful
- keywords: Array of 5 keywords describing the business
- color_theme: Dominant color that fits the brand (hex code)
- ad_prompt: A detailed image generation prompt for a square 256x256 ad thumbnail — describe a visually striking, professional advertisement graphic for this business. Include style, colors, composition. No text in image.
- description: 1-sentence business description`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            brand_name: { type: 'string' },
            taglines: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            color_theme: { type: 'string' },
            ad_prompt: { type: 'string' },
            description: { type: 'string' },
          },
        },
      });
      setResult({ ...data, selectedTagline: data.taglines?.[0] || '', imageUrl: null });
    } catch (err) {
      toast.error('Could not analyze URL. Check the address and try again.');
    }
    setLoading(false);
  };

  const generateImage = async () => {
    if (!result?.ad_prompt) return;
    setGenerating(true);
    try {
      const { url: imageUrl } = await base44.integrations.Core.GenerateImage({
        prompt: result.ad_prompt + ' Square format, high quality, professional advertisement thumbnail, no text.',
      });
      setResult(r => ({ ...r, imageUrl }));
      toast.success('Ad thumbnail generated!');
    } catch (err) {
      toast.error('Image generation failed. Try regenerating.');
    }
    setGenerating(false);
  };

  const handleApply = () => {
    if (!result) return;
    onApply({
      brand_name: result.brand_name,
      tagline: result.selectedTagline,
      landing_url: url,
      image_url: result.imageUrl,
    });
    toast.success('AI-generated assets applied to your ad form!');
  };

  return (
    <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-black" />
        </div>
        <div>
          <h3 className="text-white font-black text-sm">AI Ad Generator</h3>
          <p className="text-gray-500 text-xs">Paste your URL — AI generates thumbnail + taglines in seconds</p>
        </div>
      </div>

      {/* URL input */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://yourbusiness.com"
            className="bg-gray-800 border-gray-600 text-white pl-9 placeholder-gray-600"
            onKeyDown={e => e.key === 'Enter' && analyzeUrl()}
          />
        </div>
        <Button
          onClick={analyzeUrl}
          disabled={loading || !url}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-1 flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Analyzing...' : 'Generate'}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Brand info */}
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex-shrink-0"
                style={{ background: result.color_theme || '#f59e0b' }}
              />
              <div>
                <p className="text-white font-black text-base">{result.brand_name}</p>
                <p className="text-gray-400 text-xs">{result.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(result.keywords || []).map((kw, i) => (
                <span key={i} className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full text-[10px]">{kw}</span>
              ))}
            </div>
          </div>

          {/* Tagline selector */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Tag className="w-3 h-3" /> Choose a Tagline
            </p>
            <div className="space-y-2">
              {(result.taglines || []).map((tagline, i) => (
                <button
                  key={i}
                  onClick={() => setResult(r => ({ ...r, selectedTagline: tagline }))}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-all flex items-center gap-2 ${
                    result.selectedTagline === tagline
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300'
                      : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {result.selectedTagline === tagline && <CheckCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                  "{tagline}"
                </button>
              ))}
            </div>
          </div>

          {/* Thumbnail */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Image className="w-3 h-3" /> AI Thumbnail
            </p>
            {result.imageUrl ? (
              <div className="flex items-start gap-4">
                <img
                  src={result.imageUrl}
                  alt="AI generated thumbnail"
                  className="w-28 h-28 object-cover rounded-xl border border-gray-600"
                />
                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 gap-1 text-xs"
                    onClick={generateImage}
                    disabled={generating}
                  >
                    <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                  <p className="text-gray-600 text-xs">Not happy? Click to try a new variation.</p>
                </div>
              </div>
            ) : (
              <Button
                onClick={generateImage}
                disabled={generating}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2 text-sm"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                {generating ? 'Generating thumbnail...' : 'Generate AI Thumbnail'}
              </Button>
            )}
          </div>

          {/* Apply button */}
          <Button
            onClick={handleApply}
            className="w-full h-11 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-2 rounded-xl"
          >
            <CheckCircle className="w-4 h-4" />
            Apply to New Ad Form
          </Button>
        </div>
      )}

      {!result && !loading && (
        <div className="text-center py-4 text-gray-600 text-xs">
          Enter your website URL above and click Generate to create your ad assets with AI
        </div>
      )}
    </div>
  );
}