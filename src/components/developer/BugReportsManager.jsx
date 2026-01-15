import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bug, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

export default function BugReportsManager({ games }) {
  const [selectedBug, setSelectedBug] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: bugReports = [] } = useQuery({
    queryKey: ['bugReports', games.map(g => g.id)],
    queryFn: async () => {
      const gameIds = games.map(g => g.id);
      if (gameIds.length === 0) return [];
      const allBugs = await base44.entities.BugReport.list('-created_date');
      return allBugs.filter(b => gameIds.includes(b.game_id));
    },
    enabled: games.length > 0
  });

  const updateBugMutation = useMutation({
    mutationFn: async ({ bugId, data }) => {
      return await base44.entities.BugReport.update(bugId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugReports'] });
      toast.success('Bug report updated');
      setSelectedBug(null);
    }
  });

  const filteredBugs = statusFilter === 'all' 
    ? bugReports 
    : bugReports.filter(b => b.status === statusFilter);

  const statusCounts = {
    open: bugReports.filter(b => b.status === 'open').length,
    in_progress: bugReports.filter(b => b.status === 'in_progress').length,
    resolved: bugReports.filter(b => b.status === 'resolved').length
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => setStatusFilter('all')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Bug className="w-8 h-8 text-gray-600" />
              <div>
                <p className="text-2xl font-bold">{bugReports.length}</p>
                <p className="text-xs text-gray-600">Total Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => setStatusFilter('open')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.open}</p>
                <p className="text-xs text-gray-600">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => setStatusFilter('in_progress')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.in_progress}</p>
                <p className="text-xs text-gray-600">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => setStatusFilter('resolved')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.resolved}</p>
                <p className="text-xs text-gray-600">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bug List */}
      <div className="space-y-4">
        {filteredBugs.map((bug) => {
          const game = games.find(g => g.id === bug.game_id);
          return (
            <Card key={bug.id} className="cursor-pointer hover:shadow-lg transition-all" onClick={() => setSelectedBug(bug)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">{bug.title}</h3>
                      <Badge variant={
                        bug.severity === 'critical' ? 'destructive' :
                        bug.severity === 'high' ? 'default' : 'outline'
                      }>
                        {bug.severity}
                      </Badge>
                      <Badge variant="outline" className="capitalize">{bug.category}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{game?.title}</p>
                    <p className="text-sm text-gray-700 mb-3">{bug.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Reported {moment(bug.created_date).fromNow()}</span>
                      {bug.upvotes > 0 && <span>👍 {bug.upvotes} users affected</span>}
                      {bug.platform && <span className="capitalize">{bug.platform}</span>}
                    </div>
                  </div>
                  <Badge className={
                    bug.status === 'open' ? 'bg-red-600' :
                    bug.status === 'in_progress' ? 'bg-orange-600' :
                    bug.status === 'resolved' ? 'bg-green-600' : 'bg-gray-600'
                  }>
                    {bug.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredBugs.length === 0 && (
        <Card className="p-12 text-center">
          <Bug className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No bug reports in this category</p>
        </Card>
      )}

      {/* Bug Detail Modal */}
      {selectedBug && (
        <BugDetailModal
          bug={selectedBug}
          game={games.find(g => g.id === selectedBug.game_id)}
          onClose={() => setSelectedBug(null)}
          onUpdate={(data) => updateBugMutation.mutate({ bugId: selectedBug.id, data })}
        />
      )}
    </div>
  );
}

function BugDetailModal({ bug, game, onClose, onUpdate }) {
  const [status, setStatus] = useState(bug.status);
  const [notes, setNotes] = useState(bug.developer_notes || '');
  const [resolution, setResolution] = useState(bug.resolution || '');

  const handleSave = () => {
    onUpdate({ status, developer_notes: notes, resolution });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{bug.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Badge variant={bug.severity === 'critical' ? 'destructive' : 'default'}>
              {bug.severity}
            </Badge>
            <Badge variant="outline">{bug.category}</Badge>
            <Badge variant="outline">{game?.title}</Badge>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Description</p>
            <p className="text-sm text-gray-700">{bug.description}</p>
          </div>

          {bug.steps_to_reproduce && (
            <div>
              <p className="text-sm font-medium mb-1">Steps to Reproduce</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{bug.steps_to_reproduce}</p>
            </div>
          )}

          {bug.screenshot_url && (
            <div>
              <p className="text-sm font-medium mb-1">Screenshot</p>
              <img src={bug.screenshot_url} alt="Bug screenshot" className="rounded-lg max-w-full" />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="wont_fix">Won't Fix</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Developer Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Resolution</label>
            <Textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="How was this resolved?"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600">
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}