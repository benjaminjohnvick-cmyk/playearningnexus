import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Plus, History, Bot, AlertCircle, Info } from 'lucide-react';
import AppealSubmissionForm from '@/components/disputes/AppealSubmissionForm';
import AppealHistoryList from '@/components/disputes/AppealHistoryList';
import SelfServiceDisputeModule from '@/components/surveys/SelfServiceDisputeModule';
import AutoDisputeWorkflow from '@/components/disputes/AutoDisputeWorkflow';

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
          <TabsList className="bg-white shadow-sm border w-full">
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
              <CardContent>
                <AutoDisputeWorkflow user={user} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="missing">
            <SelfServiceDisputeModule user={user} />
          </TabsContent>
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