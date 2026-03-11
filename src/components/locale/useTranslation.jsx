import { useState, useEffect, useRef } from 'react';
import { useLocale } from './LocaleContext';

/**
 * Hook to translate an array of strings using AI.
 *
 * Usage:
 *   const strings = useMemo(() => ['Hello', 'Dashboard', 'Earn Money'], []);
 *   const { t, loading } = useTranslation(strings);
 *   // t[0] => 'Hola', t[1] => 'Panel', etc.
 */
export function useTranslation(strings) {
  const { translate, language } = useLocale();
  const [translated, setTranslated] = useState(strings);
  const [loading, setLoading] = useState(false);
  const prevKey = useRef('');

  useEffect(() => {
    const key = `${language}::${strings.join('|||')}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    if (language === 'en') {
      setTranslated(strings);
      return;
    }

    setLoading(true);
    translate(strings).then(result => {
      setTranslated(result);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, strings.join('|||')]);

  return { t: translated, loading };
}