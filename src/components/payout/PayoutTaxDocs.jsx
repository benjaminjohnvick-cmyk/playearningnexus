import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, AlertCircle, CheckCircle2 } from 'lucide-react';

function generateW9Summary(user, payouts) {
  const year = new Date().getFullYear();
  const totalNet = payouts
    .filter(p => p.status === 'completed' && new Date(p.paid_date || p.created_date).getFullYear() === year)
    .reduce((s, p) => s + (p.net_amount || 0), 0);
  return { year, totalNet };
}

export default function PayoutTaxDocs({ user, payouts = [] }) {
  const currentYear = new Date().getFullYear();

  const yearlyTotals = useMemo(() => {
    const map = {};
    payouts.filter(p => p.status === 'completed').forEach(p => {
      const yr = new Date(p.paid_date || p.created_date).getFullYear();
      map[yr] = (map[yr] || 0) + (p.net_amount || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => b - a)
      .map(([year, total]) => ({ year: parseInt(year), total }));
  }, [payouts]);

  const { totalNet } = generateW9Summary(user, payouts);
  const needs1099 = totalNet >= 600;

  const downloadTaxDoc = (year, total) => {
    const doc = `
TAX SUMMARY — ${year}
Platform: GamerGain
Taxpayer: ${user?.full_name || 'N/A'}
Email: ${user?.email || 'N/A'}

EARNINGS SUMMARY (${year}):
Total Net Payouts: $${total.toFixed(2)}

${total >= 600 ? `⚠ Form 1099-NEC may be required (earnings ≥ $600)` : `✓ Below $600 threshold — 1099 not required`}

Note: This is an informal summary. Please consult a tax professional.
GamerGain does not provide tax advice.
    `.trim();
    const blob = new Blob([doc], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gamergain-tax-summary-${year}.txt`;
    a.click();
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-5 h-5 text-indigo-600" />
          Tax Documentation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current year alert */}
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${needs1099 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          {needs1099
            ? <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {currentYear} Earnings: ${totalNet.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {needs1099
                ? 'You may receive a 1099-NEC (earnings ≥ $600). Download your summary below.'
                : 'Below $600 threshold — 1099-NEC not expected for this year.'}
            </p>
          </div>
        </div>

        {/* W-9 info note */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          <strong>W-9 on file?</strong> GamerGain may request a W-9 form when earnings exceed $600/year. Ensure your payout profile name matches your tax records.
        </div>

        {/* Yearly summaries */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Annual Summaries</p>
          {yearlyTotals.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No completed payouts yet.</p>
          )}
          {yearlyTotals.map(({ year, total }) => (
            <div key={year} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800">{year} Tax Year</p>
                <p className="text-xs text-gray-500">${total.toFixed(2)} net earnings</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={total >= 600 ? 'bg-amber-100 text-amber-700 border-0' : 'bg-green-100 text-green-700 border-0'}>
                  {total >= 600 ? '1099 Likely' : 'No 1099'}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => downloadTaxDoc(year, total)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}