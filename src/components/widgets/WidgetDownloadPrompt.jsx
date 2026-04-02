import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Download, X, Trophy, DollarSign, Gift } from 'lucide-react';
import { toast } from 'sonner';

const OPT_OUT_KEY = 'gamergain_widget_download_opted_out';
const SHOWN_KEY = 'gamergain_widget_download_shown';

export default function WidgetDownloadPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const optedOut = localStorage.getItem(OPT_OUT_KEY);
    const alreadyShown = localStorage.getItem(SHOWN_KEY);
    if (!optedOut && !alreadyShown) {
      setTimeout(() => setVisible(true), 3000);
    }
  }, []);

  const handleDownload = () => {
    // Build a downloadable widget manifest / bookmarklet
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
    localStorage.setItem(SHOWN_KEY, '1');
    setVisible(false);
    toast.success('GamerGain Widget downloaded! Check your downloads folder.');
  };

  const handleOptOut = () => {
    localStorage.setItem(OPT_OUT_KEY, '1');
    localStorage.setItem(SHOWN_KEY, '1');
    setVisible(false);
    toast('You can re-enable the widget from your Profile settings.');
  };

  const handleDismiss = () => {
    localStorage.setItem(SHOWN_KEY, '1');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4"
        >
          <div className="bg-gradient-to-br from-indigo-900 to-purple-900 border border-purple-500/50 rounded-2xl shadow-2xl p-5 text-white relative">
            <button onClick={handleDismiss} className="absolute top-3 right-3 text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Download className="w-5 h-5 text-yellow-400" />
              <h3 className="font-black text-base">Get the GamerGain Search Widget</h3>
            </div>

            <div className="space-y-2 mb-4 text-sm">
              <div className="flex items-start gap-2">
                <DollarSign className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-white/90">Earn <strong>$0.40/day</strong> from Paid PPC Ads just by using the search widget on your device.</p>
              </div>
              <div className="flex items-start gap-2">
                <Trophy className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-white/90">Every search automatically earns you <strong>contest entries</strong> for the GamerGain jackpot.</p>
              </div>
              <div className="flex items-start gap-2">
                <Gift className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
                <p className="text-white/90">Potential payout: <strong className="text-yellow-300">$1,000,000+</strong> — refer 7M users and earn 10% of all their profits forever.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black hover:from-yellow-500 hover:to-orange-600 gap-1"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" /> Download Widget
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white hover:bg-white/10 text-xs"
                onClick={handleOptOut}
              >
                Opt Out
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}