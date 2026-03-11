import React from 'react';
import { useLocale } from '@/components/locale/LocaleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, DollarSign, Check, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function LocaleSettings() {
  const { language, setLanguage, currency, setCurrency, formatCurrency, supportedLanguages, currencies } = useLocale();

  const handleLanguageChange = async (code) => {
    setLanguage(code);
    try {
      await base44.auth.updateMe({ preferred_language: code });
    } catch {}
    const lang = supportedLanguages.find(l => l.code === code);
    toast.success(`Language changed to ${lang?.name}`);
  };

  const handleCurrencyChange = (code) => {
    setCurrency(code);
    const curr = currencies.find(c => c.code === code);
    toast.success(`Currency changed to ${curr?.name}`);
  };

  return (
    <div className="space-y-6">
      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Display Language
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg mb-4">
            <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Auto-detected from your browser. When you select a non-English language, UI text is translated using AI. Translation is cached so it gets faster over time.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {supportedLanguages.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                  language === lang.code
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="truncate">{lang.name}</span>
                {language === lang.code && <Check className="w-3.5 h-3.5 ml-auto text-blue-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Display Currency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg mb-4">
            <DollarSign className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-700">
              All dollar amounts are displayed in your selected currency using live exchange rates (updated hourly).
              <span className="font-semibold block mt-1">Preview: $100.00 USD = {formatCurrency(100)}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {currencies.map(curr => (
              <button
                key={curr.code}
                onClick={() => handleCurrencyChange(curr.code)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                  currency === curr.code
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="font-bold text-base w-5 text-center">{curr.symbol}</span>
                <div className="text-left min-w-0">
                  <p className="font-semibold leading-tight">{curr.code}</p>
                  <p className="text-xs text-gray-400 leading-tight truncate">{curr.name}</p>
                </div>
                {currency === curr.code && <Check className="w-3.5 h-3.5 ml-auto text-green-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}