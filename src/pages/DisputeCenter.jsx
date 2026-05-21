import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, Plus, History, Bot, AlertCircle, Info, Settings, Upload, Gamepad2, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminDisputeDashboard from '@/components/disputes/AdminDisputeDashboard';
import AppealSubmissionForm from '@/components/disputes/AppealSubmissionForm';
import AppealHistoryList from '@/components/disputes/AppealHistoryList';
import SelfServiceDisputeModule from '@/components/surveys/SelfServiceDisputeModule';
import AutoDisputeWorkflow from '@/components/disputes/AutoDisputeWorkflow';
import EvidenceUploader from '@/components/disputes/EvidenceUploader';
import AIDisputeReviewer from '@/components/disputes/AIDisputeReviewer';
import GameSurveyClaimForm from '@/components/disputes/GameSurveyClaimForm';
import AdminClaimsPanel from '@/components/disputes/AdminClaimsPanel';
import ClaimStatusDashboard from '@/components/disputes/ClaimStatusDashboard';

export default function DisputeCenter() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dispute & Appeal Center</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Appeal rejected survey responses or report missing credits. Our AI reviews evidence automatically.
            </p>
          </div>
        </div>

        {/* AI Resolution Center CTA */}
        <Link to="/AIDisputeResolutionCenter">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-4 flex items-center justify-between gap-4 mb-2 cursor-pointer hover:opacity-95 transition-opacity">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-300 flex-shrink-0" />
              <div>
                <p className="font-black text-white text-sm">🆕 AI Dispute Resolution Center</p>
                <p className="text-purple-200 text-xs">Upload evidence → AI analyzes vs transaction logs → instant payout or clear denial reason</p>
              </div>
            </div>
            <Button size="sm" className="bg-yellow-400 text-yellow-900 font-black hover:bg-yellow-300 flex-shrink-0">
              Open <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </Link>

        {/* Info banner */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
          <Bot className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-800">
            <p className="font-semibold">AI-Powered Evidence Review</p>
            <p className="text-xs mt-0.5 text-indigo-700">
              All appeals are automatically analyzed by our AI system against quality guidelines, your response history, and platform data.
              High-confidence cases are auto-resolved within minutes. Appeals with evidence are resolved 5× faster.
            </p>
          </div>
        </div>

        <Tabs defaultValue="appeal">
          <TabsList className="bg-white shadow-sm border w-full flex-wrap h-auto">
            <TabsTrigger value="appeal" className="flex-1">
              <Plus className="w-3.5 h-3.5 mr-1" /> New Appeal
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <History className="w-3.5 h-3.5 mr-1" /> My Appeals
            </TabsTrigger>
            <TabsTrigger value="auto" className="flex-1">
              <Bot className="w-3.5 h-3.5 mr-1" /> Smart Dispute
            </TabsTrigger>
            <TabsTrigger value="missing" className="flex-1">
              <AlertCircle className="w-3.5 h-3.5 mr-1" /> Missing Credits
            </TabsTrigger>
            <TabsTrigger value="claims" className="flex-1">
              <Gamepad2 className="w-3.5 h-3.5 mr-1" /> Game/Survey Claims
            </TabsTrigger>
            <TabsTrigger value="claim_status" className="flex-1">
              <Shield className="w-3.5 h-3.5 mr-1" /> My Claims
            </TabsTrigger>
            {user?.role === 'admin' && (
              <TabsTrigger value="admin" className="flex-1 text-purple-700">
                <Settings className="w-3.5 h-3.5 mr-1" /> Admin
              </TabsTrigger>
            )}
            {user?.role === 'admin' && (
              <TabsTrigger value="admin_claims" className="flex-1 text-red-700">
                <Shield className="w-3.5 h-3.5 mr-1" /> Review Claims
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="appeal">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" /> Appeal a Rejected Response
                </CardTitle>
                <p className="text-xs text-gray-500">Select a flagged or blocked response to start your appeal. AI will review the evidence.</p>
              </CardHeader>
              <CardContent>
                <AppealSubmissionForm user={user} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-500" /> My Appeal History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AppealHistoryList user={user} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auto">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-500" /> AI-Powered Self-Service Dispute
                </CardTitle>
                <p className="text-xs text-gray-500">Submit a dispute and get an instant AI decision. High-quality users receive automatic goodwill credits.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <EvidenceUploader onUpload={(data) => {}} />
                <AutoDisputeWorkflow user={user} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="missing">
            <SelfServiceDisputeModule user={user} />
          </TabsContent>

          <TabsContent value="claims">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-purple-500" /> Submit Game / Survey Credit Claim
                </CardTitle>
                <p className="text-xs text-gray-500">Completed a game or survey that wasn't credited? Submit proof and we'll review it within 24–48 hours.</p>
              </CardHeader>
              <CardContent>
                <GameSurveyClaimForm user={user} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="claim_status">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" /> My Claims — Real-Time Status
                </CardTitle>
                <p className="text-xs text-gray-500">Track every claim you've submitted. Get instant notifications when an admin approves your payout.</p>
              </CardHeader>
              <CardContent>
                <ClaimStatusDashboard user={user} />
              </CardContent>
            </Card>
          </TabsContent>

          {user?.role === 'admin' && (
            <TabsContent value="admin">
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="w-4 h-4 text-purple-500" /> Admin Dispute Management
                  </CardTitle>
                  <p className="text-xs text-gray-500">Review, AI-verify, and resolve all platform disputes.</p>
                </CardHeader>
                <CardContent>
                  <AdminDisputeDashboard />
                </CardContent>
              </Card>
            </TabsContent>
          )}
          {user?.role === 'admin' && (
            <TabsContent value="admin_claims">
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-500" /> Review Game / Survey Claims
                  </CardTitle>
                  <p className="text-xs text-gray-500">Approve or deny user credit claims. Email notifications sent automatically.</p>
                </CardHeader>
                <CardContent>
                  <AdminClaimsPanel />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Guidelines */}
        <Card className="border-0 bg-gray-50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-gray-400" /> Appeal Guidelines
            </p>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>• Each rejected response can only be appealed once</li>
              <li>• Appeals are reviewed by AI within minutes of submission</li>
              <li>• High-trust users (score 65+) receive expedited review</li>
              <li>• Providing screenshots or evidence significantly improves approval odds</li>
              <li>• Frivolous appeals may affect your trust score</li>
              <li>• If AI auto-resolution conflicts with your experience, use the "Run AI Review Now" button to re-analyze</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}