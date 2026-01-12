import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, CheckCircle2 } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function UserLicenseAgreement({ isOpen, onAccept, onDecline }) {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = async () => {
    if (!agreed) {
      toast.error('Please read and agree to the terms');
      return;
    }

    try {
      await base44.auth.updateMe({
        agreed_to_terms: true,
        signup_date: new Date().toISOString(),
        subscription_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      });
      onAccept();
    } catch (error) {
      toast.error('Failed to save agreement');
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <FileText className="w-6 h-6 text-blue-600" />
            User License Agreement
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-96 pr-4">
          <div className="space-y-4 text-sm">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <h3 className="font-bold text-lg mb-2">Platform Overview</h3>
              <p className="text-gray-700">
                Welcome to our mobile game discovery platform. By using this service, you agree to the following terms for a 1-year commitment with automatic renewal.
              </p>
            </Card>

            <div className="space-y-3">
              <h3 className="font-bold text-lg">1. Install Fee & Initial Period (Days 1-3)</h3>
              <p>You agree to pay a $6 install fee collected over the first 3 days ($2/day through survey completion). During this period, you must complete $2 worth of surveys daily before accessing games.</p>

              <h3 className="font-bold text-lg">2. Post-Installation Period (After Day 3)</h3>
              <p>After the 3-day install period, you will earn $1 per day from surveys, and the platform earns $1 per day. This continues for 1 year. Revenue from your surveys is split 50/50 between game developers and the platform.</p>

              <h3 className="font-bold text-lg">3. Daily Survey Requirement</h3>
              <p>You must complete $2 worth of surveys each day before accessing any games. This requirement is mandatory and part of the monetization model.</p>

              <h3 className="font-bold text-lg">4. Lockout Mode</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>Lockout mode activates daily after you play a featured game</li>
                <li>You can reschedule the lockout time once per day between 11:00 AM and 11:30 PM</li>
                <li>You cannot access apps until completing $2 in surveys</li>
                <li>Lockout applies across all your devices (phone, tablet, desktop)</li>
                <li>This lockout remains active for your entire 1-year subscription</li>
              </ul>

              <h3 className="font-bold text-lg">5. Featured Games & Library</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>Featured games change every 6 days (5 games per month, 60 per year)</li>
                <li>All users in your group see the same featured games</li>
                <li>After 6 days, featured games are added to your personal library</li>
                <li>You must play featured games and complete surveys to access your library</li>
                <li>You agree to try all games presented to you</li>
              </ul>

              <h3 className="font-bold text-lg">6. User Groups</h3>
              <p>You will be assigned to a user group of up to 100,000 users. Each group receives games in rotation every 6 days.</p>

              <h3 className="font-bold text-lg">7. Notifications</h3>
              <p>You will receive daily text messages when new featured games become available. By agreeing, you consent to receive SMS notifications.</p>

              <h3 className="font-bold text-lg">8. Subscription Terms</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>1-year commitment starting from signup date</li>
                <li>Automatic renewal after 365 days</li>
                <li>You may opt out only after completing the full 1-year period</li>
                <li>Failure to complete daily surveys may result in service restriction</li>
              </ul>

              <h3 className="font-bold text-lg">9. Revenue Sharing</h3>
              <p>Survey earnings are split: $1 to game developers, $1 to platform (after the initial $6 install fee is collected over 3 days).</p>

              <h3 className="font-bold text-lg">10. Contact & Referrals</h3>
              <p>You consent to the platform using your referral code to invite others. Marketing communications may be sent via email, SMS, and social media with your consent.</p>

              <h3 className="font-bold text-lg">11. Multi-Language & Currency</h3>
              <p>The platform automatically translates content and converts currency based on your preferences.</p>

              <h3 className="font-bold text-lg">12. Third-Party Surveys</h3>
              <p>We use third-party survey providers (including Pollfish) to generate revenue. By participating, you agree to their terms as well.</p>

              <h3 className="font-bold text-lg">13. Data Usage</h3>
              <p>We track your engagement, survey completion, and game usage to improve the platform and measure performance.</p>

              <h3 className="font-bold text-lg">14. Termination</h3>
              <p>We reserve the right to suspend or terminate accounts that violate these terms or fail to meet daily survey requirements.</p>
            </div>

            <Card className="p-4 bg-amber-50 border-amber-200">
              <h3 className="font-bold text-lg mb-2">Important Notes</h3>
              <ul className="space-y-1 text-gray-700">
                <li>• This is a legally binding 1-year agreement</li>
                <li>• You must be 18+ years old to agree</li>
                <li>• Daily survey completion is mandatory</li>
                <li>• Lockout mode cannot be disabled</li>
                <li>• Auto-renewal occurs after 365 days</li>
              </ul>
            </Card>
          </div>
        </ScrollArea>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-3">
            <Checkbox 
              id="agree" 
              checked={agreed} 
              onCheckedChange={setAgreed}
            />
            <label htmlFor="agree" className="text-sm font-medium cursor-pointer">
              I have read, understood, and agree to the User License Agreement including the 1-year commitment, daily survey requirements, lockout mode, and automatic renewal terms.
            </label>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleAccept}
              disabled={!agreed}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Accept & Continue
            </Button>
            <Button variant="outline" onClick={onDecline}>
              Decline
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}