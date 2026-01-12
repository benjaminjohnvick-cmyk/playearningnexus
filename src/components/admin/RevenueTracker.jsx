import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";

export default function RevenueTracker() {
  const { data: transactions = [] } = useQuery({
    queryKey: ['all-transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 100)
  });

  const { data: surveys = [] } = useQuery({
    queryKey: ['all-surveys'],
    queryFn: () => base44.entities.Survey.list('-completion_date', 100)
  });

  // Calculate revenue splits
  const totalSurveyRevenue = surveys.reduce((sum, s) => sum + (s.earnings || 0), 0);
  const installFeeRevenue = transactions
    .filter(t => t.transaction_type === 'survey_earning' && t.amount === 2)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // First 3 days: $6 install fee ($2/day)
  const installFeesCollected = Math.floor(installFeeRevenue / 2) * 6; // Each user pays $6 over 3 days
  
  // After 3 days: 50/50 split
  const postInstallRevenue = totalSurveyRevenue - installFeeRevenue;
  const platformShare = (postInstallRevenue / 2) + installFeesCollected;
  const developerShare = postInstallRevenue / 2;

  const { data: users = [] } = useQuery({
    queryKey: ['user-count'],
    queryFn: async () => {
      const allUsers = await base44.entities.User.list();
      return allUsers;
    }
  });

  const activeUsers = users.filter(u => u.install_fee_complete).length;
  const newUsers = users.filter(u => !u.install_fee_complete).length;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-600 rounded-xl">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm text-gray-600 mb-1">Platform Revenue</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                ${platformShare.toFixed(2)}
              </p>
              <div className="space-y-1 text-xs text-gray-600">
                <p>• Install fees: ${installFeesCollected.toFixed(2)}</p>
                <p>• 50% survey split: ${(postInstallRevenue / 2).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm text-gray-600 mb-1">Developer Revenue</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                ${developerShare.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600">
                50% of post-install survey earnings
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 border-0 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Revenue Model Breakdown</h3>
        
        <div className="space-y-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              <h4 className="font-bold text-gray-900">Days 1-3: Install Fee Collection</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Per User:</p>
                <ul className="space-y-1 text-gray-700">
                  <li>• Day 1: $2 (surveys)</li>
                  <li>• Day 2: $2 (surveys)</li>
                  <li>• Day 3: $2 (surveys)</li>
                  <li><strong>Total: $6 install fee to platform</strong></li>
                </ul>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Current Status:</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>New Users (paying install fee):</span>
                    <Badge>{newUsers}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Install Fees Collected:</span>
                    <Badge className="bg-green-100 text-green-700">${installFeesCollected.toFixed(2)}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-green-600" />
              <h4 className="font-bold text-gray-900">Day 4+: 50/50 Revenue Split (1 Year)</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Per User Daily:</p>
                <ul className="space-y-1 text-gray-700">
                  <li>• User earns: $1 from surveys</li>
                  <li>• Developer earns: $1 from surveys</li>
                  <li>• Platform earns: $1 from surveys</li>
                  <li><strong>Total: $2/day survey requirement</strong></li>
                </ul>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Current Status:</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Active Users (past day 3):</span>
                    <Badge>{activeUsers}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Share:</span>
                    <Badge className="bg-green-100 text-green-700">
                      ${(postInstallRevenue / 2).toFixed(2)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Developer Share:</span>
                    <Badge className="bg-blue-100 text-blue-700">
                      ${developerShare.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-blue-50 border-2 border-blue-200">
        <h4 className="font-bold text-gray-900 mb-2">Revenue Model Summary</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>✓ $6 per install collected over first 3 days ($2/day surveys)</li>
          <li>✓ After day 3: Users earn $1/day, Platform earns $1/day, Developers earn $1/day</li>
          <li>✓ 50/50 split between platform and developers after install fees</li>
          <li>✓ 1-year user commitment with auto-renewal</li>
          <li>✓ Total potential: $365/user/year after install period</li>
        </ul>
      </Card>
    </div>
  );
}