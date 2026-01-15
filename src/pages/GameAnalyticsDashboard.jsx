import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BarChart3, Activity, Users, FlaskConical, Bug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DeveloperGameAnalytics from '../components/analytics/DeveloperGameAnalytics';
import EngagementAnalytics from '../components/developer/EngagementAnalytics';
import PlayerDemographics from '../components/developer/PlayerDemographics';
import ABTestingTools from '../components/developer/ABTestingTools';
import BugReportsManager from '../components/developer/BugReportsManager';

export default function GameAnalyticsDashboard() {
  const [user, setUser] = useState(null);
  const [businessClient, setBusinessClient] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const clients = await base44.entities.BusinessClient.filter({ owner_user_id: currentUser.id });
      if (clients.length > 0) setBusinessClient(clients[0]);
    };
    fetchData();
  }, []);

  const { data: games = [] } = useQuery({
    queryKey: ['developerGames', businessClient?.id],
    queryFn: () => base44.entities.Game.filter({ developer_id: businessClient.id }),
    enabled: !!businessClient
  });

  if (!user || !businessClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link to={createPageUrl('BusinessDashboard')}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-10 h-10 text-red-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
              Game Analytics
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Track performance and AI-driven insights for your games</p>
        </div>

        {games.length === 0 ? (
          <Card className="p-12 text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-bold mb-2">No Games Yet</h3>
            <p className="text-gray-600 mb-6">Submit your first game to start tracking analytics</p>
            <Link to={createPageUrl('BusinessDashboard')}>
              <Button className="bg-gradient-to-r from-red-600 to-red-700">
                Upload Game
              </Button>
            </Link>
          </Card>
        ) : (
          <Tabs defaultValue={games[0]?.id}>
            <TabsList className="mb-6 flex-wrap">
              {games.map(game => (
                <TabsTrigger key={game.id} value={game.id}>
                  {game.title}
                </TabsTrigger>
              ))}
              <TabsTrigger value="ab-testing">
                <FlaskConical className="w-4 h-4 mr-2" />
                A/B Testing
              </TabsTrigger>
              <TabsTrigger value="bug-reports">
                <Bug className="w-4 h-4 mr-2" />
                Bug Reports
              </TabsTrigger>
            </TabsList>

            {games.map(game => (
              <TabsContent key={game.id} value={game.id}>
                <Tabs defaultValue="overview">
                  <TabsList className="mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="engagement">
                      <Activity className="w-4 h-4 mr-2" />
                      Engagement
                    </TabsTrigger>
                    <TabsTrigger value="demographics">
                      <Users className="w-4 h-4 mr-2" />
                      Demographics
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <DeveloperGameAnalytics game={game} developerId={businessClient.id} />
                  </TabsContent>

                  <TabsContent value="engagement">
                    <EngagementAnalytics game={game} />
                  </TabsContent>

                  <TabsContent value="demographics">
                    <PlayerDemographics game={game} />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            ))}

            <TabsContent value="ab-testing">
              <ABTestingTools businessClient={businessClient} games={games} />
            </TabsContent>

            <TabsContent value="bug-reports">
              <BugReportsManager games={games} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}