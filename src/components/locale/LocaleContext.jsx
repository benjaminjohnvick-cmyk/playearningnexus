import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const LocaleContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
];

function detectBrowserLanguage() {
  const lang = navigator.language || navigator.languages?.[0] || 'en';
  const code = lang.split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.code || 'en';
}

export function LocaleProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('gg_language') || detectBrowserLanguage();
  });
  const [currency, setCurrencyState] = useState(() => {
    return localStorage.getItem('gg_currency') || 'USD';
  });
  const [exchangeRates, setExchangeRates] = useState({ USD: 1 });
  const translationCache = useRef({});

  useEffect(() => {
    const cached = localStorage.getItem('gg_exchange_rates');
    const cachedTime = localStorage.getItem('gg_exchange_rates_time');
    if (cached && cachedTime && Date.now() - parseInt(cachedTime) < 3600000) {
      setExchangeRates(JSON.parse(cached));
      return;
    }
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data.rates) {
          setExchangeRates(data.rates);
          localStorage.setItem('gg_exchange_rates', JSON.stringify(data.rates));
          localStorage.setItem('gg_exchange_rates_time', Date.now().toString());
        }
      })
      .catch(() => {
        setExchangeRates({ USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149, CAD: 1.36, AUD: 1.53, INR: 83, BRL: 4.97, MXN: 17.1, KRW: 1325 });
      });
  }, []);

  const setLanguage = useCallback((code) => {
    setLanguageState(code);
    localStorage.setItem('gg_language', code);
  }, []);

  const setCurrency = useCallback((code) => {
    setCurrencyState(code);
    localStorage.setItem('gg_currency', code);
  }, []);

  const formatCurrency = useCallback((usdAmount) => {
    const rate = exchangeRates[currency] || 1;
    const converted = (usdAmount || 0) * rate;
    const curr = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    if (currency === 'JPY' || currency === 'KRW') {
      return `${curr.symbol}${Math.round(converted).toLocaleString()}`;
    }
    return `${curr.symbol}${converted.toFixed(2)}`;
  }, [currency, exchangeRates]);

  const translate = useCallback(async (strings) => {
    if (language === 'en') return strings;
    const cacheKey = `${language}::${strings.join('|||')}`;
    if (translationCache.current[cacheKey]) return translationCache.current[cacheKey];
    try {
      const response = await base44.functions.invoke('translateText', {
        texts: strings,
        targetLanguage: language,
      });
      const translated = response.data?.translations || strings;
      translationCache.current[cacheKey] = translated;
      return translated;
    } catch {
      return strings;
    }
  }, [language]);

  return (
    <LocaleContext.Provider value={{
      language,
      setLanguage,
      currency,
      setCurrency,
      formatCurrency,
      translate,
      exchangeRates,
      supportedLanguages: SUPPORTED_LANGUAGES,
      currencies: CURRENCIES,
    }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}