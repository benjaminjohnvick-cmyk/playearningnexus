import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, DollarSign, Clock, Calendar } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function LockoutModal({ user, isOpen, onClose }) {
  const [canReschedule, setCanReschedule] = useState(true);
  const [newTime, setNewTime] = useState('');
  const [todaysEarnings, setTodaysEarnings] = useState(0);

  useEffect(() => {
    if (user) {
      setCanReschedule(!user.lockout_time_changed_today);
      // Check today's survey earnings
      checkTodaysEarnings();
    }
  }, [user]);

  const checkTodaysEarnings = async () => {
    const today = new Date().toISOString().split('T')[0];
    const surveys = await base44.entities.Survey.filter({
      user_id: user.id,
      completion_date: { $gte: today }
    });
    const earnings = surveys.reduce((sum, s) => sum + (s.earnings || 0), 0);
    setTodaysEarnings(earnings);
  };

  const handleReschedule = async () => {
    if (!newTime) {
      toast.error('Please select a new time');
      return;
    }

    try {
      await base44.auth.updateMe({
        lockout_time: newTime,
        lockout_time_changed_today: true
      });
      
      await base44.entities.LockoutSession.create({
        user_id: user.id,
        lockout_date: new Date().toISOString().split('T')[0],
        scheduled_lockout_time: newTime,
        rescheduled: true
      });

      toast.success(`Lockout rescheduled to ${newTime}`);
      onClose();
    } catch (error) {
      toast.error('Failed to reschedule');
    }
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 11; hour <= 23; hour++) {
      for (let min = 0; min < 60; min += 30) {
        if (hour === 23 && min > 30) break;
        const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        times.push(time);
      }
    }
    return times;
  };

  const needsToEarn = 3 - todaysEarnings;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Lock className="w-6 h-6 text-amber-600" />
            Survey Requirement
          </DialogTitle>
          <DialogDescription>
            Complete surveys to continue accessing games
          </DialogDescription>
        </DialogHeader>

        <Card className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200">
          <div className="flex items-start gap-4">
            <DollarSign className="w-12 h-12 text-amber-600" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Please complete ${needsToEarn.toFixed(2)} worth of surveys
              </h3>
              <p className="text-gray-700 mb-3">
                This is how this site and its partners earn money. All profit is shared 50/50 with game developers.
              </p>
              <div className="bg-white rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Today's Earnings:</span>
                  <span className="font-bold text-green-600">${todaysEarnings.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Required:</span>
                  <span className="font-bold">$3.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining:</span>
                  <span className="font-bold text-amber-600">${needsToEarn.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {canReschedule && (
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-blue-600 mt-1" />
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-2">Reschedule Lockout Time (Once Per Day)</h4>
                <p className="text-sm text-gray-700 mb-3">
                  Choose a different time for today's lockout between 11:00 AM and 11:30 PM
                </p>
                <div className="flex gap-3 items-center">
                  <Select value={newTime} onValueChange={setNewTime}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeOptions().map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleReschedule} variant="outline">
                    <Calendar className="w-4 h-4 mr-2" />
                    Reschedule
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-bold text-gray-900 mb-2">Important Information:</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• You cannot access apps until you've earned $3 from surveys today</li>
            <li>• This lockout activates daily at your scheduled time</li>
            <li>• This is part of your 1-year user agreement</li>
            <li>• After completing surveys, you can play all games in your library</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={() => window.location.href = '/Surveys'} 
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
          >
            Complete Surveys Now
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}