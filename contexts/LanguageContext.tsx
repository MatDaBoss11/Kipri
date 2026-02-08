import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { translations, Language, TranslationKeys } from '../translations';
import LanguageService from '../services/LanguageService';

interface LanguageContextType {
  language: Language;
  t: TranslationKeys;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: React.ReactNode;
  initialLanguage?: Language;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  initialLanguage = 'en',
}) => {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await LanguageService.getLanguage();
        if (savedLanguage) {
          setLanguageState(savedLanguage);
        }
      } catch (error) {
        console.error('[LanguageContext] Error loading language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  // Set language and persist to AsyncStorage
  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await LanguageService.setLanguage(lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('[LanguageContext] Error setting language:', error);
      throw error;
    }
  }, []);

  // Get the translation object based on current language
  const t = useMemo(() => {
    return translations[language];
  }, [language]);

  const value: LanguageContextType = useMemo(
    () => ({
      language,
      t,
      setLanguage,
      isLoading,
    }),
    [language, t, setLanguage, isLoading]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
