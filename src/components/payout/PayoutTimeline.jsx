import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, RefreshCw, XCircle, DollarSign, Zap } from 'lucide-react';
import { format, formatDistanceToNow, addBusinessDays } from 'date-fns';

const STATUS_CFG = {
  pending:    { icon: Clock,        color: 'text-amber-500',  line: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-800',  label: 'Pending' },
  processing: { icon: RefreshCw,    color: 'text-blue-500',   line: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-800',    label: 'Processing' },
  completed:  { icon: CheckCircle2, color: 'text-green-500',  line: 'bg-green-500',  badge: 'bg-green-100 text-green-800',  label: 'Completed' },
  failed:     { icon: XCircle,      color: 'text-red-500',    line: 'bg-red-400',    badge: 'bg-red-100 text-red-800',      label: 'Failed' },
};

const METHOD_ETA = {
  paypal:  { label: 'PayPal',        eta: '1–3 hours',        business_days: 0 },
  venmo:   { label: 'Venmo',         eta: 'up to 24 hours',   business_days: 1 },
  cashapp: { label: 'Cash App',      eta: '~30 minutes',      business_days: 0 },
  bank:    { label: 'Bank Transfer', eta: '1–3 business days',business_days: 3 },
};

function EstimatedArrival({ payout }) {
  if (payout.status === 'completed') {
    return <span className="text-green-600 font-medium text-xs">✅ Arrived {payout.completed_date ? format(new Date(payout.completed_date), 'MMM d') : ''}</span>;
  }
  if (payout.status === 'failed') {
    return <span className="text-red-500 text-xs">❌ Failed — {payout.error_message || 'Contact support'}</span>;
  }
  const method = METHOD_ETA[payout.method] || METHOD_ETA.paypal;
  const createdAt = new Date(payout.created_date);
  const estDate = addBusinessDays(createdAt, method.business_days);
  return (
    <span className="text-gray-500 text-xs flex items-center gap-1">
      <Zap className="w-3 h-3 text-amber-400" />
      Est. arrival: <strong className="text-gray-700">{method.eta}</strong>
      {method.business_days > 0 && <span className="text-gray-400">(by {format(estDate, 'MMM d')})</span>}
    </span>
  );
}

export default function PayoutTimeline({ payouts = [], isLoading }) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 text-center text-gray-400">Loading timeline...</CardContent>
      </Card>
    );
  }

  if (payouts.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-14 text-center">
          <DollarSign className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No withdrawal history yet</p>
          <p className="text-sm text-gray-400 mt-1">Request your first payout above</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" /> Withdrawal Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" />

          <div className="space-y-6">
            {payouts.map((payout, idx) => {
              const cfg = STATUS_CFG[payout.status] || STATUS_CFG.pending;
              const Icon = cfg.icon;
              const isLast = idx === payouts.length - 1;
              return (
                <div key={payout.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    payout.status === 'completed' ? 'bg-green-100' :
                    payout.status === 'processing' ? 'bg-blue-100' :
                    payout.status === 'failed' ? 'bg-red-100' : 'bg-amber-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${cfg.color} ${payout.status === 'processing' ? 'animate-spin' : ''}`} />
                  </div>

                  {/* Content */}
                  <div className={`flex-1 pb-4 ${isLast ? '' : 'border-b border-gray-100'}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-base">${(payout.amount || 0).toFixed(2)}</span>
                          <span className="text-sm text-gray-500">via {METHOD_ETA[payout.method]?.label || payout.method || 'PayPal'}</span>
                          <Badge className={`text-xs ${cfg.badge}`}>{cfg.label}</Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {payout.created_date ? formatDistanceToNow(new Date(payout.created_date), { addSuffix: true }) : ''}
                          {payout.created_date ? ` · ${format(new Date(payout.created_date), 'MMM d, yyyy h:mm a')}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2">
                      <EstimatedArrival payout={payout} />
                    </div>

                    {/* Progress steps for pending/processing */}
                    {(payout.status === 'pending' || payout.status === 'processing') && (
                      <div className="mt-3 flex items-center gap-0 text-xs">
                        {['Submitted', 'Approved', 'Sent', 'Arrived'].map((step, si) => {
                          const stepDone = (payout.status === 'processing' && si <= 1) || (payout.status === 'completed' && si <= 3);
                          const isCurrent = (payout.status === 'pending' && si === 0) || (payout.status === 'processing' && si === 2);
                          return (
                            <React.Fragment key={step}>
                              <div className="flex flex-col items-center">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                                  stepDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-200 text-gray-400'
                                }`}>
                                  {stepDone ? '✓' : si + 1}
                                </div>
                                <span className={`text-xs mt-0.5 ${stepDone || isCurrent ? 'text-gray-700' : 'text-gray-400'}`}>{step}</span>
                              </div>
                              {si < 3 && <div className={`h-0.5 w-8 mx-1 mb-3 ${stepDone ? 'bg-green-400' : 'bg-gray-200'}`} />}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}

                    {payout.recipient_email && (
                      <p className="text-xs text-gray-400 mt-1">To: {payout.recipient_email}</p>
                    )}
                    {(payout.paypal_batch_id || payout.external_transaction_id) && (
                      <p className="text-xs font-mono text-gray-400 mt-0.5 truncate">
                        Ref: {payout.paypal_batch_id || payout.external_transaction_id}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}