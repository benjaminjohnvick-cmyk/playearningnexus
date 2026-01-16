import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  Save, 
  X, 
  Maximize, 
  Minimize, 
  RotateCcw,
  Cloud,
  Volume2,
  VolumeX,
  ShoppingCart,
  Eye,
  Zap,
  Trophy
} from 'lucide-react';
import InGameStore from './InGameStore';
import SpectateMode from './SpectateMode';
import ActiveEventsDisplay from '../events/ActiveEventsDisplay';
import ViewerMonetizationPanel from '../streaming/ViewerMonetizationPanel';
import InGameTournamentOverlay from '../tournaments/InGameTournamentOverlay';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function GameLauncher({ game, user, isOpen, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playtime, setPlaytime] = useState(0);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [showStore, setShowStore] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const gameContainerRef = useRef(null);
  const iframeRef = useRef(null);
  const playtimeIntervalRef = useRef(null);
  const queryClient = useQueryClient();

  // Fetch cloud saves
  const { data: cloudSaves = [] } = useQuery({
    queryKey: ['cloud-saves', game?.id, user?.id],
    queryFn: () => base44.entities.CloudSave.filter({
      game_id: game.id,
      user_id: user.id
    }, '-last_played'),
    enabled: !!game && !!user && isOpen
  });

  // Auto-save mutation
  const autoSaveMutation = useMutation({
    mutationFn: async (saveData) => {
      if (!cloudSaves || cloudSaves.length === 0) {
        return await base44.entities.CloudSave.create({
          user_id: user.id,
          game_id: game.id,
          save_name: 'Auto Save',
          save_data: saveData,
          platform: 'web',
          last_played: new Date().toISOString(),
          playtime_minutes: playtime,
          progress_percentage: saveData.progress || 0
        });
      } else {
        return await base44.entities.CloudSave.update(cloudSaves[0].id, {
          save_data: saveData,
          last_played: new Date().toISOString(),
          playtime_minutes: playtime,
          progress_percentage: saveData.progress || 0
        });
      }
    },
    onSuccess: () => {
      setLastSaveTime(new Date());
      queryClient.invalidateQueries(['cloud-saves']);
      toast.success('Game saved to cloud ☁️');
    }
  });

  // Track engagement
  const trackEngagementMutation = useMutation({
    mutationFn: async (sessionData) => {
      await base44.entities.GameEngagement.create({
        user_id: user.id,
        game_id: game.id,
        session_start: sessionData.start,
        session_end: sessionData.end,
        duration_minutes: Math.floor((sessionData.end - sessionData.start) / 60000),
        session_type: 'organic'
      });
    }
  });

  // Start playtime tracking
  useEffect(() => {
    if (isPlaying && isOpen) {
      playtimeIntervalRef.current = setInterval(() => {
        setPlaytime(prev => prev + 1);
      }, 60000); // Every minute
    } else {
      if (playtimeIntervalRef.current) {
        clearInterval(playtimeIntervalRef.current);
      }
    }

    return () => {
      if (playtimeIntervalRef.current) {
        clearInterval(playtimeIntervalRef.current);
      }
    };
  }, [isPlaying, isOpen]);

  // Handle close and save session
  const handleClose = () => {
    if (playtime > 0) {
      trackEngagementMutation.mutate({
        start: new Date(Date.now() - playtime * 60000),
        end: new Date()
      });
    }
    setIsPlaying(false);
    setPlaytime(0);
    onClose();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      gameContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Manual save
  const handleManualSave = () => {
    // In a real implementation, we'd get the game state from the iframe
    // For now, we'll save basic progress data
    autoSaveMutation.mutate({
      progress: Math.min(100, (playtime / 60) * 10), // Simulate progress
      level: Math.floor(playtime / 10),
      timestamp: Date.now()
    });
  };

  // Load save
  const handleLoadSave = async (save) => {
    setPlaytime(save.playtime_minutes || 0);
    toast.success('Save loaded!');
    // In a real implementation, we'd send the save data to the iframe
  };

  // Auto-save every 5 minutes
  useEffect(() => {
    if (isPlaying && playtime > 0 && playtime % 5 === 0) {
      handleManualSave();
    }
  }, [playtime]);

  if (!game || !user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl h-[90vh] p-0 overflow-hidden">
        <div ref={gameContainerRef} className="h-full flex flex-col bg-black">
          {/* Game Controls Bar */}
          <div className="bg-gray-900 text-white p-3 flex items-center justify-between border-b border-gray-700">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <img 
                  src={game.icon_url} 
                  alt={game.title}
                  className="w-8 h-8 rounded"
                />
                <div>
                  <h3 className="font-bold text-sm">{game.title}</h3>
                  <p className="text-xs text-gray-400">Playtime: {playtime}m</p>
                </div>
              </div>

              {lastSaveTime && (
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <Cloud className="w-3 h-3" />
                  Saved {Math.floor((Date.now() - lastSaveTime) / 1000)}s ago
                </div>
              )}

              <SpectateMode 
                game={game} 
                user={user} 
                onSpectatorUpdate={setSpectatorCount}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-white hover:bg-gray-800"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>

              {/* Save */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleManualSave}
                disabled={autoSaveMutation.isPending}
                className="text-white hover:bg-gray-800"
              >
                <Save className="w-4 h-4" />
              </Button>

              {/* Store */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowStore(!showStore)}
                className="text-white hover:bg-gray-800"
              >
                <ShoppingCart className="w-4 h-4" />
              </Button>

              {/* Mute */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsMuted(!isMuted)}
                className="text-white hover:bg-gray-800"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>

              {/* Fullscreen */}
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleFullscreen}
                className="text-white hover:bg-gray-800"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Button>

              {/* Close */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClose}
                className="text-white hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Game Area */}
          <div className="flex-1 flex">
            {/* Sidebar */}
            <div className="w-80 bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 overflow-y-auto">
              <div className="p-4">
                <Tabs defaultValue="saves" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-gray-800">
                    <TabsTrigger value="saves">Saves</TabsTrigger>
                    <TabsTrigger value="store">Store</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                  </TabsList>

                  <TabsContent value="saves" className="mt-4">
                    <div>
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Cloud Saves
              </h4>
              
              {cloudSaves.length > 0 ? (
                <div className="space-y-2">
                  {cloudSaves.map(save => (
                    <div
                      key={save.id}
                      className="p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                      onClick={() => handleLoadSave(save)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{save.save_name}</span>
                        <span className="text-xs text-gray-400">{save.progress_percentage}%</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {save.playtime_minutes}m played
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(save.last_played).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 text-center py-8">
                  <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No saves yet. Play to auto-save!
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-700">
                <h4 className="font-bold mb-2 text-sm">Cross-Platform</h4>
                <p className="text-xs text-gray-400">
                  Your saves sync across all devices automatically
                </p>
                <div className="flex gap-2 mt-3">
                  <div className="px-2 py-1 bg-blue-600 rounded text-xs">Web</div>
                  <div className="px-2 py-1 bg-gray-700 rounded text-xs">iOS</div>
                  <div className="px-2 py-1 bg-gray-700 rounded text-xs">Android</div>
                </div>
              </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="store" className="mt-4">
                    <InGameStore game={game} user={user} />
                  </TabsContent>

                  <TabsContent value="events" className="mt-4">
                    <ActiveEventsDisplay />
                  </TabsContent>
                </Tabs>

                {/* Tournament Quick Access */}
                <TournamentQuickAccess game={game} user={user} />
              </div>
            </div>

            {/* Game Canvas/Iframe */}
            <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
              {/* Tournament Overlay */}
              {isPlaying && <InGameTournamentOverlay game={game} user={user} />}

              {isPlaying ? (
                game.download_url ? (
                  <iframe
                    ref={iframeRef}
                    src={game.download_url}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="text-white text-center">
                    <div className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-bold mb-2">{game.title}</p>
                    <p className="text-sm text-gray-400 mb-4">Game Demo Area</p>
                    <p className="text-xs text-gray-500">
                      Developer: Upload your game to this URL to enable in-platform play
                    </p>
                  </div>
                )
              ) : (
                <div className="text-center">
                  <div className="mb-6">
                    <img 
                      src={game.icon_url} 
                      alt={game.title}
                      className="w-32 h-32 rounded-xl mx-auto shadow-2xl"
                    />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{game.title}</h2>
                  <p className="text-gray-400 mb-6 max-w-md mx-auto">{game.description}</p>
                  <Button
                    size="lg"
                    onClick={() => setIsPlaying(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Game
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TournamentQuickAccess({ game, user }) {
  const { data: gameTournaments = [] } = useQuery({
    queryKey: ['gameTournaments', game?.id],
    queryFn: () => base44.entities.Tournament.filter({
      game_id: game.id,
      status: 'registration'
    }, '-start_time', 3),
    enabled: !!game
  });

  if (gameTournaments.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-700">
      <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400" />
        Join Tournament
      </h4>
      <div className="space-y-2">
        {gameTournaments.map(tournament => (
          <div key={tournament.id} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <p className="text-xs font-semibold mb-1">{tournament.title}</p>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{tournament.current_participants}/{tournament.max_participants}</span>
              <Badge className="bg-purple-600 text-xs">
                {tournament.prize_pool_type === 'real_money' ? '$' : ''}{tournament.prize_pool_amount}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}