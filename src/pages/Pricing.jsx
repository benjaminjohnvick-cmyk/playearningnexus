import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PricingSection from '@/components/home/PricingSection';
import BusinessPricingSection from '@/components/home/BusinessPricingSection';
import RevenueStreamsSection from '@/components/revenue/RevenueStreamsSection';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign, TrendingUp, Zap } from 'lucide-react';

export default function Pricing() {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: '💰 All Plans', icon: DollarSign },
    { id: 'plans', label: '🎯 Subscription Plans', icon: TrendingUp },
    { id: 'revenue', label: '📈 Revenue Streams', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">Pricing & Revenue Hub</h1>
          <p className="text-purple-100 text-lg max-w-2xl mx-auto">Choose your earning strategy or combine multiple revenue streams for maximum profits</p>
        </div>
      </div>

      {/* Navigation Categories */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-3 justify-center flex-wrap mb-8">
          {categories.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                  activeCategory === cat.id
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-purple-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Content Based on Category */}
        <div className="space-y-8">
          {(activeCategory === 'all' || activeCategory === 'plans') && (
            <>
              <PricingSection />
              <BusinessPricingSection />
            </>
          )}

          {(activeCategory === 'all' || activeCategory === 'revenue') && (
            <RevenueStreamsSection />
          )}

          {activeCategory === 'all' && (
            <div className="mt-12 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-8 text-white text-center">
              <h2 className="text-3xl font-black mb-3">Ready to Start Earning?</h2>
              <p className="text-purple-100 mb-6 max-w-xl mx-auto">
                Join thousands of users earning $3+ per day through surveys, games, and referrals
              </p>
              <Link to={createPageUrl('UserDashboard')}>
                <Button className="bg-white text-purple-700 hover:bg-purple-50 font-bold text-lg px-8 py-6">
                  Start Earning Now <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}