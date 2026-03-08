import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, ChevronRight, Lock } from "lucide-react";

export default function Tier1Overview({ currentTier, onViewDetails }) {
  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-700" />
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Tier 1 — BitLabs Surveys</CardTitle>
            <p className="text-sm text-gray-500">Entry level · BitLabs only · 50% revenue split</p>
          </div>
        </div>
        {currentTier === 1 && <Badge className="bg-green-100 text-green-700">Active</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { label: 'Daily earnings', value: '$3.00', sub: '50% of BitLabs revenue' },
            { label: 'Annual personal', value: '$1,095', sub: '365 days × $3' },
            { label: 'Referral target', value: '400 people', sub: '20 active @ 5% rate' },
          ].map((stat, i) => (
            <div key={i} className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{stat.value}</p>
              <p className="text-sm font-medium text-gray-700">{stat.label}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1">
          {[
            'Complete BitLabs surveys to earn 50% of survey value',
            'Must earn $3/day for 365 days to advance to Tier 2',
            'Referral commission: 10% of referred user earnings',
            'Platform keeps 50% of all referral fees',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
        <Button variant="outline" className="border-blue-300 text-blue-700" onClick={onViewDetails}>
          Full Tier 1 Details <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}