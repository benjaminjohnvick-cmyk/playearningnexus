import React from 'react';
import { CreditCard, Users, TrendingUp } from 'lucide-react';

/**
 * Reusable BNPL promotional banner for all purchase sections.
 * Shows a compact call-to-action to open the BNPLModal.
 */
export default function BNPLBanner({ onActivate, isActive, creditLimit }) {
  return (
    <button
      onClick={onActivate}
      className="w-full text-left bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl hover:opacity-95 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-white/20 rounded-lg p-2 flex-shrink-0">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm sm:text-base leading-tight">
              {isActive
                ? `✅ BNPL Active — $${(creditLimit || 1080).toLocaleString()} Credit Available`
                : '💳 Buy Now, Pay with Surveys'}
            </p>
            {!isActive && (
              <p className="text-blue-100 text-xs mt-1 leading-snug">
                Receive up to <strong className="text-white">$1,080 in credit</strong> · Add
                <strong className="text-white"> 10 people</strong> to your account · Get up to
                <strong className="text-white"> $10,000</strong> · Payback with survey earnings
              </p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 bg-white text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-full whitespace-nowrap self-center">
          {isActive ? 'View' : 'Activate →'}
        </div>
      </div>

      {!isActive && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white/15 rounded-lg py-1.5 px-1">
            <p className="text-white font-bold text-sm">$1,080</p>
            <p className="text-blue-100">per person</p>
          </div>
          <div className="bg-white/15 rounded-lg py-1.5 px-1">
            <Users className="w-3.5 h-3.5 text-white mx-auto mb-0.5" />
            <p className="text-white font-bold text-sm">+10 people</p>
            <p className="text-blue-100">max group</p>
          </div>
          <div className="bg-white/15 rounded-lg py-1.5 px-1">
            <TrendingUp className="w-3.5 h-3.5 text-white mx-auto mb-0.5" />
            <p className="text-white font-bold text-sm">$10,000</p>
            <p className="text-blue-100">max credit</p>
          </div>
        </div>
      )}
    </button>
  );
}