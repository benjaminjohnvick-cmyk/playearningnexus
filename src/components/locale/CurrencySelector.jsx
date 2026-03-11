import React, { useState } from 'react';
import { useLocale } from '@/components/locale/LocaleContext';

export default function CurrencySelector() {
  const { language, currency, setCurrency, setLanguage, supportedLanguages, currencies } = useLocale();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('currency');

  const currentLang = supportedLanguages.find(l => l.code === language) || supportedLanguages[0];
  const currentCurr = currencies.find(c => c.code === currency) || currencies[0];

  const openTab = (t) => { setTab(t); setOpen(true); };

  return (
    <div className="relative flex items-center gap-1">
      {/* Currency Button */}
      <button
        onClick={() => openTab('currency')}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-green-50 text-sm font-medium text-green-700 transition-all"
        title="Currency"
      >
        <span className="font-bold">{currentCurr.symbol}</span>
        <span className="text-xs text-gray-500">{currentCurr.code}</span>
      </button>
      {/* Language Button */}
      <button
        onClick={() => openTab('language')}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-blue-50 text-sm font-medium text-blue-700 transition-all"
        title="Language"
      >
        <span className="text-base">{currentLang.flag}</span>
        <span className="hidden sm:inline text-xs text-gray-500">{currentLang.code.toUpperCase()}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setTab('currency')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === 'currency' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                💱 Currency
              </button>
              <button
                onClick={() => setTab('language')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === 'language' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                🌐 Language
              </button>
            </div>

            <div className="p-2 max-h-72 overflow-y-auto">
              {tab === 'currency' ? (
                currencies.map(c => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrency(c.code); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors ${
                      currency === c.code ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    <span className="font-bold w-5 text-center">{c.symbol}</span>
                    <span className="font-medium">{c.code}</span>
                    <span className="text-gray-400 text-xs ml-auto truncate">{c.name}</span>
                    {currency === c.code && <span className="text-green-600 ml-1">✓</span>}
                  </button>
                ))
              ) : (
                supportedLanguages.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLanguage(l.code); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors ${
                      language === l.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    <span className="text-base">{l.flag}</span>
                    <span>{l.name}</span>
                    {language === l.code && <span className="text-blue-600 ml-auto">✓</span>}
                  </button>
                ))
              )}
            </div>

            {tab === 'language' && language !== 'en' && (
              <div className="px-3 py-2 border-t border-gray-100 bg-amber-50">
                <p className="text-xs text-amber-700">🤖 AI translation active — text will be translated as you navigate</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}