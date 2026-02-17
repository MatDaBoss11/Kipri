import React, { createContext, useCallback, useContext, useState } from 'react';

interface InitialCategoryContextType {
  initialCategory: string | null;
  setInitialCategory: (category: string) => void;
  clearInitialCategory: () => void;
}

const InitialCategoryContext = createContext<InitialCategoryContextType | undefined>(undefined);

export const InitialCategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialCategory, setInitialCategoryState] = useState<string | null>(null);

  const setInitialCategory = useCallback((category: string) => {
    setInitialCategoryState(category);
  }, []);

  const clearInitialCategory = useCallback(() => {
    setInitialCategoryState(null);
  }, []);

  return (
    <InitialCategoryContext.Provider value={{ initialCategory, setInitialCategory, clearInitialCategory }}>
      {children}
    </InitialCategoryContext.Provider>
  );
};

export const useInitialCategory = () => {
  const context = useContext(InitialCategoryContext);
  if (!context) {
    throw new Error('useInitialCategory must be used within an InitialCategoryProvider');
  }
  return context;
};
