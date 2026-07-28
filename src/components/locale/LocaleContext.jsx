import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const LocaleContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese Yuan' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
  { code: 'COP', symbol: 'CO$', name: 'Colombian Peso' },
  { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
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
        setExchangeRates({
          USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149, CNY: 7.2, CAD: 1.36, AUD: 1.53, NZD: 1.65, CHF: 0.88,
          INR: 83, BRL: 4.97, MXN: 17.1, ARS: 900, COP: 4000, CLP: 950, KRW: 1325, RUB: 92, SEK: 10.5,
          NOK: 10.7, DKK: 6.9, PLN: 4.0, TRY: 32, SAR: 3.75, AED: 3.67, EGP: 48, ZAR: 18.5, SGD: 1.35,
          THB: 36, IDR: 16000, PHP: 58, VND: 25000, MYR: 4.7, NGN: 1500,
        });
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
    // Zero-decimal currencies: show whole units.
    if (['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'COP', 'ARS'].includes(currency)) {
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
      formatPrice: formatCurrency, // alias: converts a USD amount to the selected currency
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