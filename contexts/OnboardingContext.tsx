import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ONBOARDING_COMPLETED_KEY = '@kipri_onboarding_completed';
const SCANNER_TIPS_KEY = '@kipri_scanner_tips_seen';

export interface TargetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScannerTipsSeen {
  add: boolean;
  update: boolean;
  receipt: boolean;
}

interface OnboardingContextType {
  // Main onboarding
  isOnboardingActive: boolean;
  currentStep: number;
  shouldAutoStart: boolean;
  startOnboarding: () => void;
  nextStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;

  // Target registry
  registerTarget: (key: string, layout: TargetLayout) => void;
  unregisterTarget: (key: string) => void;
  getTarget: (key: string) => TargetLayout | undefined;
  targets: Record<string, TargetLayout>;

  // Scanner tips
  hasSeenScannerTip: (mode: string) => boolean;
  markScannerTipSeen: (mode: string) => void;
  resetScannerTips: () => void;

  // Product availability (for skipping steps 2&3)
  hasProducts: boolean;
  setHasProducts: (val: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [shouldAutoStart, setShouldAutoStart] = useState(false);
  const [hasProducts, setHasProducts] = useState(true);
  const [scannerTipsSeen, setScannerTipsSeen] = useState<ScannerTipsSeen>({
    add: false,
    update: false,
    receipt: false,
  });
  const targetsRef = useRef<Record<string, TargetLayout>>({});
  const [targets, setTargets] = useState<Record<string, TargetLayout>>({});

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const [completedRaw, tipsRaw] = await AsyncStorage.multiGet([
          ONBOARDING_COMPLETED_KEY,
          SCANNER_TIPS_KEY,
        ]);
        const completed = completedRaw[1];
        const tips = tipsRaw[1];

        if (!completed) {
          setShouldAutoStart(true);
        }

        if (tips) {
          try {
            setScannerTipsSeen(JSON.parse(tips));
          } catch {}
        }
      } catch (e) {
        console.warn('[Onboarding] Error loading persisted state:', e);
      }
    })();
  }, []);

  const registerTarget = useCallback((key: string, layout: TargetLayout) => {
    targetsRef.current[key] = layout;
    setTargets(prev => ({ ...prev, [key]: layout }));
  }, []);

  const unregisterTarget = useCallback((key: string) => {
    delete targetsRef.current[key];
    setTargets(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const getTarget = useCallback((key: string) => {
    return targetsRef.current[key];
  }, []);

  const startOnboarding = useCallback(() => {
    setCurrentStep(0);
    setIsOnboardingActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const skipOnboarding = useCallback(async () => {
    setIsOnboardingActive(false);
    setCurrentStep(0);
    setShouldAutoStart(false);
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch {}
  }, []);

  const completeOnboarding = useCallback(async () => {
    setIsOnboardingActive(false);
    setCurrentStep(0);
    setShouldAutoStart(false);
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch {}
  }, []);

  const resetOnboarding = useCallback(async () => {
    setShouldAutoStart(true);
    setCurrentStep(0);
    setIsOnboardingActive(false);
    // Also reset scanner tips
    const freshTips: ScannerTipsSeen = { add: false, update: false, receipt: false };
    setScannerTipsSeen(freshTips);
    try {
      await AsyncStorage.multiRemove([ONBOARDING_COMPLETED_KEY, SCANNER_TIPS_KEY]);
    } catch {}
  }, []);

  const hasSeenScannerTip = useCallback(
    (mode: string) => {
      return scannerTipsSeen[mode as keyof ScannerTipsSeen] ?? false;
    },
    [scannerTipsSeen],
  );

  const markScannerTipSeen = useCallback(
    async (mode: string) => {
      const updated = { ...scannerTipsSeen, [mode]: true };
      setScannerTipsSeen(updated);
      try {
        await AsyncStorage.setItem(SCANNER_TIPS_KEY, JSON.stringify(updated));
      } catch {}
    },
    [scannerTipsSeen],
  );

  const resetScannerTips = useCallback(async () => {
    const freshTips: ScannerTipsSeen = { add: false, update: false, receipt: false };
    setScannerTipsSeen(freshTips);
    try {
      await AsyncStorage.removeItem(SCANNER_TIPS_KEY);
    } catch {}
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingActive,
        currentStep,
        shouldAutoStart,
        startOnboarding,
        nextStep,
        skipOnboarding,
        completeOnboarding,
        resetOnboarding,
        registerTarget,
        unregisterTarget,
        getTarget,
        targets,
        hasSeenScannerTip,
        markScannerTipSeen,
        resetScannerTips,
        hasProducts,
        setHasProducts,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
