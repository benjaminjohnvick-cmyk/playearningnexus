import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Users } from 'lucide-react';

const trustTierInfo = {
  low: { color: 'bg-red-100 text-red-800', icon: '⚠️', label: 'Low Trust' },
  medium: { color: 'bg-yellow-100 text-yellow-800', icon: '➡️', label: 'Medium Trust' },
  high: { color: 'bg-green-100 text-green-800', icon: '✅', label: 'High Trust' },
  premium: { color: 'bg-blue-100 text-blue-800', icon: '⭐', label: 'Premium Trust' }
};

export default function TrustScoreFilter({ selectedTier, onTierChange, stats = {} }) {
  return (
    <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-gray-900">Target by Trust Score</h3>
        </div>

        <p className="text-xs text-gray-600">
          High-trust respondents have proven response quality, consistent completion times, and verified demographics.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {['low', 'medium', 'high', 'premium'].map(tier => {
            const info = trustTierInfo[tier];
            const count = stats[tier] || 0;
            
            return (
              <Button
                key={tier}
                variant={selectedTier === tier ? 'default' : 'outline'}
                onClick={() => onTierChange(selectedTier === tier ? null : tier)}
                className={`flex flex-col items-center gap-1 h-auto py-2 ${
                  selectedTier === tier ? info.color : ''
                }`}
              >
                <span className="text-lg">{info.icon}</span>
                <span className="text-xs font-medium">{info.label}</span>
                {count > 0 && <span className="text-xs text-gray-600">{count} users</span>}
              </Button>
            );
          })}
        </div>

        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
          <p className="text-xs font-medium text-blue-900">📊 Trust Score Components:</p>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Response Quality (40%): Average data quality scores</li>
            <li>• Time Accuracy (30%): Consistent completion patterns</li>
            <li>• Verification (30%): Demographic verification level</li>
          </ul>
        </div>

        {selectedTier && (
          <div className={`p-2 rounded text-sm text-center font-medium ${trustTierInfo[selectedTier].color}`}>
            Filtering to {trustTierInfo[selectedTier].label} respondents
          </div>
        )}
      </CardContent>
    </Card>
  );
}