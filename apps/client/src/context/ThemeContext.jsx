// src/context/ThemeContext.jsx
// Theme locked to Light Mode — dark mode has been permanently disabled.
import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  useEffect(() => {
    // Permanently lock the html element to light mode
    const html = document.documentElement;
    html.classList.remove('dark');
    html.classList.add('light');
    try {
      localStorage.setItem('ideavault-theme', 'light');
    } catch { /* storage blocked — ignore */ }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'light', isDark: false, toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
