import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Trophy, TrendingUp, Target } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { toast } from 'sonner';

export default function ABTestingDashboard({ user }) {
  const queryClient = useQueryClient();
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [testData, setTestData] = useState({
    test_name: '',
    test_type: 'link',
    variant_a_id: '',
    variant_b_id: '',
    variant_a_name: 'Variant A',
    variant_b_name: 'Variant B'
  });

  const { data: tests = [] } = useQuery({
    queryKey: ['ab-tests', user.id],
    queryFn: () => base44.entities.ABTest.filter({ user_id: user.id })
  });

  const { data: referralLinks = [] } = useQuery({
    queryKey: ['referral-links-ab', user.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id })
  });

  const createTestMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.ABTest.create({
        ...data,
        user_id: user.id,
        start_date: new Date().toISOString().split('T')[0]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ab-tests']);
      toast.success('A/B test created!');
      setShowCreateTest(false);
      setTestData({ test_name: '', test_type: 'link', variant_a_id: '', variant_b_id: '', variant_a_name: 'Variant A', variant_b_name: 'Variant B' });
    }
  });

  const calculateWinner = (test) => {
    const aRate = test.variant_a_clicks > 0 ? (test.variant_a_conversions / test.variant_a_clicks) * 100 : 0;
    const bRate = test.variant_b_clicks > 0 ? (test.variant_b_conversions / test.variant_b_clicks) * 100 : 0;
    
    if (Math.abs(aRate - bRate) < 5) return { winner: 'tie', confidence: 50 };
    
    const totalSamples = test.variant_a_clicks + test.variant_b_clicks;
    const confidence = Math.min(95, (totalSamples / 100) * 95);
    
    return {
      winner: aRate > bRate ? 'a' : 'b',
      confidence: confidence.toFixed(1)
    };
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-purple-600" />
              A/B Testing Dashboard
            </CardTitle>
            <Button onClick={() => setShowCreateTest(!showCreateTest)}>
              {showCreateTest ? 'Cancel' : 'Create Test'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showCreateTest && (
            <div className="border-2 border-purple-200 rounded-lg p-6 bg-purple-50">
              <h3 className="font-semibold mb-4">Create New A/B Test</h3>
              <div className="space-y-4">
                <div>
                  <Label>Test Name</Label>
                  <Input
                    value={testData.test_name}
                    onChange={(e) => setTestData({...testData, test_name: e.target.value})}
                    placeholder="e.g., Facebook vs Instagram"
                  />
                </div>
                <div>
                  <Label>Variant A (Control)</Label>
                  <Select value={testData.variant_a_id} onValueChange={(v) => setTestData({...testData, variant_a_id: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select link" />
                    </SelectTrigger>
                    <SelectContent>
                      {referralLinks.map(link => (
                        <SelectItem key={link.id} value={link.id}>{link.link_code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Variant B (Test)</Label>
                  <Select value={testData.variant_b_id} onValueChange={(v) => setTestData({...testData, variant_b_id: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select link" />
                    </SelectTrigger>
                    <SelectContent>
                      {referralLinks.map(link => (
                        <SelectItem key={link.id} value={link.id}>{link.link_code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => createTestMutation.mutate(testData)}
                  disabled={!testData.test_name || !testData.variant_a_id || !testData.variant_b_id}
                  className="w-full"
                >
                  Start Test
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {tests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FlaskConical className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p>No A/B tests yet. Create one to optimize your referrals!</p>
              </div>
            ) : (
              tests.map((test) => {
                const result = calculateWinner(test);
                const aConvRate = test.variant_a_clicks > 0 ? ((test.variant_a_conversions / test.variant_a_clicks) * 100).toFixed(1) : 0;
                const bConvRate = test.variant_b_clicks > 0 ? ((test.variant_b_conversions / test.variant_b_clicks) * 100).toFixed(1) : 0;

                return (
                  <div key={test.id} className="border-2 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{test.test_name}</h3>
                        <Badge className={test.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {test.status}
                        </Badge>
                      </div>
                      {result.winner !== 'tie' && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <Trophy className="w-3 h-3 mr-1" />
                          {result.confidence}% confidence
                        </Badge>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className={`border-2 rounded-lg p-4 ${result.winner === 'a' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">{test.variant_a_name}</h4>
                          {result.winner === 'a' && <Trophy className="w-5 h-5 text-yellow-500" />}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Clicks:</span>
                            <span className="font-bold">{test.variant_a_clicks}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Conversions:</span>
                            <span className="font-bold text-blue-600">{test.variant_a_conversions}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Conv. Rate:</span>
                            <span className="font-bold text-purple-600">{aConvRate}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Earnings:</span>
                            <span className="font-bold text-green-600">${test.variant_a_earnings.toFixed(2)}</span>
                          </div>
                        </div>
                        <Progress value={parseFloat(aConvRate)} className="mt-3" />
                      </div>

                      <div className={`border-2 rounded-lg p-4 ${result.winner === 'b' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">{test.variant_b_name}</h4>
                          {result.winner === 'b' && <Trophy className="w-5 h-5 text-yellow-500" />}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Clicks:</span>
                            <span className="font-bold">{test.variant_b_clicks}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Conversions:</span>
                            <span className="font-bold text-blue-600">{test.variant_b_conversions}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Conv. Rate:</span>
                            <span className="font-bold text-purple-600">{bConvRate}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Earnings:</span>
                            <span className="font-bold text-green-600">${test.variant_b_earnings.toFixed(2)}</span>
                          </div>
                        </div>
                        <Progress value={parseFloat(bConvRate)} className="mt-3" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}