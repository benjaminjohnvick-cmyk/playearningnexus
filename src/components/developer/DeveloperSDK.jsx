import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code, Key, Zap, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function DeveloperSDK({ developer }) {
  const [apiKey, setApiKey] = useState(developer?.api_key || '');
  const queryClient = useQueryClient();

  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      const newKey = `gm_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      await base44.entities.BusinessClient.update(developer.id, {
        api_key: newKey
      });
      return newKey;
    },
    onSuccess: (key) => {
      setApiKey(key);
      queryClient.invalidateQueries(['developer']);
      toast.success('API key generated!');
    }
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const codeExamples = {
    analytics: `// Track custom event
fetch('https://api.gamergain.com/v1/analytics/event', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    game_id: 'your_game_id',
    user_id: 'user_id',
    event_name: 'level_completed',
    event_data: {
      level: 5,
      score: 1500,
      time_spent: 120
    }
  })
});`,
    iap: `// Process in-game purchase
fetch('https://api.gamergain.com/v1/purchases', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    game_id: 'your_game_id',
    user_id: 'user_id',
    product_id: 'coins_1000',
    amount: 9.99,
    currency: 'USD'
  })
});`,
    userProfile: `// Get user profile
fetch('https://api.gamergain.com/v1/users/{user_id}', {
  headers: {
    'Authorization': 'Bearer ${apiKey}'
  }
}).then(res => res.json())
  .then(data => console.log(data));`
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <Code className="w-6 h-6" />
            GamerGain Developer SDK
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">API Key</label>
              <div className="flex gap-2">
                <Input
                  value={apiKey || 'Generate an API key to get started'}
                  readOnly
                  className="font-mono text-sm"
                />
                {apiKey ? (
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(apiKey)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button onClick={() => generateKeyMutation.mutate()}>
                    <Key className="w-4 h-4 mr-2" />
                    Generate
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Keep your API key secure. Do not share it publicly.
              </p>
            </div>

            {apiKey && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900">SDK Ready</p>
                  <p className="text-sm text-green-700">
                    Use the examples below to integrate GamerGain into your game.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {apiKey && (
        <Card>
          <CardHeader>
            <CardTitle>SDK Examples</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="analytics">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="iap">Purchases</TabsTrigger>
                <TabsTrigger value="userProfile">User Data</TabsTrigger>
              </TabsList>

              {Object.entries(codeExamples).map(([key, code]) => (
                <TabsContent key={key} value={key}>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Available Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { method: 'POST', path: '/v1/analytics/event', desc: 'Track custom events' },
              { method: 'POST', path: '/v1/purchases', desc: 'Process IAP transactions' },
              { method: 'GET', path: '/v1/users/{user_id}', desc: 'Fetch user profile' },
              { method: 'GET', path: '/v1/games/{game_id}/metrics', desc: 'Game performance metrics' },
              { method: 'POST', path: '/v1/achievements', desc: 'Award achievements' }
            ].map((endpoint, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className={endpoint.method === 'POST' ? 'bg-blue-600' : 'bg-green-600'}>
                    {endpoint.method}
                  </Badge>
                  <code className="text-sm font-mono">{endpoint.path}</code>
                </div>
                <span className="text-sm text-gray-600">{endpoint.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}