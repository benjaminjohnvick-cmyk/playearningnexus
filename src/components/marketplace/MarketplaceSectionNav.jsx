import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ShoppingBag, Package, Cloud, Wrench, AppWindow, Grid3x3, Store, Sparkles } from 'lucide-react';

/**
 * MarketplaceSectionNav — one uniform navbar for EVERY marketplace section (Marketplace home, Physical,
 * Digital, Services, App Store, AdGrid). Drop it at the top of each section page so navigation and look are
 * consistent across the whole marketplace, Amazon-department style. Pass `active` to highlight the section.
 */
const SECTIONS = [
  { key: 'Marketplace', label: 'All', icon: ShoppingBag },
  { key: 'AIShoppingAssistant', label: 'AI Assistant', icon: Sparkles },
  { key: 'PhysicalStore', label: 'Physical', icon: Package },
  { key: 'DigitalStore', label: 'Digital', icon: Cloud },
  { key: 'ServicesStore', label: 'Services', icon: Wrench },
  { key: 'InAppStore', label: 'App Store', icon: AppWindow },
  { key: 'SellerUpload', label: 'Sell', icon: Store },
  { key: 'AdGridSurvey', label: 'AdGrid', icon: Grid3x3 },
];

export default function MarketplaceSectionNav({ active }) {
  return (
    <div className="mb-4 -mx-1 overflow-x-auto">
      <div className="flex gap-1 px-1 min-w-max">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const on = active === s.key;
          return (
            <Link
              key={s.key}
              to={createPageUrl(s.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                on ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              <Icon className="h-4 w-4" /> {s.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
