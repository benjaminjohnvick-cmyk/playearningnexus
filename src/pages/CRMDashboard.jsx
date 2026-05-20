import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap, 
  Mail, 
  TrendingUp, 
  Users, 
  Target,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

export default function CRMDashboard() {
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [activeTab, setActiveTab] = useState('prospects');
  const queryClient = useQueryClient();

  // Fetch prospects
  const { data: prospects = [], isLoading: prospectLoading } = useQuery({
    queryKey: ['crm_prospects'],
    queryFn: () => base44.entities.CRMProspect.list('-created_date', 50),
  });

  // Fetch conversions
  const { data: conversions = [] } = useQuery({
    queryKey: ['crm_conversions'],
    queryFn: () => base44.entities.CRMLeadConversion.list('-created_date', 50),
  });

  // Fetch outreach
  const { data: outreach = [] } = useQuery({
    queryKey: ['crm_outreach'],
    queryFn: () => base44.entities.CRMOutreach.list('-sent_date', 50),
  });

  // Fetch white label partners
  const { data: partners = [] } = useQuery({
    queryKey: ['white_label_partners'],
    queryFn: () => base44.entities.WhiteLabelPartner.list('-total_revenue_generated', 20),
  });

  // AI identification mutation
  const aiIdentifyMutation = useMutation({
    mutationFn: async (industries) => {
      const response = await base44.functions.invoke('aiIdentifyBusinessClients', {
        industries: industries,
        company_size: 'medium'
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm_prospects'] });
    }
  });

  // Generate outreach mutation
  const generateOutreachMutation = useMutation({
    mutationFn: async (prospectId) => {
      const response = await base44.functions.invoke('generatePersonalizedOutreach', {
        prospect_id: prospectId,
        outreach_type: 'email'
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm_outreach', 'crm_prospects'] });
    }
  });

  // Calculate stats
  const statsCards = [
    {
      title: 'Total Prospects',
      value: prospects.length,
      icon: Users,
      color: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Avg Fit Score',
      value: prospects.length > 0 
        ? (prospects.reduce((sum, p) => sum + (p.ai_fit_score || 0), 0) / prospects.length).toFixed(1)
        : '0',
      icon: Target,
      color: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Total Outreach',
      value: outreach.length,
      icon: Mail,
      color: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      title: 'Conversions',
      value: conversions.filter(c => c.deal_stage === 'closed_won').length,
      icon: CheckCircle,
      color: 'bg-emerald-50',
      iconColor: 'text-emerald-600'
    }
  ];

  // White label revenue stats
  const totalPartnerRevenue = partners.reduce((sum, p) => sum + (p.total_revenue_generated || 0), 0);
  const totalPartnerEarnings = partners.reduce((sum, p) => sum + (p.partner_earned || 0), 0);
  const totalUserEarnings = partners.reduce((sum, p) => sum + (p.user_earned || 0), 0);
  const totalPlatformEarnings = partners.reduce((sum, p) => sum + (p.platform_earned || 0), 0);

  const statusColors = {
    new: 'bg-blue-100 text-blue-800',
    contacted: 'bg-yellow-100 text-yellow-800',
    engaged: 'bg-purple-100 text-purple-800',
    proposal_sent: 'bg-orange-100 text-orange-800',
    negotiating: 'bg-pink-100 text-pink-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800'
  };

  const dealStageColors = {
    'closed_won': 'bg-green-100 text-green-800',
    'closed_lost': 'bg-red-100 text-red-800',
    'negotiation': 'bg-orange-100 text-orange-800',
    'proposal': 'bg-blue-100 text-blue-800'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">CRM Dashboard</h1>
          <p className="text-slate-600">AI-powered prospect identification and conversion tracking</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card key={idx} className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className={`${stat.color} p-3 rounded-lg w-fit mb-4`}>
                    <Icon className={`${stat.iconColor} w-6 h-6`} />
                  </div>
                  <p className="text-sm text-slate-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="prospects">Prospects</TabsTrigger>
            <TabsTrigger value="outreach">Outreach</TabsTrigger>
            <TabsTrigger value="conversions">Conversions</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          </TabsList>

          {/* Prospects Tab */}
          <TabsContent value="prospects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Identify New Prospects</CardTitle>
                <CardDescription>Use AI to find high-potential business clients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    onClick={() => aiIdentifyMutation.mutate(['saas', 'fintech'])}
                    disabled={aiIdentifyMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    SaaS & Fintech
                  </Button>
                  <Button 
                    onClick={() => aiIdentifyMutation.mutate(['ecommerce', 'retail'])}
                    disabled={aiIdentifyMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    E-commerce & Retail
                  </Button>
                  <Button 
                    onClick={() => aiIdentifyMutation.mutate(['healthcare', 'education'])}
                    disabled={aiIdentifyMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Healthcare & Education
                  </Button>
                </div>
                {aiIdentifyMutation.isPending && <p className="text-sm text-slate-600">Identifying prospects...</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prospect List</CardTitle>
                <CardDescription>{prospects.length} prospects identified</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {prospects.map((prospect) => (
                    <div key={prospect.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{prospect.company_name}</h3>
                          <p className="text-sm text-slate-600">{prospect.contact_name} • {prospect.contact_email}</p>
                        </div>
                        <Badge className={statusColors[prospect.status] || 'bg-gray-100'}>
                          {prospect.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{prospect.ai_insights}</p>
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <Badge variant="outline">Fit: {prospect.ai_fit_score}/100</Badge>
                          <Badge variant="outline">{prospect.industry}</Badge>
                        </div>
                        <Button 
                          onClick={() => generateOutreachMutation.mutate(prospect.id)}
                          size="sm"
                          variant="outline"
                          disabled={generateOutreachMutation.isPending}
                        >
                          <Mail className="w-3 h-3 mr-1" />
                          Generate Email
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outreach Tab */}
          <TabsContent value="outreach">
            <Card>
              <CardHeader>
                <CardTitle>Outreach History</CardTitle>
                <CardDescription>{outreach.length} outreach attempts tracked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {outreach.map((item) => {
                    const prospect = prospects.find(p => p.id === item.prospect_id);
                    return (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-slate-900">{prospect?.company_name}</h3>
                            <p className="text-sm text-slate-600">{item.subject_line}</p>
                          </div>
                          <Badge variant="outline">{item.outreach_type}</Badge>
                        </div>
                        <div className="flex gap-4 text-sm text-slate-600">
                          {item.opened && <div className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Opened</div>}
                          {item.response_received && <div className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Response</div>}
                          {item.response_sentiment && <Badge variant="outline">{item.response_sentiment}</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversions Tab */}
          <TabsContent value="conversions">
            <Card>
              <CardHeader>
                <CardTitle>Deal Pipeline</CardTitle>
                <CardDescription>{conversions.length} deals in progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {conversions.map((conversion) => {
                    const prospect = prospects.find(p => p.id === conversion.prospect_id);
                    return (
                      <div key={conversion.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-slate-900">{prospect?.company_name}</h3>
                            <p className="text-sm text-slate-600">${conversion.estimated_deal_value?.toFixed(2) || '0'} deal</p>
                          </div>
                          <Badge className={dealStageColors[conversion.deal_stage] || 'bg-gray-100'}>
                            {conversion.deal_stage}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600">Probability</p>
                            <p className="font-semibold">{conversion.probability_percent || 0}%</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Outreach</p>
                            <p className="font-semibold">{conversion.outreach_count} attempts</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Close Date</p>
                            <p className="font-semibold">{conversion.expected_close_date ? new Date(conversion.expected_close_date).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="bg-green-50 p-3 rounded-lg w-fit mb-4">
                    <DollarSign className="text-green-600 w-6 h-6" />
                  </div>
                  <p className="text-sm text-slate-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">${totalPartnerRevenue.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="bg-orange-50 p-3 rounded-lg w-fit mb-4">
                    <Users className="text-orange-600 w-6 h-6" />
                  </div>
                  <p className="text-sm text-slate-600 mb-1">User Earnings (25%)</p>
                  <p className="text-2xl font-bold text-slate-900">${totalUserEarnings.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="bg-blue-50 p-3 rounded-lg w-fit mb-4">
                    <Users className="text-blue-600 w-6 h-6" />
                  </div>
                  <p className="text-sm text-slate-600 mb-1">Partner Earnings (25%)</p>
                  <p className="text-2xl font-bold text-slate-900">${totalPartnerEarnings.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="bg-purple-50 p-3 rounded-lg w-fit mb-4">
                    <TrendingUp className="text-purple-600 w-6 h-6" />
                  </div>
                  <p className="text-sm text-slate-600 mb-1">Platform Earnings (50%)</p>
                  <p className="text-2xl font-bold text-slate-900">${totalPlatformEarnings.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>White Label Partner Performance</CardTitle>
                <CardDescription>Revenue split: 50% platform, 25% user, 25% partner</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {partners.map((partner) => (
                    <div key={partner.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{partner.partner_name}</h3>
                          <p className="text-sm text-slate-600">{partner.contact_email}</p>
                        </div>
                        <Badge variant={partner.status === 'active' ? 'default' : 'secondary'}>
                          {partner.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600">Prospects</p>
                          <p className="font-semibold">{partner.total_prospects}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Conversions</p>
                          <p className="font-semibold">{partner.total_conversions}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Conv. Rate</p>
                          <p className="font-semibold">{partner.conversion_rate_percent?.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-slate-600">User Share (25%)</p>
                          <p className="font-semibold text-orange-600">${partner.user_earned?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Partner Share (25%)</p>
                          <p className="font-semibold text-green-600">${partner.partner_earned?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Platform Share (50%)</p>
                          <p className="font-semibold text-blue-600">${partner.platform_earned?.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}