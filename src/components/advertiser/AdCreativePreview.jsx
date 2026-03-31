import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Loader2, Monitor, Share2, Image, RefreshCw, CheckCircle } from 'lucide-react';

const GRID_BG = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop';

function GridPreview({ imageUrl, tagline, brandName }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <Image className="w-3 h-3" /> Grid Cell
      </p>
      {/* Simulated grid */}
      <div className="bg-gray-950 rounded-xl p-2 border border-gray-700">
        <div className="grid grid-cols-5 gap-0.5">
          {[...Array(12)].map((_, i) =>
            i === 6 ? null : (
              <div key={i} className="aspect-square rounded-sm bg-gray-800 overflow-hidden">
                <img src={GRID_BG} alt="" className="w-full h-full object-cover opacity-40" />
              </div>
            )
          )}
          {/* The preview cell — larger */}
          <div className="col-span-2 row-span-2 aspect-square relative rounded-sm overflow-hidden ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/20">
            {imageUrl
              ? <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  <Image className="w-6 h-6 text-gray-500" />
                </div>
            }
            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-1">
              <p className="text-white text-[9px] font-bold truncate">{brandName || 'Brand Name'}</p>
            </div>
            <div className="absolute top-1 right-1 bg-yellow-400 rounded-full w-3.5 h-3.5 flex items-center justify-center">
              <span className="text-[7px] text-black font-black">🔒</span>
            </div>
          </div>
          {[...Array(7)].map((_, i) => (
            <div key={i + 20} className="aspect-square rounded-sm bg-gray-800 overflow-hidden">
              <img src={GRID_BG} alt="" className="w-full h-full object-cover opacity-40" />
            </div>
          ))}
        </div>
        <p className="text-center text-gray-600 text-[10px] mt-1.5">↑ Your ad highlighted in the grid</p>
      </div>
      {tagline && (
        <div className="bg-gray-800/60 border border-yellow-500/20 rounded-lg px-3 py-1.5">
          <p className="text-yellow-300 text-xs italic">"{tagline}"</p>
        </div>
      )}
    </div>
  );
}

function SocialPostPreview({ imageUrl, tagline, brandName }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <Share2 className="w-3 h-3" /> Social Post
      </p>
      <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden max-w-xs">
        {/* Fake social header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800">
          <div className="w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
            <span className="text-black text-[10px] font-black">GG</span>
          </div>
          <div>
            <p className="text-white text-xs font-bold">GamerGain</p>
            <p className="text-gray-500 text-[10px]">Sponsored · Just now</p>
          </div>
        </div>
        {/* Post image */}
        <div className="aspect-video relative bg-gray-800">
          {imageUrl
            ? <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center">
                <Image className="w-8 h-8 text-gray-600" />
              </div>
          }
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3">
            <div>
              <p className="text-white font-black text-sm">{brandName || 'Your Brand'}</p>
              <p className="text-gray-200 text-xs italic">{tagline || 'Your tagline here'}</p>
            </div>
          </div>
        </div>
        {/* CTA bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800">
          <p className="text-gray-400 text-[11px]">🎮 Earn $0.20 — Answer 4 questions</p>
          <button className="text-xs bg-yellow-500 text-black font-black px-2.5 py-1 rounded-lg">Unlock</button>
        </div>
      </div>
    </div>
  );
}

function BannerPreview({ imageUrl, tagline, brandName }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <Monitor className="w-3 h-3" /> Banner Ad (728×90)
      </p>
      <div className="w-full h-[72px] bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl overflow-hidden flex items-center gap-3 px-4 relative">
        {/* Left: image */}
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-700">
          {imageUrl
            ? <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
            : <Image className="w-5 h-5 text-gray-600 m-auto mt-3.5" />
          }
        </div>
        {/* Center: text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm truncate">{brandName || 'Your Brand'}</p>
          <p className="text-gray-400 text-xs truncate italic">{tagline || 'Your tagline here'}</p>
        </div>
        {/* Right: CTA */}
        <div className="flex-shrink-0 text-right">
          <button className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs px-3 py-1.5 rounded-lg">
            Learn More →
          </button>
          <p className="text-gray-600 text-[10px] mt-0.5">Powered by GamerGain</p>
        </div>
        {/* "AD" pill */}
        <span className="absolute top-1 left-1 bg-gray-700 text-gray-400 text-[9px] px-1 rounded font-bold">AD</span>
      </div>
    </div>
  );
}

export default function AdCreativePreview() {
  const [imageUrl, setImageUrl] = useState('');
  const [brandName, setBrandName] = useState('');
  const [tagline, setTagline] = useState('');
  const [uploading, setUploading] = useState(false);
  const [ready, setReady] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setUploading(false);
  };

  const hasContent = imageUrl || brandName || tagline;

  return (
    <div className="space-y-5">
      {/* Input panel */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
        <p className="text-white font-bold text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-yellow-400" /> Creative Inputs
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input value={brandName} onChange={e => setBrandName(e.target.value)}
            placeholder="Brand / Business name"
            className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />
          <Input value={tagline} onChange={e => setTagline(e.target.value)}
            placeholder="Tagline (e.g. 'Level up today!')"
            className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />
        </div>

        <label className="flex items-center gap-3 cursor-pointer bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 hover:border-yellow-500/50 transition-all group">
          {uploading
            ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            : imageUrl
              ? <CheckCircle className="w-5 h-5 text-green-400" />
              : <Upload className="w-5 h-5 text-gray-400 group-hover:text-yellow-400 transition-colors" />
          }
          <div>
            <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
              {imageUrl ? 'Image uploaded — click to replace' : 'Upload ad image'}
            </p>
            <p className="text-[11px] text-gray-500">JPG, PNG, WEBP recommended</p>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>

        {imageUrl && (
          <div className="flex items-center gap-3">
            <img src={imageUrl} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-gray-600" />
            <button onClick={() => setImageUrl('')} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
          </div>
        )}

        {!hasContent && (
          <p className="text-gray-600 text-xs text-center py-2">Fill in the fields above to see live previews below.</p>
        )}
      </div>

      {/* Live previews */}
      {hasContent && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider px-2">Live Previews</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          <GridPreview imageUrl={imageUrl} tagline={tagline} brandName={brandName} />
          <SocialPostPreview imageUrl={imageUrl} tagline={tagline} brandName={brandName} />
          <BannerPreview imageUrl={imageUrl} tagline={tagline} brandName={brandName} />
        </div>
      )}
    </div>
  );
}