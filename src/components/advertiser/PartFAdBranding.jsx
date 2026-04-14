import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, ExternalLink, CheckCircle, Image, Smartphone, Monitor, Eye } from 'lucide-react';
import GamerGainLogo from '@/components/branding/GamerGainLogo';

const SIGNUP_URL = 'https://gamergain.app/signup';
const SITE_URL = 'https://gamergain.app';

const SAMPLE_ADS = [
  { brand: 'Nike', tagline: 'Just Do It', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop', color: '#111111' },
  { brand: 'Apple', tagline: 'Think Different', image: 'https://images.unsplash.com/photo-1568910748155-01ca989dbdd6?w=300&h=300&fit=crop', color: '#555555' },
  { brand: 'Tesla', tagline: 'The Future Is Electric', image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=300&h=300&fit=crop', color: '#CC0000' },
];

function AdPreviewCard({ ad, variant }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-700 shadow-xl" style={{ aspectRatio: variant === 'story' ? '9/16' : '1' }}>
      <img src={ad.image} alt={ad.brand} className="w-full h-full object-cover" />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
      {/* Ad content */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-black text-sm leading-tight">{ad.brand}</p>
        <p className="text-gray-300 text-xs italic mb-2">"{ad.tagline}"</p>
        {/* Part F: GamerGain branding bar */}
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1.5 flex items-center justify-between border border-red-500/30">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-sm overflow-hidden flex-shrink-0 bg-red-600 flex items-center justify-center">
              <span className="text-white text-[8px] font-black">GG</span>
            </div>
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer"
              className="text-red-400 font-black text-[10px] hover:text-red-300">
              GamerGain.app
            </a>
          </div>
          <a href={SIGNUP_URL} target="_blank" rel="noopener noreferrer"
            className="bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-md hover:bg-yellow-400 transition-colors flex items-center gap-0.5">
            Sign Up Free <ExternalLink className="w-2 h-2" />
          </a>
        </div>
      </div>
      {/* Top watermark */}
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1">
        <span className="text-red-400 text-[9px] font-black">🎮 Powered by GamerGain</span>
      </div>
    </div>
  );
}

export default function PartFAdBranding() {
  const [previewAd, setPreviewAd] = useState(SAMPLE_ADS[0]);
  const [previewVariant, setPreviewVariant] = useState('square');

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-5">
        <h3 className="text-white font-black mb-1 flex items-center gap-2">
          <Globe className="w-4 h-4 text-red-400" /> Part F — GamerGain Ad Branding
        </h3>
        <p className="text-gray-400 text-xs mb-5">
          All ads on GamerGain automatically include the <span className="text-red-400 font-bold">GamerGain logo</span> and 
          a <span className="text-yellow-400 font-bold">sign-up link</span> (gamergain.app). 
          This is applied to every ad on the grid and all social media posts generated from clicks.
        </p>

        {/* Branding requirements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {[
            { icon: '🎮', title: 'GamerGain Logo', desc: 'Displayed on all ad creatives — top-left watermark and bottom branding bar', check: true },
            { icon: '🔗', title: 'Sign-Up Link', desc: 'gamergain.app/signup — included on every ad and social post', check: true },
            { icon: '📱', title: 'Social Posts', desc: 'All 20 auto-generated social posts include GamerGain branding', check: true },
            { icon: '🌐', title: 'Website Link', desc: 'gamergain.app shown prominently on every ad format', check: true },
          ].map(item => (
            <div key={item.title} className="bg-gray-800 rounded-xl p-3 flex items-start gap-2">
              <span className="text-xl">{item.icon}</span>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-white font-bold text-xs">{item.title}</p>
                  {item.check && <CheckCircle className="w-3 h-3 text-green-400" />}
                </div>
                <p className="text-gray-500 text-[10px]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Ad preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <Eye className="w-3 h-3" /> Live Ad Preview with Branding
            </p>
            <div className="flex gap-2">
              <div className="flex gap-1">
                {SAMPLE_ADS.map(ad => (
                  <button key={ad.brand} onClick={() => setPreviewAd(ad)}
                    className={`w-8 h-8 rounded overflow-hidden border-2 transition-all ${previewAd.brand === ad.brand ? 'border-yellow-400' : 'border-gray-700'}`}>
                    <img src={ad.image} alt={ad.brand} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {[['square', <Monitor className="w-3 h-3" />], ['story', <Smartphone className="w-3 h-3" />]].map(([v, icon]) => (
                  <button key={v} onClick={() => setPreviewVariant(v)}
                    className={`p-1.5 rounded-lg border transition-all ${previewVariant === v ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <div className={previewVariant === 'story' ? 'w-48' : 'w-64'}>
              <AdPreviewCard ad={previewAd} variant={previewVariant} />
            </div>
            <div className="flex-1 space-y-3 text-xs text-gray-400">
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-white font-bold mb-1">What's on every ad:</p>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-1.5"><CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" /> <span>Top-left: "🎮 Powered by GamerGain"</span></li>
                  <li className="flex items-start gap-1.5"><CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" /> <span>Bottom bar: GamerGain logo + red branding</span></li>
                  <li className="flex items-start gap-1.5"><CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" /> <span>Yellow "Sign Up Free →" CTA button</span></li>
                  <li className="flex items-start gap-1.5"><CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" /> <span>GamerGain.app URL prominently displayed</span></li>
                </ul>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-white font-bold mb-1">Sign-up link:</p>
                <a href={SIGNUP_URL} target="_blank" rel="noopener noreferrer"
                  className="text-yellow-400 font-bold break-all hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> {SIGNUP_URL}
                </a>
                <p className="text-gray-500 mt-1">Every new user who clicks this link and signs up is attributed to your ad.</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-white font-bold mb-1">Applied to:</p>
                <div className="flex flex-wrap gap-1">
                  {['Ad Grid', 'Facebook Posts', 'Instagram Posts', 'TikTok Posts', 'YouTube Posts', 'Snapchat Posts', 'X/Twitter Posts'].map(p => (
                    <Badge key={p} className="bg-gray-700 text-gray-300 text-[9px]">{p}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}