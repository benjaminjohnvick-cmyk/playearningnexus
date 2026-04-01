import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { Brain, Check, X, Settings, Zap, Globe, Mic, Eye, Download } from 'lucide-react';
import { motion } from 'framer-motion';

const AI_AGENTS = [
  { id: 'daily_surveys', name: 'Daily AI Surveys', description: 'Auto-generates product surveys ranked 1-10', icon: Brain, enabled: true },
  { id: 'earnings_monitor', name: 'Earnings Monitor', description: 'Real-time tracking of earned & owed amounts', icon: Zap, enabled: true },
  { id: 'multilingual', name: 'Multilingual Translator', description: 'Auto-translates to 12 languages', icon: Globe, enabled: true },
  { id: 'voice_mode', name: 'Voice Mode', description: 'Voice surveys, navigation & site reading', icon: Mic, enabled: true },
  { id: 'ux_recorder', name: 'UX Session Recorder', description: 'Records sessions to optimize conversions', icon: Eye, enabled: true },
  { id: 'data_export', name: 'Data Export', description: 'One-click download with analytics', icon: Download, enabled: true },
  { id: 'youtube_embed', name: 'YouTube Auto-Embed', description: 'Embeds ad grid in YouTube videos', icon: Brain, enabled: true },
  { id: 'contest_matchmaker', name: 'Contest Matchmaker', description: 'AI-selects group sizes for contests', icon: Zap, enabled: true },
];

export default function AIAgentsSettings() {
  const [user, setUser] = useState(null);
  const [agents, setAgents] = useState(AI_AGENTS);
  const [globalEnabled, setGlobalEnabled] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
    // Load saved preferences
    const saved = localStorage.getItem('ai_agents_settings');
    if (saved) setAgents(JSON.parse(saved));
  }, []);

  const toggleAgent = (id) => {
    const updated = agents.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    setAgents(updated);
    localStorage.setItem('ai_agents_settings', JSON.stringify(updated));
  };

  const toggleAll = () => {
    const newState = !globalEnabled;
    setGlobalEnabled(newState);
    const updated = agents.map(a => ({ ...a, enabled: newState }));
    setAgents(updated);
    localStorage.setItem('ai_agents_settings', JSON.stringify(updated));
  };

  if (!user) return <div>Loading...</div>;

  const enabledCount = agents.filter(a => a.enabled).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-900 mb-2 flex items-center gap-3">
            <Brain className="w-10 h-10 text-purple-600" /> AI Agents Control Center
          </h1>
          <p className="text-gray-600">All AI agents are enabled by default. Opt-out of any you don't want to use.</p>
        </div>

        {/* Global Toggle */}
        <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-6 mb-8 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">Master Control</h2>
              <p className="text-purple-100">{enabledCount} of {agents.length} agents active</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold">{globalEnabled ? 'All Enabled' : 'All Disabled'}</span>
              <Toggle
                pressed={globalEnabled}
                onPressedChange={toggleAll}
                className="bg-white/30 hover:bg-white/50 border-2 border-white data-[state=on]:bg-white"
              >
                <Check className={`w-5 h-5 ${globalEnabled ? 'text-green-600' : 'text-gray-400'}`} />
              </Toggle>
            </div>
          </div>
        </Card>

        {/* Agents Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {agents.map((agent, idx) => {
            const Icon = agent.icon;
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className={`p-6 border-2 transition-all cursor-pointer ${
                  agent.enabled 
                    ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 shadow-md' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-3 rounded-lg ${agent.enabled ? 'bg-purple-100' : 'bg-gray-200'}`}>
                        <Icon className={`w-6 h-6 ${agent.enabled ? 'text-purple-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{agent.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{agent.description}</p>
                      </div>
                    </div>
                    <Toggle
                      pressed={agent.enabled}
                      onPressedChange={() => toggleAgent(agent.id)}
                      className={`${agent.enabled ? 'bg-green-500' : 'bg-gray-300'} hover:opacity-80`}
                    >
                      {agent.enabled ? <Check className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white" />}
                    </Toggle>
                  </div>
                  <Badge className={agent.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>
                    {agent.enabled ? '✓ Active' : '✗ Disabled'}
                  </Badge>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Info Section */}
        <Card className="mt-8 p-6 bg-blue-50 border-blue-200">
          <h3 className="font-bold text-blue-900 mb-3">How It Works</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✓ All AI agents are <strong>automatically enabled</strong> when you create an account</li>
            <li>✓ Use this dashboard to <strong>opt-out</strong> of any agents you don't want</li>
            <li>✓ Changes save instantly to your account preferences</li>
            <li>✓ You can re-enable agents anytime</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}