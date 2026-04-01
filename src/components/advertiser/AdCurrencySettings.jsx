import React, { createContext, useContext, useState, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';

// Static exchange rates relative to USD (approximated for demo)
const RATES = {
  USD: { symbol: '$',  name: 'US Dollar',          rate: 1.0000 },
  EUR: { symbol: '€',  name: 'Euro',               rate: 0.9200 },
  GBP: { symbol: '£',  name: 'British Pound',      rate: 0.7900 },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar',   rate: 1.3600 },
  AUD: { symbol: 'A$', name: 'Australian Dollar',  rate: 1.5400 },
  JPY: { symbol: '¥',  name: 'Japanese Yen',       rate: 149.50 },
  BRL: { symbol: 'R$', name: 'Brazilian Real',     rate: 4.9700 },
  INR: { symbol: '₹',  name: 'Indian Rupee',       rate: 83.200 },
  NGN: { symbol: '₦',  name: 'Nigerian Naira',     rate: 1580.0 },
  MXN: { symbol: 'MX$', name: 'Mexican Peso',      rate: 17.100 },
  SGD: { symbol: 'S$', name: 'Singapore Dollar',   rate: 1.3400 },
  ZAR: { symbol: 'R',  name: 'South African Rand', rate: 18.800 },
};

const CurrencyContext = createContext({ currency: 'USD', fmt: (v) => `$${v.toFixed(2)}`, setCurrency: () => {} });

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => localStorage.getItem('gg_ad_currency') || 'USD');

  const setCurrency = (c) => {
    localStorage.setItem('gg_ad_currency', c);
    setCurrencyState(c);
  };

  const fmt = (usdValue) => {
    const cfg = RATES[currency] || RATES.USD;
    const converted = usdValue * cfg.rate;
    const decimals = cfg.rate >= 100 ? 0 : 2;
    return `${cfg.symbol}${converted.toFixed(decimals)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, fmt, rates: RATES }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

export default function AdCurrencySettings() {
  const { currency, setCurrency, rates } = useCurrency();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-4 h-4 text-blue-400" />
        <p className="text-white font-bold text-sm">Display Currency</p>
      </div>
      <p className="text-gray-500 text-xs -mt-2">
        All budget stats, transaction amounts, and bid values will be displayed in your selected currency.
        Base currency is always USD; conversion is for display only.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(rates).map(([code, cfg]) => (
          <button key={code} onClick={() => setCurrency(code)}
            className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
              currency === code
                ? 'bg-blue-500/10 border-blue-500/30 text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
            }`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-black text-sm w-6 text-center flex-shrink-0">{cfg.symbol}</span>
              <div className="min-w-0">
                <p className="font-bold text-xs leading-none">{code}</p>
                <p className="text-gray-600 text-[10px] truncate">{cfg.name}</p>
              </div>
            </div>
            {currency === code && <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
          </button>
        ))}
      </div>
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
        <p className="text-gray-400 text-xs">
          Current: <span className="text-white font-bold">{rates[currency]?.name} ({currency})</span>
          {' · '}Rate: <span className="text-yellow-400 font-bold">1 USD = {rates[currency]?.rate} {currency}</span>
        </p>
      </div>
    </div>
  );
}