import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Briefcase, TrendingUp, Zap, DollarSign, Mail, Clock, Award } from 'lucide-react';
import { toast } from 'sonner';

export default function CRMDashboard() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser.role !== 'admin') {
          window.location.href = '/';
          return;
        }
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  // Fetch leads
  const { data: allLeads = [] } = useQuery({
    queryKey: ['crmLeads'],
    queryFn: () => base44.entities.CRMLead.list('-created_date', 100),
    enabled: !!user
  });

  // Fetch automations
  const { data: automations = [] } = useQuery({
    queryKey: ['crmAutomations'],
    queryFn: () => base44.entities.CRMAutomation.list(),
    enabled: !!user
  });

  // Fetch business clients
  const { data: developers = [] } = useQuery({
    queryKey: ['developers'],
    queryFn: () => base44.entities.BusinessClient.list(),
    enabled: !!user
  });

  // Calculate metrics
  const newLeads = allLeads.filter(l => l.status === 'new').length;
  const qualifiedLeads = allLeads.filter(l => l.lifecycle_stage === 'sql' || l.lifecycle_stage === 'opportunity').length;
  const conversions = allLeads.filter(l => l.status === 'converted').length;
  const conversionRate = allLeads.length > 0 ? ((conversions / allLeads.length) * 100).toFixed(1) : 0;
  const totalRevenue = allLeads.reduce((sum, lead) => sum + (lead.conversion_value || 0), 0);

  const userLeads = allLeads.filter(l => l.lead_type === 'user');
  const developerLeads = allLeads.filter(l => l.lead_type === 'developer');
  const businessLeads = allLeads.filter(l => l.lead_type === 'business_client');

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AI-Powered CRM Dashboard</h1>
          <p className="text-gray-600">Comprehensive marketplace relationship management</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">New Leads</p>
                  <p className="text-3xl font-bold text-blue-600">{newLeads}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Qualified Leads</p>
                  <p className="text-3xl font-bold text-purple-600">{qualifiedLeads}</p>
                </div>
                <Award className="w-8 h-8 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Conversion Rate</p>
                  <p className="text-3xl font-bold text-green-600">{conversionRate}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-3xl font-bold text-emerald-600">${totalRevenue.toFixed(0)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-emerald-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="leads" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="leads">All Leads</TabsTrigger>
            <TabsTrigger value="developers">Developer Lifecycle</TabsTrigger>
            <TabsTrigger value="automations">Automations</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* All Leads Tab */}
          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle>Lead Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <Users className="w-6 h-6 text-blue-600 mb-2" />
                      <p className="text-sm text-gray-600">User Leads</p>
                      <p className="text-2xl font-bold">{userLeads.length}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <Briefcase className="w-6 h-6 text-purple-600 mb-2" />
                      <p className="text-sm text-gray-600">Developer Leads</p>
                      <p className="text-2xl font-bold">{developerLeads.length}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <DollarSign className="w-6 h-6 text-green-600 mb-2" />
                      <p className="text-sm text-gray-600">Business Leads</p>
                      <p className="text-2xl font-bold">{businessLeads.length}</p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Source</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Engagement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {allLeads.slice(0, 10).map(lead => (
                          <tr key={lead.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium">{lead.name || lead.email}</p>
                                <p className="text-sm text-gray-500">{lead.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                {lead.lead_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                lead.status === 'converted' ? 'bg-green-100 text-green-800' :
                                lead.status === 'qualified' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">{lead.source}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${lead.engagement_score || 0}%` }}
                                  />
                                </div>
                                <span className="text-sm text-gray-600">{lead.engagement_score || 0}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Developer Lifecycle Tab */}
          <TabsContent value="developers">
            <Card>
              <CardHeader>
                <CardTitle>Developer Lifecycle Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Onboarding Pipeline */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Onboarding Pipeline</h3>
                    <div className="grid md:grid-cols-4 gap-4">
                      {['pending', 'active', 'suspended'].map(status => {
                        const count = developers.filter(d => d.account_status === status).length;
                        return (
                          <div key={status} className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600 capitalize">{status}</p>
                            <p className="text-3xl font-bold text-blue-600">{count}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Developers */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Recent Developers</h3>
                    <div className="space-y-3">
                      {developers.slice(0, 5).map(dev => (
                        <div key={dev.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                          <div>
                            <p className="font-medium">{dev.company_name}</p>
                            <p className="text-sm text-gray-500">{dev.contact_email}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">{dev.games_count || 0} games</p>
                            <p className="text-sm font-semibold text-green-600">${(dev.total_revenue || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automations Tab */}
          <TabsContent value="automations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Active Automations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {automations.filter(a => a.is_active).map(automation => (
                    <div key={automation.id} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{automation.automation_type.replace(/_/g, ' ').toUpperCase()}</h3>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">Active</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">Target: {automation.target_segment}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Executions</p>
                          <p className="font-bold">{automation.execution_count}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Success Rate</p>
                          <p className="font-bold text-green-600">{automation.success_rate}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Trigger</p>
                          <p className="font-medium">{automation.trigger_event}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {automations.filter(a => a.is_active).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No active automations</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['referral_contest', 'organic', 'marketing_campaign', 'partner'].map(source => {
                      const count = allLeads.filter(l => l.source === source).length;
                      const percentage = allLeads.length > 0 ? ((count / allLeads.length) * 100).toFixed(1) : 0;
                      return (
                        <div key={source}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize">{source.replace(/_/g, ' ')}</span>
                            <span className="font-semibold">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lifecycle Stages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['lead', 'mql', 'sql', 'opportunity', 'customer'].map(stage => {
                      const count = allLeads.filter(l => l.lifecycle_stage === stage).length;
                      return (
                        <div key={stage} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="capitalize font-medium">{stage.toUpperCase()}</span>
                          <span className="text-2xl font-bold text-blue-600">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}