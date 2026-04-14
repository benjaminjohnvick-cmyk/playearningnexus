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
import AdminDisputeReviewPanel from '../components/disputes/AdminDisputeReviewPanel';
import ComplianceReview from '../components/admin/ComplianceReview';
import ContentLibraryManager from '../components/admin/ContentLibraryManager';
import ContestManager from '../components/admin/ContestManager';
import FraudAlertPanel from '../components/admin/FraudAlertPanel';
import DataExportCenter from '../components/admin/DataExportCenter';
import CustomDomainManager from '../components/admin/CustomDomainManager';
import IntegrityMonitorPanel from '../components/admin/IntegrityMonitorPanel';
import ReconciliationPanel from '../components/admin/ReconciliationPanel';
import SurveyDropoffAnalytics from '../components/admin/SurveyDropoffAnalytics';
import SmartPayoutScheduler from '../components/admin/SmartPayoutScheduler';
import RealtimeFraudMonitor from '../components/admin/RealtimeFraudMonitor';
import PartnerTiersPanel from '../components/admin/PartnerTiersPanel';
import PPCAbTestManager from '../components/admin/PPCAbTestManager';
import AdminCredentialsPanel from '../components/admin/AdminCredentialsPanel';
import ProductPriceManager from '../components/admin/ProductPriceManager';
import FeedbackAdminDashboard from './FeedbackAdminDashboard';
import RetentionRiskPanel from '../components/admin/RetentionRiskPanel';
import SurveyABTestDashboard from '../components/admin/SurveyABTestDashboard';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [credVerified, setCredVerified] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    // Check session storage for already-verified admin session
    if (sessionStorage.getItem('admin_cred_verified') === 'true') {
      setCredVerified(true);
    }
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

  const handleCredLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const hash = await sha256(loginForm.password);
      const creds = await base44.entities.AdminCredential.filter({ username: loginForm.username, is_active: true });
      if (creds.length === 0 || creds[0].password_hash !== hash) {
        setLoginError('Invalid username or password.');
      } else {
        // Update last_login
        await base44.entities.AdminCredential.update(creds[0].id, { last_login: new Date().toISOString() });
        sessionStorage.setItem('admin_cred_verified', 'true');
        setCredVerified(true);
      }
    } catch {
      setLoginError('Login failed. Please try again.');
    }
    setLoginLoading(false);
  };

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

  // Check if any credentials exist — if none, skip the gate (first-time setup)
  // We show the login gate only if credVerified is false
  if (!credVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-purple-950">
        <Card className="w-full max-w-md shadow-2xl border-2 border-purple-300">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">Admin Login</h2>
                <p className="text-sm text-gray-500">Enter your admin credentials to continue</p>
              </div>
            </div>
            <form onSubmit={handleCredLogin} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Username</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Admin username"
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-purple-400 focus:outline-none"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Admin password"
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-purple-400 focus:outline-none pr-10"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              {loginError && (
                <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-60"
              >
                {loginLoading ? 'Verifying...' : 'Access Admin Dashboard'}
              </button>
              <p className="text-xs text-center text-gray-400 mt-2">
                No credentials set up yet? Go to Admin Dashboard → Credentials tab to create them.
              </p>
            </form>
          </div>
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
            <TabsTrigger value="custom_domains">🌐 Custom Domains</TabsTrigger>
            <TabsTrigger value="integrity">🛡️ Integrity Monitor</TabsTrigger>
            <TabsTrigger value="fraud_alerts">🚨 Fraud Alerts</TabsTrigger>
            <TabsTrigger value="reconciliation">💰 Reconciliation</TabsTrigger>
            <TabsTrigger value="exports">📊 Export</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="retention_risk">⚠️ Retention Risk</TabsTrigger>
            <TabsTrigger value="survey_ab">🧪 Survey A/B Tests</TabsTrigger>
            <TabsTrigger value="dropoff">📉 Drop-off Analytics</TabsTrigger>
            <TabsTrigger value="smart_payouts">💸 Smart Payouts</TabsTrigger>
            <TabsTrigger value="fraud_monitor">🛡️ Fraud Monitor</TabsTrigger>
            <TabsTrigger value="partner_tiers">🏅 Partner Tiers</TabsTrigger>
            <TabsTrigger value="ab_tests">🧪 A/B Tests</TabsTrigger>
            <TabsTrigger value="feedback">📋 Feedback</TabsTrigger>
            <TabsTrigger value="product_prices">💲 Product Prices</TabsTrigger>
            <TabsTrigger value="credentials">🔐 Credentials</TabsTrigger>
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
            <div className="space-y-6">
              <AdminDisputeReviewPanel />
              <DisputeManager />
            </div>
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

          <TabsContent value="custom_domains">
            <CustomDomainManager />
          </TabsContent>

          <TabsContent value="integrity">
            <IntegrityMonitorPanel />
          </TabsContent>

          <TabsContent value="fraud_alerts">
            <FraudAlertPanel adminUser={user} />
          </TabsContent>

          <TabsContent value="reconciliation">
            <ReconciliationPanel />
          </TabsContent>

          <TabsContent value="exports">
            <DataExportCenter />
          </TabsContent>

          <TabsContent value="events">
            <Card className="p-6">
              <p className="text-gray-600 mb-4">Manage platform-wide events and special challenges</p>
              <a href="/EventsManagement" className="text-blue-600 hover:underline">
                Go to Events Management →
              </a>
            </Card>
          </TabsContent>

          <TabsContent value="retention_risk">
            <RetentionRiskPanel />
          </TabsContent>

          <TabsContent value="survey_ab">
            <SurveyABTestDashboard />
          </TabsContent>

          <TabsContent value="dropoff">
            <SurveyDropoffAnalytics />
          </TabsContent>

          <TabsContent value="smart_payouts">
            <SmartPayoutScheduler />
          </TabsContent>

          <TabsContent value="fraud_monitor">
            <RealtimeFraudMonitor />
          </TabsContent>

          <TabsContent value="partner_tiers">
            <PartnerTiersPanel />
          </TabsContent>

          <TabsContent value="ab_tests">
            <PPCAbTestManager />
          </TabsContent>

          <TabsContent value="feedback">
            <FeedbackAdminDashboard embedded />
          </TabsContent>

          <TabsContent value="product_prices">
            <ProductPriceManager />
          </TabsContent>

          <TabsContent value="credentials">
            <AdminCredentialsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}