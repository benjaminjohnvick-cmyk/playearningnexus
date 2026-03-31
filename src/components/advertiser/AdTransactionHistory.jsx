import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowDownCircle, ArrowUpCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function AdTransactionHistory({ userId }) {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['adTransactions', userId],
    queryFn: () => base44.entities.AdTransaction.filter({ owner_user_id: userId }, '-created_at', 50),
    enabled: !!userId,
  });

  if (isLoading) {
    return <div className="text-center py-8"><div className="w-6 h-6 border-2 border-gray-600 border-t-yellow-400 rounded-full animate-spin mx-auto" /></div>;
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <Clock className="w-10 h-10 mx-auto mb-2 text-gray-700" />
        <p className="text-sm">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map(tx => (
        <div key={tx.id} className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
          {tx.type === 'deposit' ? (
            <ArrowDownCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          ) : (
            <ArrowUpCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold leading-tight">{tx.description || (tx.type === 'deposit' ? 'Budget top-up' : 'Ad charge')}</p>
            {tx.ad_brand && <p className="text-gray-500 text-xs">{tx.ad_brand}</p>}
            <p className="text-gray-600 text-xs">
              {tx.created_at ? format(new Date(tx.created_at), 'MMM d, yyyy · h:mm a') : '—'}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`font-black text-base ${tx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
              {tx.type === 'deposit' ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
            </p>
            {tx.balance_after !== undefined && (
              <p className="text-gray-500 text-[10px]">bal: ${tx.balance_after.toFixed(2)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}