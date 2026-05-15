import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Ban, DollarSign, X, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

const SIGNAL_ICONS = {
  'click-spam': '🖱️',
  'fast': '⚡',
  'volume': '📈',
  'straight-line': '📊',
  'low-quality': '⚠️',
};

function getSeverity(probability) {
  if (probability >= 75) return { label: 'High', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
  if (probability >= 40) return { label: 'Medium', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
  return { label: 'Low', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' };
}

export default function FraudThreatCard({
  report,
  expanded,
  onToggle,
  onBlacklist,
  onRequestCredit,
  onDismiss,
  blacklistLoading,
  creditLoading,
  dismissLoading,
  isBlacklisted,
  isResolved,
}) {
  const prob = report.fraud_probability || 0;
  const severity = getSeverity(prob);
  const signals = report.signals || [];
  const createdAt = new Date(report.created_date).toLocaleString();

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${severity.dot}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800">
                  User: <span className="font-mono text-xs">{report.user_id?.slice(0, 16)}…</span>
                </span>
                <Badge className={`text-xs ${severity.color}`}>{severity.label} Risk</Badge>
                {isBlacklisted && <Badge className="text-xs bg-gray-800 text-white">Blacklisted</Badge>}
                {isResolved && <Badge className="text-xs bg-green-100 text-green-700">Resolved</Badge>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{createdAt}</span>
                <span className="font-medium text-red-600">{prob}% fraud probability</span>
              </div>
              {/* Signal chips */}
              {signals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {signals.map((sig, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded-full border border-red-100">
                      {sig.length > 40 ? sig.slice(0, 40) + '…' : sig}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fraud probability bar */}
          <div className="flex-shrink-0 w-16 text-center">
            <div className="text-lg font-black text-red-600">{prob}%</div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${prob}%`,
                  background: prob >= 75 ? '#dc2626' : prob >= 40 ? '#d97706' : '#2563eb',
                }}
              />
            </div>
          </div>
        </div>

        {/* Expandable detail */}
        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-2">
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
              <p className="font-semibold text-gray-700 mb-1">AI Reason:</p>
              <p>{report.reason || 'No additional detail available.'}</p>
            </div>
            {report.admin_notes && (
              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
                <p className="font-semibold mb-0.5">Admin Notes:</p>
                <p>{report.admin_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <button
            onClick={onToggle}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide detail' : 'View detail'}
          </button>

          {!isResolved && (
            <div className="flex items-center gap-2 flex-wrap">
              {!isBlacklisted && onBlacklist && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 text-xs h-7"
                  onClick={onBlacklist}
                  disabled={blacklistLoading}
                >
                  <Ban className="w-3.5 h-3.5" /> Blacklist Source
                </Button>
              )}
              {onRequestCredit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-green-200 text-green-700 hover:bg-green-50 text-xs h-7"
                  onClick={onRequestCredit}
                  disabled={creditLoading}
                >
                  <DollarSign className="w-3.5 h-3.5" /> Request Credit
                </Button>
              )}
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-gray-400 hover:text-gray-600 text-xs h-7"
                  onClick={onDismiss}
                  disabled={dismissLoading}
                >
                  <X className="w-3.5 h-3.5" /> Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}