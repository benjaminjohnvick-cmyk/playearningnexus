import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const LocalizationContext = createContext();

export const LocalizationProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');
  const [region, setRegion] = useState('US');
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);

  // Auto-detect user location on mount
  useEffect(() => {
    const detectLocation = async () => {
      try {
        // Check for saved preference
        const saved = localStorage.getItem('user_language');
        if (saved) {
          setLanguage(saved);
        } else {
          // Auto-detect from browser or IP
          const browserLang = navigator.language?.split('-')[0] || 'en';
          setLanguage(browserLang);
          localStorage.setItem('user_language', browserLang);
        }
      } catch (e) {
        console.error('Localization detection error:', e);
      }
      setLoading(false);
    };

    detectLocation();
  }, []);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translationRecords = await base44.asServiceRole.entities.LocalizationString.filter(
          { language_code: language, is_active: true },
          'created_date',
          1000
        );
        
        const trans = {};
        translationRecords.forEach(record => {
          trans[record.key] = record.translated_value;
        });
        setTranslations(trans);
      } catch (e) {
        // Silently fail if entity doesn't exist yet
      }
    };

    loadTranslations();
  }, [language]);

  const t = (key, defaultValue = key) => {
    return translations[key] || defaultValue;
  };

  const setUserLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('user_language', lang);
  };

  return (
    <LocalizationContext.Provider value={{ language, region, translations, t, setUserLanguage, loading }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within LocalizationProvider');
  }
  return context;
};