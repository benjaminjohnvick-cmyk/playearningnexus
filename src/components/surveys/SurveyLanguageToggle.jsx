import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Languages, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/components/locale/LocaleContext';
import { useLocale } from '@/components/locale/LocaleContext';
import { motion, AnimatePresence } from 'framer-motion';

// Cache translations per session
const translationCache = {};

export function useSurveyTranslation() {
  const { language } = useLocale();
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState({});

  const translateTexts = useCallback(async (texts) => {
    if (language === 'en') return texts;
    const cacheKey = `${language}::${texts.join('|')}`;
    if (translationCache[cacheKey]) return translationCache[cacheKey];

    setTranslating(true);
    try {
      const res = await base44.functions.invoke('translateText', {
        texts,
        targetLanguage: language,
      });
      const result = res.data?.translations || texts;
      translationCache[cacheKey] = result;
      return result;
    } catch {
      return texts;
    } finally {
      setTranslating(false);
    }
  }, [language]);

  return { translateTexts, translating, language };
}

export default function SurveyLanguageToggle({ compact = false }) {
  const { language, setLanguage, supportedLanguages } = useLocale();
  const [open, setOpen] = useState(false);

  const current = supportedLanguages.find(l => l.code === language) || supportedLanguages[0];

  // Only show languages relevant for survey translation
  const surveyLangs = supportedLanguages.filter(l =>
    ['en', 'es', 'fr', 'de', 'zh', 'pt', 'ja', 'ko', 'ar', 'hi'].includes(l.code)
  );

  return (
    <div className="relative">
      <Button
        variant="outline"
        size={compact ? 'sm' : 'default'}
        className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
        onClick={() => setOpen(p => !p)}
      >
        <Languages className="w-4 h-4" />
        <span>{current.flag} {compact ? current.code.toUpperCase() : current.name}</span>
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-[180px]"
          >
            <p className="text-xs text-gray-400 px-2 pb-1 font-medium uppercase tracking-wide">Survey Language</p>
            <div className="grid grid-cols-2 gap-1">
              {surveyLangs.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { setLanguage(lang.code); setOpen(false); }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors text-left ${
                    language === lang.code
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span className="truncate text-xs">{lang.name}</span>
                  {language === lang.code && <CheckCircle2 className="w-3 h-3 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}