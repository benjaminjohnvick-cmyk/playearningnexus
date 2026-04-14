import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function PPCWelcomePopup({ onClose }) {
  const handleCTA = () => {
    onClose();
    window.location.href = '/PaidPPCAdsMosaic';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center relative">
        <button
          onClick={handleCTA}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-5xl mb-4">💰</div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">
          Earn $4 in Minutes!
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Try our PPC ads grid and earn <span className="font-bold text-green-600">$4</span> in just a few minutes. Click below to get started!
        </p>

        <Button
          onClick={handleCTA}
          className="w-full h-12 text-base font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
        >
          🚀 Try PPC Ads Grid Now
        </Button>
        <button
          onClick={handleCTA}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}