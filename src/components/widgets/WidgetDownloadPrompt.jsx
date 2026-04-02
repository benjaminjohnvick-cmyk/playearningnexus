import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Trophy, DollarSign, Gift } from 'lucide-react';
import { toast } from 'sonner';

const DISMISS_KEY = 'gamergain_widget_banner_dismissed_at';

export default function WidgetDownloadPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show again if dismissed more than 24h ago (or never dismissed)
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) { setVisible(true); return; }
    const hoursSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
    if (hoursSince >= 24) setVisible(true);
  }, []);

  const handleDownload = () => {
    const widgetData = {
      name: 'GamerGain Search Widget',
      version: '1.0.0',
      description: 'Search for products, earn $0.40/day from PPC ads, get contest entries, and win up to $1M+.',
      contest: {
        entries_per_search: 1,
        potential_payout: '$1,000,000+',
        how_it_works: 'Refer 7 million users → earn 10% of all their profits. Use the widget daily to earn contest entries automatically.',
      },
      install_url: window.location.origin,
    };
    const blob = new Blob([JSON.stringify(widgetData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gamergain-widget.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('GamerGain Widget downloaded! Check your downloads folder.');
  };

  const handleOptOut = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 border-t border-purple-500/50 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
        {/* Left: icon + title */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Download className="w-5 h-5 text-yellow-400" />
          <span className="font-black text-white text-sm whitespace-nowrap">Get the GamerGain Search Widget</span>
        </div>

        {/* Middle: benefits */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 flex-1 justify-center sm:justify-start">
          <span className="flex items-center gap-1 text-xs text-white/90">
            <DollarSign className="w-3.5 h-3.5 text-green-400" />
            Earn <strong className="text-green-300">$0.40/day</strong> from PPC Ads
          </span>
          <span className="flex items-center gap-1 text-xs text-white/90">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            Auto contest entries every search
          </span>
          <span className="flex items-center gap-1 text-xs text-white/90">
            <Gift className="w-3.5 h-3.5 text-pink-400" />
            Potential payout: <strong className="text-yellow-300">$1,000,000+</strong>
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black hover:from-yellow-500 hover:to-orange-600 gap-1 h-8 px-4"
            onClick={handleDownload}
          >
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
          <button
            onClick={handleOptOut}
            className="text-white/40 hover:text-white/80 transition-colors p-1"
            title="Opt out"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}