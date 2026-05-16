import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, MessageSquare, Wand2, Gamepad2, Lock, FlaskConical, Bot } from 'lucide-react';
import SurveyHeatmapDashboard from '@/components/developer/SurveyHeatmapDashboard';
import AIFeedbackSurveyBuilder from '@/components/developer/AIFeedbackSurveyBuilder';
import AIGameCreator from '@/components/developer/AIGameCreator';
import GameABTestSuite from '@/components/developer/GameABTestSuite';
import AutoGameFeedbackEngine from '@/components/developer/AutoGameFeedbackEngine';

export default function DeveloperToolsHub() {
  const [user, setUser] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        // Fetch developer's games
        const clients = await base44.entities.BusinessClient.filter({ owner_user_id: u.id });
        if (clients.length > 0) {
          const devGames = await base44.entities.Game.filter({ developer_id: clients[0].id });
          setGames(devGames);
          if (devGames.length > 0) setSelectedGameId(devGames[0].id);
        }
      } catch (_) {}
      setLoading(false);
    };
    init();
  }, []);

  const selectedGame = games.find(g => g.id === selectedGameId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <Lock className="w-10 h-10 text-gray-400" />
        <p className="text-gray-600">Please sign in to access Developer Tools.</p>
        <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-700 rounded-xl flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">Developer Tools Hub</h1>
              <p className="text-xs text-gray-500">AI-powered tools to analyze, improve, and create games — all free.</p>
            </div>
            <Badge className="ml-auto bg-green-100 text-green-700 border border-green-200">🆓 Free Forever</Badge>
          </div>

          {/* Game selector */}
          {games.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <p className="text-xs text-gray-600 font-medium">Analyzing:</p>
              <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Select game" />
                </SelectTrigger>
                <SelectContent>
                  {games.map(g => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Feature cards row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { icon: Activity, title: 'UX Heatmaps', desc: 'Session drop-off', color: 'from-blue-500 to-indigo-600' },
            { icon: MessageSquare, title: 'Feedback Surveys', desc: 'AI-generated', color: 'from-emerald-500 to-teal-600' },
            { icon: Wand2, title: 'AI Game Creator', desc: 'Build from feedback', color: 'from-violet-500 to-purple-600' },
            { icon: FlaskConical, title: 'A/B Testing', desc: 'Auto variant testing', color: 'from-orange-500 to-red-500' },
            { icon: Bot, title: 'Auto Feedback', desc: 'Runs automatically', color: 'from-teal-500 to-green-600' },
          ].map(f => (
            <Card key={f.title} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center flex-shrink-0`}>
                  <f.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">{f.title}</p>
                  <p className="text-[10px] text-gray-500">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main tabs */}
        <Tabs defaultValue="creator">
          <TabsList className="w-full mb-4 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="heatmap" className="flex-1 text-xs gap-1">
              <Activity className="w-3.5 h-3.5" /> UX Heatmap
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex-1 text-xs gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> Feedback Survey
            </TabsTrigger>
            <TabsTrigger value="creator" className="flex-1 text-xs gap-1">
              <Wand2 className="w-3.5 h-3.5" /> AI Game Creator
            </TabsTrigger>
            <TabsTrigger value="abtest" className="flex-1 text-xs gap-1">
              <FlaskConical className="w-3.5 h-3.5" /> A/B Testing
            </TabsTrigger>
            <TabsTrigger value="autofeedback" className="flex-1 text-xs gap-1">
              <Bot className="w-3.5 h-3.5" /> Auto Feedback
            </TabsTrigger>
          </TabsList>

          <TabsContent value="heatmap">
            <SurveyHeatmapDashboard
              surveyId={selectedGame?.concept_survey_id}
              gameTitle={selectedGame?.title}
            />
          </TabsContent>

          <TabsContent value="feedback">
            <AIFeedbackSurveyBuilder
              gameId={selectedGameId}
              gameTitle={selectedGame?.title || 'My Game'}
              gameCategory={selectedGame?.category || 'casual'}
            />
          </TabsContent>

          <TabsContent value="creator">
            <AIGameCreator />
          </TabsContent>

          <TabsContent value="abtest">
            <GameABTestSuite
              gameId={selectedGameId}
              gameTitle={selectedGame?.title || 'Selected Game'}
            />
          </TabsContent>

          <TabsContent value="autofeedback">
            <AutoGameFeedbackEngine games={games} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}