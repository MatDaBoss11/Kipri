import React, { createContext, useContext } from 'react';

interface LogoutContextType {
  logout: () => Promise<void>;
}

const LogoutContext = createContext<LogoutContextType | undefined>(undefined);

export const LogoutProvider = LogoutContext.Provider;

export const useLogout = (): LogoutContextType => {
  const context = useContext(LogoutContext);
  if (!context) {
    throw new Error('useLogout must be used within a LogoutProvider');
  }
  return context;
};
