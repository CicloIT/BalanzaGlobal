import React, { createContext, useContext } from 'react';
import { useTheme } from '../hooks/useTheme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
}
