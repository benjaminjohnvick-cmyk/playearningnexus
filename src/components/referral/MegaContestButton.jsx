import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Trophy } from 'lucide-react';

export default function MegaContestButton() {
  return (
    <Link
      to={createPageUrl('ReferralContest')}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
      style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #7c3aed 100%)',
        boxShadow: '0 2px 12px rgba(245,158,11,0.4)'
      }}
    >
      <Trophy className="w-3 h-3 flex-shrink-0" />
      <span className="hidden sm:inline">Refer 7M · Get 10% Forever · Up to $766.5M/yr</span>
      <span className="sm:hidden">7M Contest</span>
    </Link>
  );
}