import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../translations';

const LANGUAGE_KEY = '@kipri_user_language';

class LanguageService {
  private static instance: LanguageService;

  private constructor() {}

  public static getInstance(): LanguageService {
    if (!LanguageService.instance) {
      LanguageService.instance = new LanguageService();
    }
    return LanguageService.instance;
  }

  /**
   * Gets the currently selected language from AsyncStorage
   * @returns The language code ('en' or 'fr') or null if not set
   */
  public async getLanguage(): Promise<Language | null> {
    try {
      const language = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (language === 'en' || language === 'fr') {
        return language;
      }
      return null;
    } catch (error) {
      console.error('[LanguageService] Error getting language:', error);
      return null;
    }
  }

  /**
   * Sets the user's preferred language in AsyncStorage
   * @param language The language code to set ('en' or 'fr')
   */
  public async setLanguage(language: Language): Promise<void> {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
      console.log('[LanguageService] Language set to:', language);
    } catch (error) {
      console.error('[LanguageService] Error setting language:', error);
      throw error;
    }
  }

  /**
   * Checks if the user has already selected a language
   * @returns true if a language has been selected, false otherwise
   */
  public async hasLanguageSelected(): Promise<boolean> {
    try {
      const language = await AsyncStorage.getItem(LANGUAGE_KEY);
      return language !== null;
    } catch (error) {
      console.error('[LanguageService] Error checking language selection:', error);
      return false;
    }
  }
}

export default LanguageService.getInstance();
