import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Download, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function GameCard({ game, onInstall, showFeaturedBadge = false }) {
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
            <div className="flex items-center justify-center h-full text-6xl">🎮</div>
          )}
          {showFeaturedBadge && (
            <Badge className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              ⭐ Featured
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
          
          <Button 
            onClick={() => onInstall(game)} 
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            Install Game
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}