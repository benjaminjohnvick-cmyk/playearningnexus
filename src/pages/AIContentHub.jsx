import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BarChart3, Globe, Mic, Download, AlertCircle, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AIContentHub() {
  const [activeTab, setActiveTab] = useState('surveys');
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  const { data: surveys } = useQuery({
    queryKey: ['aiSurveys'],
    queryFn: () => base44.entities.DailyAISurvey.filter({ status: 'voting' }),
    enabled: !!user
  });

  const { data: earnings } = useQuery({
    queryKey: ['earningsMonitor'],
    queryFn: () => base44.entities.AIEarningsMonitor.filter({ user_id: user?.id }),
    enabled: !!user
  });

  const publishProductMutation = useMutation({
    mutationFn: (surveyId) => base44.functions.invoke('publishWinningSurveyProduct', { survey_id: surveyId })
  });

  const downloadDataMutation = useMutation({
    mutationFn: () => base44.functions.invoke('exportAIData', { data_type: 'all' })
  });

  const tabs = [
    { id: 'surveys', label: '📊 Daily Surveys', icon: BarChart3 },
    { id: 'earnings', label: '💰 Earnings Monitor', icon: AlertCircle },
    { id: 'translations', label: '🌍 Translations', icon: Globe },
    { id: 'ux', label: '👁️ UX Analytics', icon: Eye },
    { id: 'voice', label: '🎤 Voice Mode', icon: Mic },
    { id: 'data', label: '📥 Data Export', icon: Download }
  ];

  if (!user) return <div>Sign in to access AI Hub</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-white mb-2">AI Content Hub</h1>
          <p className="text-purple-200">Auto-generate surveys, monitor earnings, translate content, record UX & more</p>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-3 rounded-lg font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="text-xl mb-1">{tab.label.split(' ')[0]}</div>
              <div className="text-xs">{tab.label.split(' ').slice(1).join(' ')}</div>
            </button>
          ))}
        </div>

        {/* Content Sections */}
        {activeTab === 'surveys' && <DailySurveysSection surveys={surveys} onPublish={publishProductMutation} />}
        {activeTab === 'earnings' && <EarningsMonitorSection earnings={earnings} user={user} />}
        {activeTab === 'translations' && <TranslationSection />}
        {activeTab === 'ux' && <UXAnalyticsSection />}
        {activeTab === 'voice' && <VoiceModeSection />}
        {activeTab === 'data' && <DataExportSection onDownload={downloadDataMutation} />}
      </div>
    </div>
  );
}

function DailySurveysSection({ surveys, onPublish }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Today's AI-Generated Survey</h2>
      {surveys?.map(survey => (
        <Card key={survey.id} className="bg-gray-800 p-6 border-purple-500/50">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">Vote on Top Digital Products</h3>
            <div className="grid gap-3">
              {survey.products?.map((p, i) => (
                <div key={i} className="bg-gray-700 p-4 rounded">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-white">{p.product_name}</h4>
                      <p className="text-sm text-gray-400">{p.description}</p>
                    </div>
                    <Badge className="bg-purple-600">{p.votes} votes</Badge>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              onClick={() => onPublish.mutate(survey.id)}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              disabled={onPublish.isPending}
            >
              {onPublish.isPending ? 'Publishing...' : 'Publish Winning Product'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EarningsMonitorSection({ earnings, user }) {
  const monitorData = earnings?.[0];
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="bg-gray-800 p-6 border-green-500/50">
        <h3 className="text-xl font-bold text-green-400 mb-4">Total Earned</h3>
        <p className="text-5xl font-black text-white">${monitorData?.total_earned || user?.total_earnings || 0}</p>
      </Card>
      <Card className="bg-gray-800 p-6 border-red-500/50">
        <h3 className="text-xl font-bold text-red-400 mb-4">Total Owed to Users</h3>
        <p className="text-5xl font-black text-white">${monitorData?.total_owed || 0}</p>
      </Card>
      <Card className="bg-gray-800 p-6 border-yellow-500/50 md:col-span-2">
        <h3 className="text-lg font-bold text-yellow-400 mb-4">Daily Breakdown</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {Object.entries(monitorData?.daily_breakdown || {}).map(([date, amount]) => (
            <div key={date} className="flex justify-between text-sm text-gray-300">
              <span>{new Date(date).toLocaleDateString()}</span>
              <span className="font-bold text-green-400">${amount}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TranslationSection() {
  const languages = [
    'Africa (Swahili)', 'Middle East (Arabic)', 'China (Mandarin)', 
    'India (Hindi)', 'Bangladesh (Bengali)', 'Russia (Russian)',
    'Mexico (Spanish)', 'Indonesia (Indonesian)', 'Pakistan (Urdu)',
    'Nigeria (Yoruba)', 'Brazil (Portuguese)', 'Ethiopia (Amharic)'
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Multilingual Translation</h2>
      <p className="text-gray-300">Auto-translates surveys & social ads to 12 regions</p>
      <div className="grid md:grid-cols-3 gap-4">
        {languages.map((lang, i) => (
          <Card key={i} className="bg-gray-800 p-4 border-blue-500/50 hover:border-blue-500 cursor-pointer">
            <p className="text-white font-bold text-center">{lang}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function UXAnalyticsSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">UX Session Recording & Analysis</h2>
      <Card className="bg-gray-800 p-6 border-cyan-500/50">
        <p className="text-gray-300 mb-4">Records all user sessions to identify:</p>
        <ul className="space-y-2 text-gray-300">
          <li>✓ Conversion drop-off points</li>
          <li>✓ Premium upgrade blockers</li>
          <li>✓ Referral form friction</li>
          <li>✓ Page load performance issues</li>
        </ul>
      </Card>
    </div>
  );
}

function VoiceModeSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Voice Mode (On-The-Go)</h2>
      <Card className="bg-gray-800 p-6 border-yellow-500/50">
        <p className="text-gray-300 mb-4">Features:</p>
        <ul className="space-y-2 text-gray-300">
          <li>🎤 Listen to & answer surveys by voice</li>
          <li>🎤 Voice-based site navigation</li>
          <li>🔊 Site reads aloud during navigation</li>
          <li>⚡ Perfect for on-the-go earning</li>
        </ul>
        <Button className="mt-4 w-full bg-gradient-to-r from-yellow-600 to-orange-600">
          Enable Voice Mode
        </Button>
      </Card>
    </div>
  );
}

function DataExportSection({ onDownload }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Data Export & Analytics</h2>
      <Card className="bg-gray-800 p-6 border-green-500/50">
        <p className="text-gray-300 mb-4">One-click download includes:</p>
        <ul className="space-y-2 text-gray-300 mb-6">
          <li>✓ All survey responses</li>
          <li>✓ Product performance data</li>
          <li>✓ Ad network impressions & clicks</li>
          <li>✓ User profiles & activity logs</li>
          <li>✓ Categorized by date & type</li>
        </ul>
        <Button 
          onClick={() => onDownload.mutate()}
          disabled={onDownload.isPending}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
        >
          {onDownload.isPending ? 'Preparing...' : '⬇️ Download All Data'}
        </Button>
      </Card>
    </div>
  );
}