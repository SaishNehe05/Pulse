import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

// 1. Create the Context
const ThemeContext = createContext({
  isDarkMode: false,
  toggleTheme: () => { },
});

// 2. Create the Provider Component
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemColorScheme = useColorScheme(); // Detects phone settings
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  // Listen for system theme changes
  useEffect(() => {
    setIsDarkMode(systemColorScheme === 'dark');
  }, [systemColorScheme]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 3. Create the Hook for easy access
export const useTheme = () => useContext(ThemeContext);

// 4. THE MISSING PIECE: Default Export
export default ThemeProvider;