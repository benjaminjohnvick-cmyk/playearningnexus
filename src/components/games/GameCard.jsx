import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Download, Calendar, Play, Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";
import GameLauncher from './GameLauncher';
import { base44 } from '@/api/base44Client';

export default function GameCard({ game, onInstall, showFeaturedBadge = false, enableLauncher = false }) {
  const [showLauncher, setShowLauncher] = useState(false);
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    if (enableLauncher) {
      fetchUser();
    }
  }, [enableLauncher]);

  return (
    <>
      {enableLauncher && <GameLauncher game={game} user={user} isOpen={showLauncher} onClose={() => setShowLauncher(false)} />}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3 }}
      >
      <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all">
        <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100">
          {game.icon_url ? (
            <img src={game.icon_url} alt={game.title} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Gamepad2 className="w-24 h-24 text-gray-400" />
            </div>
          )}
          {showFeaturedBadge && (
            <Badge className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
Featured
            </Badge>
          )}
        </div>
        
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg text-gray-900 mb-1">{game.title}</h3>
              <Badge variant="outline" className="text-xs">{game.category || 'Game'}</Badge>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {game.description || 'An exciting new game experience awaits you!'}
          </p>
          
          <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="font-medium">{game.average_rating?.toFixed(1) || '0.0'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              <span>{game.total_installs || 0}</span>
            </div>
          </div>
          
          {enableLauncher ? (
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowLauncher(true)}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Play Now
              </Button>
              <Button 
                onClick={() => onInstall(game)} 
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Install
              </Button>
            </div>
          ) : (
            <Button 
              onClick={() => onInstall(game)} 
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              Install Game
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
    </>
  );
}