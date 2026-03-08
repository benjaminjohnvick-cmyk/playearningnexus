import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, CheckCircle2, ChevronRight, Lock } from "lucide-react";

export default function Tier3Overview({ currentTier, onViewDetails }) {
  const locked = currentTier < 3;
  return (
    <Card className={`border-0 shadow-lg overflow-hidden ${locked ? 'opacity-70' : ''}`}>
      <div className="h-1.5 bg-gradient-to-r from-yellow-500 to-yellow-700" />
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Tier 3 — Brand Partner Network</CardTitle>
            <p className="text-sm text-gray-500">Year 3 · 4 hrs/day · $1/min · Major brand partners</p>
          </div>
        </div>
        {currentTier === 3 && <Badge className="bg-green-100 text-green-700">Active</Badge>}
        {locked && <Badge className="bg-gray-100 text-gray-500"><Lock className="w-3 h-3 mr-1" />Locked</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { label: 'Daily personal', value: '$240/day', sub: '4 hrs × $60/hr' },
            { label: 'Daily referral earnings', value: '$9,600/day', sub: '4,000 active × $24/day' },
            { label: 'Annual referral earnings', value: '$3,504,000', sub: '$9,600 × 365 days' },
          ].map((stat, i) => (
            <div key={i} className="bg-yellow-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-700">{stat.value}</p>
              <p className="text-sm font-medium text-gray-700">{stat.label}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1">
          {[
            '$1.00/minute for 4 hours daily = $240/day personal earnings',
            'Referral commission: 10% of referred users\' earnings ($24/person/day)',
            'Requires brand partners spending $12M+/year on advertising',
            'All earnings must be spent exclusively with Tier 3 brand partners',
            'Activates after Tier 2 proof of concept is established',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="border-yellow-400 text-yellow-700"
          onClick={onViewDetails}
          disabled={locked}
        >
          {locked ? <><Lock className="w-4 h-4 mr-1" /> Unlock in Year 3</> : <>Full Tier 3 Details <ChevronRight className="w-4 h-4 ml-1" /></>}
        </Button>
      </CardContent>
    </Card>
  );
}