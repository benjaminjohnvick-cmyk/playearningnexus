import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bug } from 'lucide-react';
import { toast } from 'sonner';

export default function BugReportButton({ game }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium',
    category: 'other',
    platform: '',
    steps_to_reproduce: ''
  });
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.BugReport.create({
        game_id: game.id,
        reporter_user_id: user.id,
        ...formData
      });
    },
    onSuccess: () => {
      toast.success('Bug report submitted! The developer will review it soon.');
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        severity: 'medium',
        category: 'other',
        platform: '',
        steps_to_reproduce: ''
      });
      queryClient.invalidateQueries({ queryKey: ['bugReports'] });
    },
    onError: () => {
      toast.error('Failed to submit bug report');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    submitMutation.mutate();
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setShowForm(true)}
        className="border-red-200 text-red-600 hover:bg-red-50"
      >
        <Bug className="w-4 h-4 mr-2" />
        Report a Bug
      </Button>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report a Bug</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Bug Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Brief description of the issue"
                required
              />
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Detailed description of what happened..."
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severity</Label>
                <Select value={formData.severity} onValueChange={(value) => setFormData({...formData, severity: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crash">Crash</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="ui">UI Issue</SelectItem>
                    <SelectItem value="gameplay">Gameplay</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Platform</Label>
              <Select value={formData.platform} onValueChange={(value) => setFormData({...formData, platform: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="ios">iOS</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Steps to Reproduce</Label>
              <Textarea
                value={formData.steps_to_reproduce}
                onChange={(e) => setFormData({...formData, steps_to_reproduce: e.target.value})}
                placeholder="1. Go to...\n2. Click on...\n3. See error"
                rows={4}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitMutation.isPending}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}