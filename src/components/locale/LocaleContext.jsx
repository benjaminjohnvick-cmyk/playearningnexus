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
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso' },
  { code: 'PYG', symbol: '₲', name: 'Paraguayan Guaraní' },
  { code: 'BOB', symbol: 'Bs', name: 'Bolivian Boliviano' },
  { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón' },
  { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal' },
  { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
  { code: 'RSD', symbol: 'дин', name: 'Serbian Dinar' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Króna' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' },
  { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar' },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial' },
  { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar' },
  { code: 'LBP', symbol: 'ل.ل', name: 'Lebanese Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham' },
  { code: 'DZD', symbol: 'د.ج', name: 'Algerian Dinar' },
  { code: 'TND', symbol: 'د.ت', name: 'Tunisian Dinar' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge' },
];

function detectBrowserLanguage() {
  const lang = navigator.language || navigator.languages?.[0] || 'en';
  const code = lang.split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.code || 'en';
}

function detectBrowserCountry() {
  try {
    const l = navigator.language || navigator.languages?.[0] || '';
    return (l.split('-')[1] || '').toUpperCase();
  } catch { return ''; }
}

// Compact country → currency / language maps, used to auto-set locale from the user's detected country.
const COUNTRY_TO_CURRENCY = {
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CO: 'COP', CL: 'CLP', PE: 'PEN', UY: 'UYU',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', PT: 'EUR', IE: 'EUR', GR: 'EUR', FI: 'EUR',
  AT: 'EUR', BE: 'EUR', GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
  HU: 'HUF', RO: 'RON', UA: 'UAH', RU: 'RUB', TR: 'TRY', SA: 'SAR', AE: 'AED', IL: 'ILS', QA: 'QAR',
  ZA: 'ZAR', EG: 'EGP', NG: 'NGN', KE: 'KES', JP: 'JPY', CN: 'CNY', KR: 'KRW', IN: 'INR', TW: 'TWD',
  HK: 'HKD', SG: 'SGD', MY: 'MYR', TH: 'THB', ID: 'IDR', PH: 'PHP', VN: 'VND', PK: 'PKR', BD: 'BDT',
  LK: 'LKR', NP: 'NPR', KZ: 'KZT', AU: 'AUD', NZ: 'NZD',
};
const COUNTRY_TO_LANG = {
  US: 'en', CA: 'en', GB: 'en', AU: 'en', IE: 'en', NZ: 'en', ZA: 'en', SG: 'en', PH: 'en', NG: 'en',
  MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', ES: 'es', BR: 'pt', PT: 'pt', DE: 'de', AT: 'de',
  CH: 'de', FR: 'fr', BE: 'fr', IT: 'it', NL: 'nl', GR: 'el', FI: 'fi', SE: 'sv', NO: 'no', DK: 'da',
  PL: 'pl', CZ: 'cs', HU: 'hu', RO: 'ro', UA: 'uk', RU: 'ru', TR: 'tr', SA: 'ar', AE: 'ar', EG: 'ar',
  IL: 'he', JP: 'ja', CN: 'zh', TW: 'zh', HK: 'zh', KR: 'ko', IN: 'hi', TH: 'th', ID: 'id', VN: 'vi',
  MY: 'ms',
};

export function LocaleProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('gg_language') || detectBrowserLanguage();
  });
  const [currency, setCurrencyState] = useState(() => {
    return localStorage.getItem('gg_currency') || 'USD';
  });
  const [exchangeRates, setExchangeRates] = useState({ USD: 1 });
  const [country, setCountryState] = useState(() => localStorage.getItem('gg_country') || detectBrowserCountry());
  const translationCache = useRef({});

  // Detect the user's actual country by geo-IP so the flag/locale follow where they physically are
  // (browser locale can be wrong when travelling). Cached 24h; falls back to the browser locale.
  useEffect(() => {
    const cached = localStorage.getItem('gg_country');
    const cachedTime = localStorage.getItem('gg_country_time');
    if (cached && cachedTime && Date.now() - parseInt(cachedTime) < 86400000) { setCountryState(cached); return; }
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const cc = (data.country_code || data.country || '').toUpperCase();
        if (!cc || cc.length !== 2) return;
        setCountryState(cc);
        localStorage.setItem('gg_country', cc);
        localStorage.setItem('gg_country_time', Date.now().toString());
        // Auto-set currency/language from the country, but never override a choice the user made.
        if (!localStorage.getItem('gg_currency') && COUNTRY_TO_CURRENCY[cc]) setCurrency(COUNTRY_TO_CURRENCY[cc]);
        if (!localStorage.getItem('gg_language') && COUNTRY_TO_LANG[cc]) setLanguage(COUNTRY_TO_LANG[cc]);
      })
      .catch(() => { const cc = detectBrowserCountry(); if (cc) setCountryState(cc); });
  }, []);

  const setCountry = useCallback((cc) => {
    const c = (cc || '').toUpperCase();
    setCountryState(c);
    if (c) { localStorage.setItem('gg_country', c); localStorage.setItem('gg_country_time', Date.now().toString()); }
  }, []);

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
          THB: 36, IDR: 16000, PHP: 58, VND: 25000, MYR: 4.7, NGN: 1500, PEN: 3.75, UYU: 40, PYG: 7500,
          BOB: 6.9, CRC: 520, GTQ: 7.8, DOP: 59, CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8, UAH: 40,
          RSD: 108, ISK: 138, QAR: 3.64, KWD: 0.31, BHD: 0.38, OMR: 0.385, JOD: 0.71, LBP: 89500,
          KES: 130, GHS: 15, MAD: 10, DZD: 134, TND: 3.1, TWD: 32, HKD: 7.8, PKR: 278, BDT: 110,
          LKR: 300, NPR: 133, KZT: 470,
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
    if (['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'COP', 'ARS', 'PYG', 'ISK', 'LBP', 'HUF'].includes(currency)) {
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
      country,
      setCountry,
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