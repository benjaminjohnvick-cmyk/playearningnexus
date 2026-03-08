import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckCircle2, ChevronRight, Lock } from "lucide-react";

export default function Tier2Overview({ currentTier, onViewDetails }) {
  const locked = currentTier < 2;
  return (
    <Card className={`border-0 shadow-lg overflow-hidden ${locked ? 'opacity-70' : ''}`}>
      <div className="h-1.5 bg-gradient-to-r from-purple-500 to-purple-700" />
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Tier 2 — PPC Network</CardTitle>
            <p className="text-sm text-gray-500">Year 2 · 8 min/day · $0.10/question · Referral income</p>
          </div>
        </div>
        {currentTier === 2 && <Badge className="bg-green-100 text-green-700">Active</Badge>}
        {locked && <Badge className="bg-gray-100 text-gray-500"><Lock className="w-3 h-3 mr-1" />Locked</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { label: 'Daily earnings', value: '$8.00', sub: '8 min × $1/min' },
            { label: 'Annual referral earnings', value: '$58,400', sub: '200 active referrals × $292' },
            { label: 'Referral target', value: '4,000 people', sub: '200 active @ 5% rate' },
          ].map((stat, i) => (
            <div key={i} className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">{stat.value}</p>
              <p className="text-sm font-medium text-gray-700">{stat.label}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1">
          {[
            '10 PPC questions/minute at $0.10 each = $1.00/minute',
            'Required: 8 minutes of surveys daily',
            'Referral commission: 10% of referred user earnings ($292/active user/yr)',
            'Survey buyers can publish Type 1 (data) or Type 2 (product) surveys',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="border-purple-300 text-purple-700"
          onClick={onViewDetails}
          disabled={locked}
        >
          {locked ? <><Lock className="w-4 h-4 mr-1" /> Unlock in Year 2</> : <>Full Tier 2 Details <ChevronRight className="w-4 h-4 ml-1" /></>}
        </Button>
      </CardContent>
    </Card>
  );
}