import React, { createContext, useCallback, useContext, useState } from 'react';

interface ActiveStoreContextType {
  activeStoreName: string | null;
  setActiveStore: (storeName: string) => void;
  clearActiveStore: () => void;
}

const ActiveStoreContext = createContext<ActiveStoreContextType | undefined>(undefined);

export const ActiveStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // In-memory only — resets when app is closed/restarted
  const [activeStoreName, setActiveStoreState] = useState<string | null>(null);

  const setActiveStore = useCallback((storeName: string) => {
    setActiveStoreState(storeName);
  }, []);

  const clearActiveStore = useCallback(() => {
    setActiveStoreState(null);
  }, []);

  return (
    <ActiveStoreContext.Provider value={{ activeStoreName, setActiveStore, clearActiveStore }}>
      {children}
    </ActiveStoreContext.Provider>
  );
};

export const useActiveStore = (): ActiveStoreContextType => {
  const context = useContext(ActiveStoreContext);
  if (context === undefined) {
    throw new Error('useActiveStore must be used within an ActiveStoreProvider');
  }
  return context;
};
