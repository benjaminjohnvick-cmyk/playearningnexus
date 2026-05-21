import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, TrendingUp, DollarSign, Activity, Zap, Clock, Shield } from 'lucide-react';

const SEVERITY_CONFIG = {
  low: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  medium: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  high: { color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  critical: { color: 'bg-red-100 text-red-800', icon: Shield }
};

export default function SupportTicketDossierViewer() {
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [loadingDossier, setLoadingDossier] = useState(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['ticketDossiers'],
    queryFn: async () => {
      if (user?.role === 'admin') {
        return base44.asServiceRole.entities.SupportTicketDossier.filter(
          { status: 'generated' }, '-generated_at', 50
        );
      }
      return [];
    },
    enabled: !!user && user.role === 'admin'
  });

  const generateDossierMutation = useMutation({
    mutationFn: async (ticket_id) => {
      setLoadingDossier(ticket_id);
      try {
        const result = await base44.functions.invoke('generateSupportTicketDossier', { ticket_id });
        queryClient.invalidateQueries({ queryKey: ['ticketDossiers'] });
        return result;
      } finally {
        setLoadingDossier(null);
      }
    }
  });

  if (!selectedDossier && dossiers.length > 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Support Ticket Dossiers</h1>
          <p className="text-slate-600 mb-6">AI-generated dispute summaries with auto-scraped data</p>

          {isLoading ? (
            <div className="text-center text-slate-500 py-12">Loading dossiers...</div>
          ) : (
            <div className="space-y-3">
              {dossiers.map(dossier => {
                const sc = SEVERITY_CONFIG[dossier.ai_insights?.severity_assessment || 'low'];
                const Icon = sc.icon;
                return (
                  <Card key={dossier.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedDossier(dossier)}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-sm text-slate-500">{dossier.ticket_id?.slice(-6)}</span>
                            <span className="font-semibold">{dossier.user_email}</span>
                            <Badge className={sc.color}><Icon className="w-3 h-3 mr-1" />{dossier.ai_insights?.severity_assessment?.toUpperCase()}</Badge>
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-2">{dossier.ai_summary}</p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-bold text-purple-600">{dossier.ai_insights?.confidence_score}% Confidence</p>
                          <p className="text-xs text-slate-500">{new Date(dossier.generated_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedDossier) {
    const sc = SEVERITY_CONFIG[selectedDossier.ai_insights?.severity_assessment || 'low'];
    const Icon = sc.icon;
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => setSelectedDossier(null)} className="text-blue-600 hover:underline mb-4 block">← Back to Dossiers</button>

          <div className="grid gap-6">
            {/* Header */}
            <Card className={`border-l-4 ${sc.color.split(' ')[0]}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedDossier.user_email}</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Ticket #{selectedDossier.ticket_id?.slice(-6).toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={`text-lg px-3 py-1 ${sc.color}`}><Icon className="w-4 h-4 mr-1" />{selectedDossier.ai_insights?.severity_assessment?.toUpperCase()}</Badge>
                    <p className="text-sm font-bold text-purple-600 mt-2">{selectedDossier.ai_insights?.confidence_score}% Confidence</p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* AI Summary */}
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <CardHeader><CardTitle className="flex items-center gap-2 text-purple-800"><Zap className="w-5 h-5" />AI Analysis Summary</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed mb-4">{selectedDossier.ai_summary}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded p-3">
                    <p className="text-xs text-slate-500">Likely Issue</p>
                    <p className="font-semibold text-slate-900">{selectedDossier.ai_insights?.likely_issue_category || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded p-3">
                    <p className="text-xs text-slate-500">Recommended Actions</p>
                    <ul className="text-xs space-y-1 mt-1">
                      {(selectedDossier.ai_insights?.recommended_actions || []).slice(0, 2).map((action, i) => (
                        <li key={i}>✓ {action}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="user" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="user">User Profile</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="financials">Financials</TabsTrigger>
                <TabsTrigger value="flags">Risk Flags</TabsTrigger>
              </TabsList>

              {/* User Profile */}
              <TabsContent value="user">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Account Information</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Account Age</p>
                        <p className="font-semibold">{selectedDossier.user_profile?.account_age_days || 0} days</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Earnings</p>
                        <p className="font-semibold text-green-600">${(selectedDossier.user_profile?.total_earnings || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Account Status</p>
                        <p className="font-semibold">{selectedDossier.user_profile?.account_status || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Tier</p>
                        <p className="font-semibold capitalize">{selectedDossier.user_profile?.user_tier || 'Standard'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Verification</p>
                        <p className="font-semibold">{selectedDossier.user_profile?.verification_status}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Last Login</p>
                        <p className="font-semibold text-sm">{new Date(selectedDossier.user_profile?.last_login).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Activity */}
              <TabsContent value="activity">
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Recent Activity</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(selectedDossier.activity_timeline || []).map((act, i) => (
                          <div key={i} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                            <span className="text-slate-600">{act.event_type}</span>
                            <span className="text-xs text-slate-400">{new Date(act.timestamp).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" />Referral Metrics</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="bg-blue-50 rounded p-3">
                          <p className="text-xs text-slate-600">Total Referrals</p>
                          <p className="text-2xl font-bold text-blue-600">{selectedDossier.referral_data?.total_referrals || 0}</p>
                        </div>
                        <div className="bg-green-50 rounded p-3">
                          <p className="text-xs text-slate-600">Conversions</p>
                          <p className="text-2xl font-bold text-green-600">{selectedDossier.referral_data?.total_conversions || 0}</p>
                        </div>
                        <div className="bg-purple-50 rounded p-3">
                          <p className="text-xs text-slate-600">Conv. Rate</p>
                          <p className="text-2xl font-bold text-purple-600">{selectedDossier.referral_data?.conversion_rate || 0}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Financials */}
              <TabsContent value="financials">
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Recent Transactions</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(selectedDossier.transaction_history || []).slice(0, 10).map((txn, i) => (
                          <div key={i} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                            <div>
                              <p className="font-semibold">{txn.type}</p>
                              <p className="text-xs text-slate-500">{new Date(txn.timestamp).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">${txn.amount}</p>
                              <Badge className="text-xs">{txn.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">Payout History</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(selectedDossier.payout_history || []).map((payout, i) => (
                          <div key={i} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                            <div>
                              <p className="font-semibold">{payout.month}</p>
                              <p className="text-xs text-slate-500">via {payout.method}</p>
                            </div>
                            <p className="font-bold text-green-600">${payout.amount}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Risk Flags */}
              <TabsContent value="flags">
                <div className="space-y-4">
                  {selectedDossier.anomalies_detected?.length > 0 && (
                    <Card className="border-orange-200 bg-orange-50">
                      <CardHeader><CardTitle className="text-sm text-orange-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Detected Anomalies</CardTitle></CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {selectedDossier.anomalies_detected.map((anomaly, i) => (
                            <li key={i} className="text-sm text-orange-700">• {anomaly}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {selectedDossier.fraud_risk_flags?.length > 0 && (
                    <Card className="border-red-200 bg-red-50">
                      <CardHeader><CardTitle className="text-sm text-red-800 flex items-center gap-2"><Shield className="w-4 h-4" />Fraud Risk Indicators</CardTitle></CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {selectedDossier.fraud_risk_flags.map((flag, i) => (
                            <li key={i} className="text-sm text-red-700">⚠️ {flag}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {!selectedDossier.anomalies_detected?.length && !selectedDossier.fraud_risk_flags?.length && (
                    <Card>
                      <CardContent className="pt-6 text-center text-slate-500">
                        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                        <p>No anomalies or fraud flags detected</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    );
  }

  return null;
}