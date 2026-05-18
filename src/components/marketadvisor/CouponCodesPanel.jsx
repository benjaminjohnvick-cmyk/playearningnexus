import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tag, Copy, Check } from 'lucide-react';

export default function CouponCodesPanel({ coupons }) {
  const [copied, setCopied] = useState(null);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <h2 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
        <Tag className="w-5 h-5 text-green-400" /> Exclusive Coupon Codes
      </h2>
      {!coupons.length ? (
        <div className="text-slate-500 text-sm text-center py-8">No coupons available right now.<br />Check back tomorrow!</div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon, i) => (
            <div key={i} className="bg-slate-900 border border-dashed border-green-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-white font-bold tracking-widest text-sm font-mono">{coupon.code}</div>
                  <div className="text-green-400 font-semibold text-sm mt-0.5">{coupon.discount}</div>
                </div>
                <Button size="sm" variant="ghost"
                  onClick={() => copyCode(coupon.code)}
                  className={`${copied === coupon.code ? 'text-green-400' : 'text-slate-400 hover:text-white'}`}>
                  {copied === coupon.code ? <><Check className="w-3 h-3 mr-1" />Copied!</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="text-xs bg-slate-700 text-slate-300 border-0">{coupon.category}</Badge>
                <div className="text-slate-500 text-xs">
                  {coupon.min_spend > 0 && `Min $${coupon.min_spend} · `}{coupon.valid_until}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}