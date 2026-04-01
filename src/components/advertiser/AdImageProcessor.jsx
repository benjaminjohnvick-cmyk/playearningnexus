import React, { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload, ImageIcon, CheckCircle2, Loader2, Download, RefreshCw,
  AlertCircle, Sparkles, ZoomIn, Crop
} from 'lucide-react';

const PLATFORM_SPECS = [
  {
    id: 'meta',
    name: 'Meta Ads',
    icon: '📘',
    color: 'blue',
    formats: [
      { label: 'Feed (Square)', w: 1080, h: 1080, type: 'image/jpeg', ratio: '1:1', use: 'Facebook & Instagram Feed' },
      { label: 'Story / Reel', w: 1080, h: 1920, type: 'image/jpeg', ratio: '9:16', use: 'Stories & Reels' },
      { label: 'Landscape Feed', w: 1200, h: 628, type: 'image/jpeg', ratio: '1.91:1', use: 'Link Preview / News Feed' },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok Ads',
    icon: '🎵',
    color: 'pink',
    formats: [
      { label: 'In-Feed Video Cover', w: 1080, h: 1920, type: 'image/jpeg', ratio: '9:16', use: 'In-Feed Ad Thumbnail' },
      { label: 'TopView Cover', w: 1080, h: 1080, type: 'image/jpeg', ratio: '1:1', use: 'TopView Ad' },
    ],
  },
  {
    id: 'google',
    name: 'Google Ads',
    icon: '🔍',
    color: 'green',
    formats: [
      { label: 'Responsive Display (Square)', w: 1200, h: 1200, type: 'image/jpeg', ratio: '1:1', use: 'Display Network' },
      { label: 'Responsive Display (Land)', w: 1200, h: 628, type: 'image/jpeg', ratio: '1.91:1', use: 'Display Network' },
      { label: 'Leaderboard Banner', w: 728, h: 90, type: 'image/png', ratio: '728:90', use: 'Search / Display Banner' },
      { label: 'Rectangle', w: 300, h: 250, type: 'image/png', ratio: '6:5', use: 'Medium Rectangle' },
    ],
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    icon: '🐦',
    color: 'sky',
    formats: [
      { label: 'Website Card', w: 1200, h: 628, type: 'image/jpeg', ratio: '1.91:1', use: 'Website Card' },
      { label: 'App Card', w: 800, h: 800, type: 'image/jpeg', ratio: '1:1', use: 'App Install Card' },
    ],
  },
  {
    id: 'snapchat',
    name: 'Snapchat Ads',
    icon: '👻',
    color: 'yellow',
    formats: [
      { label: 'Single Image Ad', w: 1080, h: 1920, type: 'image/jpeg', ratio: '9:16', use: 'Single Image / Video Ad' },
      { label: 'Collection Ad', w: 1080, h: 1080, type: 'image/jpeg', ratio: '1:1', use: 'Collection Thumbnail' },
    ],
  },
];

const BORDER_COLORS = {
  blue: 'border-blue-500/30 bg-blue-500/5',
  pink: 'border-pink-500/30 bg-pink-500/5',
  green: 'border-green-500/30 bg-green-500/5',
  sky: 'border-sky-500/30 bg-sky-500/5',
  yellow: 'border-yellow-500/30 bg-yellow-500/5',
};

const BADGE_COLORS = {
  blue: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  pink: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  green: 'bg-green-500/10 text-green-300 border-green-500/20',
  sky: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
};

function resizeAndCropImage(sourceImg, targetW, targetH, mimeType) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // Cover-crop: scale to fill, center-crop
    const srcAspect = sourceImg.naturalWidth / sourceImg.naturalHeight;
    const dstAspect = targetW / targetH;
    let sx = 0, sy = 0, sw = sourceImg.naturalWidth, sh = sourceImg.naturalHeight;

    if (srcAspect > dstAspect) {
      // source is wider — crop sides
      sw = Math.round(sourceImg.naturalHeight * dstAspect);
      sx = Math.round((sourceImg.naturalWidth - sw) / 2);
    } else {
      // source is taller — crop top/bottom
      sh = Math.round(sourceImg.naturalWidth / dstAspect);
      sy = Math.round((sourceImg.naturalHeight - sh) / 2);
    }

    ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, targetW, targetH);
    const quality = mimeType === 'image/jpeg' ? 0.88 : undefined;
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function FormatResult({ fmt, blob, platformColor }) {
  const [url, setUrl] = useState(null);

  React.useEffect(() => {
    if (blob) {
      const objUrl = URL.createObjectURL(blob);
      setUrl(objUrl);
      return () => URL.revokeObjectURL(objUrl);
    }
  }, [blob]);

  const handleDownload = () => {
    const ext = fmt.type === 'image/png' ? 'png' : 'jpg';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fmt.label.replace(/\s+/g, '_').toLowerCase()}_${fmt.w}x${fmt.h}.${ext}`;
    a.click();
  };

  return (
    <div className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
      {url ? (
        <img src={url} alt={fmt.label} className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-gray-600" />
      ) : (
        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-bold truncate">{fmt.label}</p>
        <p className="text-gray-500 text-[10px]">{fmt.w}×{fmt.h} · {fmt.ratio} · {fmt.type === 'image/png' ? 'PNG' : 'JPG'}</p>
        <p className="text-gray-600 text-[10px] truncate">{fmt.use}</p>
      </div>
      {url && (
        <button onClick={handleDownload}
          className="flex-shrink-0 p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5 text-gray-300" />
        </button>
      )}
    </div>
  );
}

export default function AdImageProcessor() {
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceImg, setSourceImg] = useState(null);
  const [sourcePreview, setSourcePreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState({}); // { platformId: { fmtLabel: Blob } }
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiTips, setAiTips] = useState(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState(new Set(PLATFORM_SPECS.map(p => p.id)));
  const [done, setDone] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setSourceFile(file);
    setResults({});
    setDone(false);
    setAiTips(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setSourcePreview(e.target.result);
      const img = new Image();
      img.onload = () => setSourceImg(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleProcess = async () => {
    if (!sourceImg) return;
    setProcessing(true);
    setResults({});
    setDone(false);

    const newResults = {};
    for (const platform of PLATFORM_SPECS) {
      if (!selectedPlatforms.has(platform.id)) continue;
      newResults[platform.id] = {};
      for (const fmt of platform.formats) {
        const blob = await resizeAndCropImage(sourceImg, fmt.w, fmt.h, fmt.type);
        newResults[platform.id][fmt.label] = blob;
        setResults(r => ({ ...r, [platform.id]: { ...(r[platform.id] || {}), [fmt.label]: blob } }));
      }
    }

    setProcessing(false);
    setDone(true);
  };

  const handleAIAnalyze = async () => {
    if (!sourcePreview) return;
    setAiEnhancing(true);
    const uploadRes = await base44.integrations.Core.UploadFile({ file: sourcePreview });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert digital advertiser. Analyze this ad creative image and provide:
1. A brief quality assessment (2 sentences max).
2. Key compliance issues for Meta, TikTok, Google, Twitter/X, and Snapchat (text density, aspect ratio suitability, brand safety).
3. 3 specific improvement suggestions to maximize CTR.
Keep each point concise (1 sentence). Return as JSON.`,
      file_urls: [uploadRes.file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          quality_assessment: { type: 'string' },
          compliance_issues: {
            type: 'array',
            items: { type: 'object', properties: { platform: { type: 'string' }, issue: { type: 'string' } } }
          },
          improvements: { type: 'array', items: { type: 'string' } }
        }
      }
    });
    setAiTips(result);
    setAiEnhancing(false);
  };

  const handleDownloadAll = () => {
    Object.entries(results).forEach(([platformId, fmts]) => {
      const platform = PLATFORM_SPECS.find(p => p.id === platformId);
      Object.entries(fmts).forEach(([label, blob]) => {
        const fmt = platform.formats.find(f => f.label === label);
        const ext = fmt?.type === 'image/png' ? 'png' : 'jpg';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${platformId}_${label.replace(/\s+/g, '_').toLowerCase()}_${fmt?.w}x${fmt?.h}.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    });
  };

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalFormats = PLATFORM_SPECS.filter(p => selectedPlatforms.has(p.id)).reduce((s, p) => s + p.formats.length, 0);
  const completedFormats = Object.values(results).reduce((s, fmts) => s + Object.keys(fmts).length, 0);

  return (
    <div className="space-y-5">

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-gray-700 hover:border-yellow-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all"
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFileSelect(e.target.files?.[0])} />
        {sourcePreview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={sourcePreview} alt="Source" className="max-h-40 max-w-full rounded-xl object-contain border border-gray-600" />
            <div className="text-center">
              <p className="text-white font-bold text-sm">{sourceFile?.name}</p>
              <p className="text-gray-500 text-xs">{sourceImg ? `${sourceImg.naturalWidth}×${sourceImg.naturalHeight}px` : ''} · {(sourceFile?.size / 1024).toFixed(0)}KB</p>
            </div>
            <Badge className="bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 text-xs">Click to change image</Badge>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-10 h-10 text-gray-600 mx-auto" />
            <p className="text-gray-400 font-bold">Drop your ad creative here</p>
            <p className="text-gray-600 text-xs">Supports JPG, PNG, WebP · Min 500×500px recommended</p>
          </div>
        )}
      </div>

      {/* Platform selector */}
      {sourceImg && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Target Platforms ({selectedPlatforms.size} selected · {totalFormats} formats)</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_SPECS.map(p => (
              <button key={p.id} onClick={() => togglePlatform(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  selectedPlatforms.has(p.id)
                    ? `${BADGE_COLORS[p.color]} border-current`
                    : 'border-gray-700 text-gray-500 hover:text-white'
                }`}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {sourceImg && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleProcess} disabled={processing || selectedPlatforms.size === 0}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-2">
            {processing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing {completedFormats}/{totalFormats}</>
              : <><Crop className="w-4 h-4" /> Process All Formats</>}
          </Button>
          <Button onClick={handleAIAnalyze} disabled={aiEnhancing} variant="outline"
            className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10 gap-2">
            {aiEnhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Analyze Creative
          </Button>
          {done && (
            <Button onClick={handleDownloadAll} variant="outline"
              className="border-green-500/40 text-green-300 hover:bg-green-500/10 gap-2">
              <Download className="w-4 h-4" /> Download All ({totalFormats} files)
            </Button>
          )}
        </div>
      )}

      {/* Progress bar */}
      {processing && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Resizing & cropping...</span>
            <span>{completedFormats}/{totalFormats} formats</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 rounded-full transition-all duration-300"
              style={{ width: `${totalFormats > 0 ? (completedFormats / totalFormats) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* AI Tips */}
      {aiTips && (
        <div className="bg-purple-900/20 border border-purple-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Creative Analysis
          </p>
          <p className="text-gray-300 text-sm">{aiTips.quality_assessment}</p>
          {aiTips.compliance_issues?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">Platform Compliance Issues</p>
              <div className="space-y-1.5">
                {aiTips.compliance_issues.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span><span className="text-orange-300 font-bold">{c.platform}:</span> <span className="text-gray-400">{c.issue}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aiTips.improvements?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">Improvement Suggestions</p>
              <div className="space-y-1.5">
                {aiTips.improvements.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-400">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results by platform */}
      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {PLATFORM_SPECS.filter(p => results[p.id]).map(platform => (
            <div key={platform.id} className={`border rounded-2xl p-4 ${BORDER_COLORS[platform.color]}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-white flex items-center gap-2">
                  {platform.icon} {platform.name}
                </p>
                <Badge className={`text-[10px] border ${BADGE_COLORS[platform.color]}`}>
                  {Object.keys(results[platform.id] || {}).length}/{platform.formats.length} ready
                </Badge>
              </div>
              <div className="space-y-2">
                {platform.formats.map(fmt => (
                  <FormatResult
                    key={fmt.label}
                    fmt={fmt}
                    blob={results[platform.id]?.[fmt.label]}
                    platformColor={platform.color}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Specs reference */}
      {!sourceImg && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Supported Output Formats</p>
          <div className="space-y-3">
            {PLATFORM_SPECS.map(p => (
              <div key={p.id}>
                <p className="text-xs font-bold text-gray-400 mb-1">{p.icon} {p.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.formats.map(f => (
                    <span key={f.label} className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                      {f.w}×{f.h} {f.ratio}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}