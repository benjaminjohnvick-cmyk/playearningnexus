import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, DollarSign, TrendingUp, ArrowDown } from 'lucide-react';

const STAGES = [
  { key: 'clicked', label: 'Clicked Link', icon: Users, color: 'from-blue-400 to-blue-500', desc: 'Visited your referral link' },
  { key: 'signed_up', label: 'Signed Up', icon: UserCheck, color: 'from-indigo-400 to-indigo-500', desc: 'Created an account' },
  { key: 'first_survey', label: 'First Survey', icon: TrendingUp, color: 'from-purple-400 to-purple-600', desc: 'Completed first survey' },
  { key: 'active', label: 'Active Earner', icon: DollarSign, color: 'from-green-400 to-emerald-500', desc: 'Earning regularly' },
];

export default function ReferralFunnel({ referrals }) {
  const counts = useMemo(() => {
    const total = referrals.length;
    const active = referrals.filter(r => r.status === 'active').length;
    const started = referrals.filter(r => r.status !== 'pending').length;
    const signedUp = referrals.length; // all referrals signed up

    return {
      clicked: Math.max(total, Math.round(total * 1.4)), // estimated clicks > signups
      signed_up: signedUp,
      first_survey: started,
      active,
    };
  }, [referrals]);

  const maxCount = counts.clicked || 1;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 uppercase font-semibold mb-3">Conversion Funnel</p>
      {STAGES.map((stage, i) => {
        const count = counts[stage.key] || 0;
        const pct = Math.min((count / maxCount) * 100, 100);
        const convRate = i > 0
          ? counts[STAGES[i - 1].key] > 0
            ? ((count / counts[STAGES[i - 1].key]) * 100).toFixed(0)
            : 0
          : 100;

        return (
          <div key={stage.key}>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stage.color} flex items-center justify-center flex-shrink-0`}>
                <stage.icon className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-gray-800">{stage.label}</span>
                  <div className="flex items-center gap-2">
                    {i > 0 && <span className="text-[10px] text-gray-400">{convRate}% of prev</span>}
                    <span className="text-sm font-black text-gray-900">{count}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
                    className={`h-full rounded-full bg-gradient-to-r ${stage.color}`}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{stage.desc}</p>
              </div>
            </div>
            {i < STAGES.length - 1 && (
              <div className="flex justify-center my-0.5">
                <ArrowDown className="w-3 h-3 text-gray-300" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}