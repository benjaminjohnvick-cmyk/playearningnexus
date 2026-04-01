import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Users, DollarSign, ChevronDown, ChevronUp, Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WishlistBNPLSummary({ wishlistItems = [], onActivateBNPL }) {
  const [expanded, setExpanded] = useState(false);

  const totalValue = wishlistItems.reduce((s, i) => s + (i.price_with_markup || i.best_price || 0), 0);
  const itemCount = wishlistItems.length;

  if (itemCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden shadow-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 mb-6"
    >
      {/* Summary Row */}
      <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Wishlist Total</p>
            <p className="text-2xl font-black text-emerald-700">${totalValue.toFixed(2)}</p>
            <p className="text-xs text-gray-500">{itemCount} item{itemCount !== 1 ? 's' : ''} saved</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500">Buy Now Pay Later</p>
            <p className="text-lg font-black text-teal-700">up to $10,000</p>
          </div>
          <Button
            onClick={onActivateBNPL}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-md"
          >
            <Zap className="w-4 h-4 mr-1" /> Activate BNPL
          </Button>
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-2 rounded-full hover:bg-emerald-100 transition-colors text-emerald-600"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expandable explainer */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-emerald-200 px-5 py-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
              <h3 className="text-lg font-black mb-1">How to unlock $10,000 in buying power 💰</h3>
              <p className="text-emerald-100 text-sm mb-4">
                GamerGain's Buy Now Pay Later lets you shop anything up to $10,000 — paid back through your earned rewards. Here's the math:
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-white/15 rounded-xl p-3 text-center">
                  <Users className="w-6 h-6 mx-auto mb-1 text-yellow-300" />
                  <p className="text-2xl font-black text-yellow-300">10</p>
                  <p className="text-xs text-emerald-100">referred users on your account</p>
                </div>
                <div className="bg-white/15 rounded-xl p-3 text-center">
                  <DollarSign className="w-6 h-6 mx-auto mb-1 text-yellow-300" />
                  <p className="text-2xl font-black text-yellow-300">$3/day</p>
                  <p className="text-xs text-emerald-100">each user earns on average</p>
                </div>
                <div className="bg-white/15 rounded-xl p-3 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-1 text-yellow-300" />
                  <p className="text-2xl font-black text-yellow-300">$30/day</p>
                  <p className="text-xs text-emerald-100">total flowing to your account</p>
                </div>
              </div>

              <div className="bg-white/10 rounded-xl p-3 mb-4">
                <p className="text-sm font-semibold text-white">
                  📅 10 users × $3/day = <span className="text-yellow-300 font-black">$30/day</span>
                  &nbsp;→&nbsp; $210/week &nbsp;→&nbsp; $900/month
                </p>
                <p className="text-xs text-emerald-200 mt-1">
                  GamerGain advances you the $10,000 and deducts repayments from your daily referral earnings — zero out-of-pocket stress.
                </p>
              </div>

              <div className="flex gap-3 flex-wrap">
                <Button
                  onClick={onActivateBNPL}
                  className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black shadow-lg"
                >
                  <CreditCard className="w-4 h-4 mr-1" /> Activate My $10,000 BNPL
                </Button>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => window.location.href = '/ReferralDashboard'}
                >
                  <Users className="w-4 h-4 mr-1" /> Invite 10 users now →
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}