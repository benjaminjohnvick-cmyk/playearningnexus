import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Users, DollarSign, Calendar, Gamepad2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function TournamentCard({ tournament, onJoin, isRegistered }) {
  const registrationOpen = new Date() < new Date(tournament.registration_ends);
  const tournamentsStartsSoon = new Date(tournament.tournament_starts) - new Date() < 3600000;

  const statusColors = {
    upcoming: 'bg-blue-100 text-blue-800 border-blue-300',
    registration_open: 'bg-green-100 text-green-800 border-green-300',
    in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
    completed: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full border-2 border-purple-200 hover:shadow-xl transition-shadow bg-gradient-to-br from-purple-50 to-white">
        <CardHeader>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <CardTitle className="text-lg line-clamp-2">{tournament.tournament_name}</CardTitle>
              <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                <Gamepad2 className="w-3 h-3" />
                {tournament.game_title}
              </p>
            </div>
            <Badge className={`text-xs border whitespace-nowrap ${statusColors[tournament.status]}`}>
              {tournament.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-sm text-gray-700 line-clamp-2">{tournament.description}</p>

          {/* Prize Pool */}
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-2 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-bold text-yellow-900">Prize Pool</span>
              </div>
              <span className="text-lg font-bold text-yellow-700">${tournament.total_prize_pool.toFixed(0)}</span>
            </div>
          </div>

          {/* Participants */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-gray-600">
              <Users className="w-4 h-4" />
              <span>{tournament.current_participants}/{tournament.max_participants}</span>
            </div>
            <div className="text-right">
              {tournament.entry_fee > 0 && (
                <span className="text-sm text-gray-600">Entry: ${tournament.entry_fee.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Starts: {new Date(tournament.tournament_starts).toLocaleDateString()}
            </span>
          </div>

          {/* Action Button */}
          <div className="flex gap-2 pt-2">
            <Link to={createPageUrl('TournamentDetails')} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                View Details
              </Button>
            </Link>
            {registrationOpen && !isRegistered && (
              <Button
                size="sm"
                onClick={onJoin}
                className={`flex-1 ${tournamentsStartsSoon ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
              >
                {tournamentsStartsSoon ? '⚡ Join Fast!' : 'Join Tournament'}
              </Button>
            )}
            {isRegistered && (
              <Badge className="bg-green-600 text-white">Registered</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}