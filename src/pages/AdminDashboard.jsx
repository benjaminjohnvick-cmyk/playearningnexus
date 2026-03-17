import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import FeaturedGameRotation from '../components/admin/FeaturedGameRotation';
import RevenueTracker from '../components/admin/RevenueTracker';
import RevenueDistribution from '../components/admin/RevenueDistribution';
import RewardDistributionPanel from '../components/admin/RewardDistributionPanel';
import AdminPayoutManager from '../components/admin/AdminPayoutManager';
import ManualPayoutPanel from '../components/admin/ManualPayoutPanel';
import AIPayoutIntelligence from '../components/admin/AIPayoutIntelligence';
import ReferralFollowUpAdmin from '../components/admin/ReferralFollowUpAdmin';
import DisputeManager from '../components/admin/DisputeManager';
import ComplianceReview from '../components/admin/ComplianceReview';
import ContentLibraryManager from '../components/admin/ContentLibraryManager';
import ContestManager from '../components/admin/ContestManager';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser.role !== 'admin') {
          toast.error('Admin access required');
          return;
        }
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Card className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600">Only administrators can access this dashboard</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage platform operations, revenue, and game rotation</p>
        </div>

        <Tabs defaultValue="revenue" className="space-y-6">
          <TabsList className="bg-white shadow-md">
            <TabsTrigger value="revenue">Revenue & Analytics</TabsTrigger>
            <TabsTrigger value="rotation">Game Rotation</TabsTrigger>
            <TabsTrigger value="rewards">Reward Payouts</TabsTrigger>
            <TabsTrigger value="payouts">Payout Manager</TabsTrigger>
            <TabsTrigger value="manual">Manual Payouts</TabsTrigger>
            <TabsTrigger value="ai_payout">🤖 AI Intelligence</TabsTrigger>
            <TabsTrigger value="followups">📧 Follow-Ups</TabsTrigger>
            <TabsTrigger value="disputes">⚠️ Disputes</TabsTrigger>
            <TabsTrigger value="compliance">🛡️ Compliance</TabsTrigger>
            <TabsTrigger value="content_library">📚 Content Library</TabsTrigger>
            <TabsTrigger value="contests">🏆 Contests</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue">
            <div className="space-y-6">
              <RevenueDistribution />
              <RevenueTracker />
            </div>
          </TabsContent>

          <TabsContent value="rotation">
            <FeaturedGameRotation />
          </TabsContent>

          <TabsContent value="rewards">
            <RewardDistributionPanel />
          </TabsContent>

          <TabsContent value="payouts">
            <AdminPayoutManager />
          </TabsContent>

          <TabsContent value="manual">
            <ManualPayoutPanel />
          </TabsContent>

          <TabsContent value="ai_payout">
            <AIPayoutIntelligence />
          </TabsContent>

          <TabsContent value="followups">
            <ReferralFollowUpAdmin />
          </TabsContent>

          <TabsContent value="disputes">
            <DisputeManager />
          </TabsContent>

          <TabsContent value="compliance">
            <ComplianceReview />
          </TabsContent>

          <TabsContent value="content_library">
            <ContentLibraryManager />
          </TabsContent>

          <TabsContent value="contests">
            <ContestManager />
          </TabsContent>

          <TabsContent value="events">
            <Card className="p-6">
              <p className="text-gray-600 mb-4">Manage platform-wide events and special challenges</p>
              <a href="/EventsManagement" className="text-blue-600 hover:underline">
                Go to Events Management →
              </a>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}