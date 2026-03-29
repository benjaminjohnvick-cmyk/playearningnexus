import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Users, DollarSign, AlertCircle, CheckCircle2, Info, X, Plus, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import PayPalCardCapture from './PayPalCardCapture';

const INDIVIDUAL_CREDIT = 1080;
const MAX_GROUP = 10;
const DAILY_EARN_PER_PERSON = 3;
const MONTHS = 12;

export default function BNPLModal({ isOpen, onClose, user, purchaseAmount }) {
  const [step, setStep] = useState('overview'); // overview | group | card | confirm
  const [groupMembers, setGroupMembers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [paypalOrderId, setPaypalOrderId] = useState(null);
  const [saving, setSaving] = useState(false);

  const groupSize = groupMembers.length + 1; // +1 for primary user
  const totalCredit = groupSize * INDIVIDUAL_CREDIT;
  const monthlyGroupEarn = groupSize * DAILY_EARN_PER_PERSON * 30;
  const dailyGroupEarn = groupSize * DAILY_EARN_PER_PERSON;

  const addMember = () => {
    if (!newEmail || !newEmail.includes('@')) { toast.error('Enter a valid email'); return; }
    if (groupMembers.length >= MAX_GROUP - 1) { toast.error(`Max ${MAX_GROUP} people per group`); return; }
    if (groupMembers.includes(newEmail)) { toast.error('Already added'); return; }
    setGroupMembers(prev => [...prev, newEmail]);
    setNewEmail('');
  };

  const handleActivate = async (ppOrderId) => {
    setSaving(true);
    try {
      // Save BNPL credit to user — issued as site credit
      await base44.auth.updateMe({
        bnpl_credit_limit: totalCredit,
        bnpl_group_size: groupSize,
        bnpl_group_members: groupMembers,
        bnpl_active: true,
        // Add credit to balance so they can use it site-wide
        current_balance: (user?.current_balance || 0) + totalCredit,
      });
      toast.success(`🎉 $${totalCredit.toLocaleString()} credit activated! Credited to your account.`);
      setStep('overview');
      onClose();
    } catch {
      toast.error('Failed to activate BNPL');
    }
    setSaving(false);
  };

  const alreadyActive = user?.bnpl_active;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Buy Now, Pay with Surveys
          </DialogTitle>
        </DialogHeader>

        {alreadyActive ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">BNPL Credit Active!</p>
                <p className="text-sm text-green-700">Credit limit: <span className="font-bold">${(user?.bnpl_credit_limit || INDIVIDUAL_CREDIT).toLocaleString()}</span></p>
                <p className="text-sm text-green-700">Group size: {user?.bnpl_group_size || 1} member{(user?.bnpl_group_size || 1) > 1 ? 's' : ''}</p>
              </div>
            </div>
            <Button className="w-full" onClick={onClose}>Close</Button>
          </div>
        ) : step === 'overview' ? (
          <div className="space-y-5">
            {/* Hero */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white">
              <p className="text-3xl font-bold mb-1">$1,080 <span className="text-blue-200 text-lg font-normal">per person</span></p>
              <p className="text-blue-100 text-sm">Instant site credit · Paid back by earning $3/day through surveys</p>
            </div>

            {/* How it works */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Info className="w-4 h-4 text-blue-600" /> How It Works</h3>
              {[
                { icon: '💳', title: '$1,080 per person credit', desc: `You're automatically issued $1,080 in site credit — yours to spend on anything on GamerGain.` },
                { icon: '💰', title: 'Pay it back by earning', desc: `Earn $3/day completing surveys. That's $90/month — paid off in 12 months automatically.` },
                { icon: '👨‍👩‍👧‍👦', title: 'Grow with a group', desc: `Add up to 9 friends or family. Each adds $1,080 to your shared credit pool (up to $10,800 for 10 people).` },
                { icon: '⚠️', title: 'Missed day penalty', desc: `If a group member misses their $3/day, your card on file is charged the shortfall (e.g., 10 people miss = $30 charge).` },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Example */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4 space-y-2 text-sm">
                <p className="font-semibold text-blue-800">📊 Example: Group of 10</p>
                <div className="grid grid-cols-2 gap-2 text-blue-900">
                  <div><span className="text-blue-600">Credit Line:</span> <strong>$10,800</strong></div>
                  <div><span className="text-blue-600">Daily earn needed:</span> <strong>$30/day</strong></div>
                  <div><span className="text-blue-600">Monthly payback:</span> <strong>$900/mo</strong></div>
                  <div><span className="text-blue-600">Missed day charge:</span> <strong>$30 on card</strong></div>
                </div>
              </CardContent>
            </Card>

            {purchaseAmount && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                <strong>Your purchase of ${purchaseAmount.toFixed(2)}</strong> will be fully covered by your BNPL credit once activated.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">Maybe Later</Button>
              <Button onClick={() => setStep('group')} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Users className="w-4 h-4 mr-2" /> Get Started
              </Button>
            </div>
          </div>

        ) : step === 'group' ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Add Group Members (optional)</h3>
              <p className="text-xs text-gray-500">Each member adds $1,080 to your credit pool. You can skip this and get your $1,080 solo credit.</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 font-medium">
              Current group: <strong>{groupSize} person{groupSize > 1 ? 's' : ''}</strong> → Credit: <strong>${(groupSize * INDIVIDUAL_CREDIT).toLocaleString()}</strong> · Daily earn needed: <strong>${dailyGroupEarn}/day</strong>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="friend@email.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMember()}
              />
              <Button onClick={addMember} variant="outline" size="icon"><Plus className="w-4 h-4" /></Button>
            </div>

            {groupMembers.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>{user?.email || 'You'} <Badge variant="outline" className="text-xs ml-1">Primary</Badge></span>
                </div>
                {groupMembers.map((email, i) => (
                  <div key={i} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-blue-400" /> {email}</span>
                    <button onClick={() => setGroupMembers(prev => prev.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('overview')} className="flex-1">Back</Button>
              <Button onClick={() => setStep('card')} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <CreditCard className="w-4 h-4 mr-2" /> Add Card & Activate
              </Button>
            </div>
          </div>

        ) : step === 'card' ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Backup Payment Card</h3>
              <p className="text-xs text-gray-500">Only charged if a group member misses their daily $3 earning. Required to activate BNPL credit.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">Your card is charged <strong>${DAILY_EARN_PER_PERSON} per person per missed day</strong>. For {groupSize} people, that's up to <strong>${groupSize * DAILY_EARN_PER_PERSON}/day</strong> if everyone misses.</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1 text-sm">
              <p className="font-semibold text-blue-800">Activating for {groupSize} member{groupSize > 1 ? 's' : ''}:</p>
              <p className="text-blue-700">✅ <strong>${(groupSize * INDIVIDUAL_CREDIT).toLocaleString()}</strong> added to your account balance</p>
              <p className="text-blue-700">📅 Pay back at <strong>${dailyGroupEarn}/day</strong> through survey earnings</p>
              <p className="text-blue-700">🔒 Card backup: <strong>${DAILY_EARN_PER_PERSON} × {groupSize} per missed day</strong></p>
            </div>

            <PayPalCardCapture
              onSuccess={(cardData) => handleActivate(cardData.paypalOrderId)}
              onCancel={() => setStep('group')}
              label={`Activate $${(groupSize * INDIVIDUAL_CREDIT).toLocaleString()} Credit`}
              amount="1.00"
            />
            {saving && <p className="text-xs text-center text-blue-600">Activating your credit...</p>}

            <Button variant="outline" onClick={() => setStep('group')} className="w-full">Back</Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}