import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap, 
  MessageSquare, 
  Mic, 
  Cpu, 
  Cloud, 
  CheckCircle2,
  AlertCircle,
  ExternalLink 
} from "lucide-react";
import { toast } from "sonner";

export default function IntegrationSettings() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

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

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.IntegrationConfig.list(),
    enabled: !!user
  });

  const updateIntegrationMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) {
        return await base44.entities.IntegrationConfig.update(id, data);
      } else {
        return await base44.entities.IntegrationConfig.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
      toast.success('Integration updated!');
    }
  });

  const getIntegration = (name) => {
    return integrations.find(i => i.integration_name === name);
  };

  const updateIntegration = async (name, data) => {
    const existing = getIntegration(name);
    await updateIntegrationMutation.mutateAsync({
      id: existing?.id,
      data: {
        integration_name: name,
        ...data
      }
    });
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Card className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600">Only administrators can manage integrations</p>
        </Card>
      </div>
    );
  }

  const ghl = getIntegration('gohighlevel');
  const elevenlabs = getIntegration('elevenlabs');
  const nvidia = getIntegration('nvidia_dgx_spark');
  const twilio = getIntegration('twilio_sms');
  const cloud = getIntegration('cloud_autoscaling');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Integration Settings</h1>
          <p className="text-gray-600">Configure third-party services and AI agents</p>
        </div>

        <Tabs defaultValue="gohighlevel" className="space-y-6">
          <TabsList className="bg-white shadow-md">
            <TabsTrigger value="gohighlevel">GoHighLevel</TabsTrigger>
            <TabsTrigger value="elevenlabs">ElevenLabs</TabsTrigger>
            <TabsTrigger value="nvidia">NVIDIA DGX</TabsTrigger>
            <TabsTrigger value="sms">SMS/Notifications</TabsTrigger>
            <TabsTrigger value="cloud">Cloud Infrastructure</TabsTrigger>
          </TabsList>

          {/* GoHighLevel CRM */}
          <TabsContent value="gohighlevel">
            <Card className="p-6 border-0 shadow-xl">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <MessageSquare className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">GoHighLevel CRM</h2>
                  <p className="text-gray-600 mb-4">
                    Integrate GoHighLevel for business client dashboard CRM, automated workflows, and client management.
                  </p>
                  <a href="https://www.gohighlevel.com/" target="_blank" className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                    Learn more <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <Switch 
                    checked={ghl?.is_enabled || false}
                    onCheckedChange={(checked) => updateIntegration('gohighlevel', { is_enabled: checked })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>GoHighLevel API Key</Label>
                  <Input
                    type="password"
                    defaultValue={ghl?.api_key}
                    placeholder="Enter your GHL API key"
                    onBlur={(e) => updateIntegration('gohighlevel', { api_key: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get your API key from GoHighLevel Settings → API Keys
                  </p>
                </div>

                <Card className="p-4 bg-green-50 border-green-200">
                  <h4 className="font-bold text-gray-900 mb-2">Features Enabled:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>✓ Business client CRM dashboard</li>
                    <li>✓ Performance tracking and analytics</li>
                    <li>✓ Automated follow-up campaigns</li>
                    <li>✓ Client communication history</li>
                    <li>✓ Pipeline management for app submissions</li>
                  </ul>
                </Card>
              </div>
            </Card>
          </TabsContent>

          {/* ElevenLabs Voice AI */}
          <TabsContent value="elevenlabs">
            <Card className="p-6 border-0 shadow-xl">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Mic className="w-8 h-8 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">ElevenLabs Voice AI</h2>
                  <p className="text-gray-600 mb-4">
                    Use AI-generated voices for marketing materials, video narration, and promotional content.
                  </p>
                  <a href="https://elevenlabs.io/" target="_blank" className="text-purple-600 hover:underline flex items-center gap-1 text-sm">
                    Learn more <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <Switch 
                    checked={elevenlabs?.is_enabled || false}
                    onCheckedChange={(checked) => updateIntegration('elevenlabs', { is_enabled: checked })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>ElevenLabs API Key</Label>
                  <Input
                    type="password"
                    defaultValue={elevenlabs?.api_key}
                    placeholder="Enter your ElevenLabs API key"
                    onBlur={(e) => updateIntegration('elevenlabs', { api_key: e.target.value })}
                  />
                </div>

                <Card className="p-4 bg-purple-50 border-purple-200">
                  <h4 className="font-bold text-gray-900 mb-2">Use Cases:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>✓ Game trailer voiceovers</li>
                    <li>✓ Marketing video narration</li>
                    <li>✓ Automated SMS/call campaigns</li>
                    <li>✓ Multi-language content creation</li>
                  </ul>
                </Card>
              </div>
            </Card>
          </TabsContent>

          {/* NVIDIA DGX Spark */}
          <TabsContent value="nvidia">
            <Card className="p-6 border-0 shadow-xl">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Cpu className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">NVIDIA DGX Spark - 4TB</h2>
                  <p className="text-gray-600 mb-4">
                    AI agent infrastructure for mass-scale message board posting, marketing content creation, and automated store management.
                  </p>
                  <Badge className="bg-green-100 text-green-700">Cost: $3,999.99</Badge>
                </div>
                <div>
                  <Switch 
                    checked={nvidia?.is_enabled || false}
                    onCheckedChange={(checked) => updateIntegration('nvidia_dgx_spark', { is_enabled: checked })}
                  />
                </div>
              </div>

              <Card className="p-4 bg-blue-50 border-blue-200 mb-4">
                <h4 className="font-bold text-gray-900 mb-2">AI Agent Capabilities:</h4>
                <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-700">
                  <div>
                    <h5 className="font-semibold mb-1">Marketing Automation</h5>
                    <ul className="space-y-1">
                      <li>✓ Message board posting at scale</li>
                      <li>✓ Comment section engagement</li>
                      <li>✓ Video ad creation</li>
                      <li>✓ Multi-language content</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold mb-1">Platform Management</h5>
                    <ul className="space-y-1">
                      <li>✓ Auto-create new stores at 60 clients</li>
                      <li>✓ Performance tracking & analytics</li>
                      <li>✓ App interest survey analysis</li>
                      <li>✓ Automatic content translation</li>
                    </ul>
                  </div>
                </div>
              </Card>

              <div className="space-y-4">
                <div>
                  <Label>DGX API Endpoint</Label>
                  <Input
                    defaultValue={nvidia?.config_data?.endpoint}
                    placeholder="https://your-dgx-endpoint.nvidia.com"
                    onBlur={(e) => updateIntegration('nvidia_dgx_spark', { 
                      config_data: { ...nvidia?.config_data, endpoint: e.target.value }
                    })}
                  />
                </div>

                <Card className="p-4 bg-amber-50 border-amber-200">
                  <h4 className="font-bold text-gray-900 mb-2">⚠️ Important Notes:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• One-time hardware cost: $3,999.99</li>
                    <li>• Requires local network or cloud hosting setup</li>
                    <li>• AI agents run 24/7 for automated tasks</li>
                    <li>• Processes marketing campaigns across all platforms</li>
                  </ul>
                </Card>
              </div>
            </Card>
          </TabsContent>

          {/* SMS & Notifications */}
          <TabsContent value="sms">
            <Card className="p-6 border-0 shadow-xl">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Zap className="w-8 h-8 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">SMS & Push Notifications</h2>
                  <p className="text-gray-600 mb-4">
                    Configure Twilio for daily SMS notifications when new featured games become available.
                  </p>
                </div>
                <div>
                  <Switch 
                    checked={twilio?.is_enabled || false}
                    onCheckedChange={(checked) => updateIntegration('twilio_sms', { is_enabled: checked })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Twilio Account SID</Label>
                  <Input
                    defaultValue={twilio?.api_key}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxx"
                    onBlur={(e) => updateIntegration('twilio_sms', { api_key: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Twilio Auth Token</Label>
                  <Input
                    type="password"
                    defaultValue={twilio?.config_data?.auth_token}
                    placeholder="Enter auth token"
                    onBlur={(e) => updateIntegration('twilio_sms', { 
                      config_data: { ...twilio?.config_data, auth_token: e.target.value }
                    })}
                  />
                </div>

                <div>
                  <Label>Twilio Phone Number</Label>
                  <Input
                    defaultValue={twilio?.config_data?.phone_number}
                    placeholder="+1234567890"
                    onBlur={(e) => updateIntegration('twilio_sms', { 
                      config_data: { ...twilio?.config_data, phone_number: e.target.value }
                    })}
                  />
                </div>

                <Card className="p-4 bg-blue-50 border-blue-200">
                  <h4 className="font-bold text-gray-900 mb-2">SMS Features:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>✓ Daily featured game notifications</li>
                    <li>✓ Lockout reminder messages</li>
                    <li>✓ Survey completion reminders</li>
                    <li>✓ Referral program messages</li>
                    <li>✓ AI-generated personalized content</li>
                  </ul>
                </Card>
              </div>
            </Card>
          </TabsContent>

          {/* Cloud Auto-Scaling */}
          <TabsContent value="cloud">
            <Card className="p-6 border-0 shadow-xl">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-indigo-100 rounded-xl">
                  <Cloud className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Cloud Infrastructure</h2>
                  <p className="text-gray-600 mb-4">
                    Virtual server with auto-scaling enabled to handle growing user base (100k+ users per group).
                  </p>
                </div>
                <div>
                  <Badge className="bg-green-100 text-green-700">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
              </div>

              <Card className="p-4 bg-green-50 border-green-200 mb-4">
                <h4 className="font-bold text-gray-900 mb-2">✓ Auto-Scaling Configuration:</h4>
                <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">Min Instances:</span> 2
                  </div>
                  <div>
                    <span className="font-semibold">Max Instances:</span> 20
                  </div>
                  <div>
                    <span className="font-semibold">Scale Up Threshold:</span> 70% CPU
                  </div>
                  <div>
                    <span className="font-semibold">Scale Down Threshold:</span> 30% CPU
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-blue-50 border-blue-200">
                <h4 className="font-bold text-gray-900 mb-2">Infrastructure Features:</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>✓ Automatic scaling based on user load</li>
                  <li>✓ Load balancing across multiple servers</li>
                  <li>✓ Database replication and backups</li>
                  <li>✓ CDN for media assets (game icons, screenshots)</li>
                  <li>✓ 99.9% uptime SLA</li>
                  <li>✓ Handles 100k+ concurrent users per group</li>
                </ul>
              </Card>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}