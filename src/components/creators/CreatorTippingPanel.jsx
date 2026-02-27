import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Heart, DollarSign, Zap, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const PRESET_AMOUNTS = [1, 3, 5, 10, 25, 50];

export default function CreatorTippingPanel({ user }) {
  const [customAmount, setCustomAmount] = useState('');
  const [selected, setSelected] = useState(5);
  const [tipMessage, setTipMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const tipAmount = customAmount ? parseFloat(customAmount) : selected;
  const tipLink = `${window.location.origin}?tip=${user?.id}`;

  const copyTipLink = () => {
    navigator.clipboard.writeText(tipLink);
    toast.success('Tip link copied!');
  };

  const handleSendTip = async () => {
    if (!tipAmount || tipAmount <= 0) return toast.error('Invalid amount');
    setLoading(true);
    try {
      await base44.entities.StreamerTip.create({
        streamer_user_id: user?.id,
        amount: tipAmount,
        message: tipMessage,
        currency: 'USD',
        status: 'completed',
      });
      toast.success(`Tip of $${tipAmount} sent!`);
      setTipMessage('');
      setCustomAmount('');
    } catch (e) {
      toast.error('Failed to send tip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-500" />
          Tipping Options
          <Badge className="bg-pink-100 text-pink-700 text-xs ml-auto">Earn 90%</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">Your Tip Link</p>
          <div className="flex gap-2">
            <Input readOnly value={tipLink} className="bg-gray-50 text-xs font-mono flex-1" />
            <Button size="sm" variant="outline" onClick={copyTipLink}><Copy className="w-3.5 h-3.5" /></Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Share this link so fans can tip you directly</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">Quick Tip Amounts</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.map(amt => (
              <button
                key={amt}
                onClick={() => { setSelected(amt); setCustomAmount(''); }}
                className={`p-2 rounded-lg border text-sm font-semibold transition-all ${
                  selected === amt && !customAmount
                    ? 'bg-pink-600 text-white border-pink-600'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-pink-300'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1 font-medium">Custom Amount</p>
          <Input
            type="number"
            placeholder="Enter amount..."
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
            className="text-sm"
          />
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1 font-medium">Tip Message (optional)</p>
          <Input
            placeholder="Say something nice..."
            value={tipMessage}
            onChange={e => setTipMessage(e.target.value)}
            className="text-sm"
          />
        </div>

        <div className="bg-pink-50 rounded-lg p-3 text-xs text-gray-600">
          <p className="font-medium text-pink-700 mb-1">Revenue Split</p>
          <div className="flex justify-between"><span>Your earnings (90%)</span><span className="font-bold text-green-600">${(tipAmount * 0.9).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Platform fee (10%)</span><span>${(tipAmount * 0.1).toFixed(2)}</span></div>
        </div>

        <Button onClick={handleSendTip} disabled={loading} className="w-full bg-pink-600 hover:bg-pink-700">
          <Zap className="w-4 h-4 mr-2" />
          {loading ? 'Sending...' : `Send $${tipAmount || 0} Tip`}
        </Button>
      </CardContent>
    </Card>
  );
}