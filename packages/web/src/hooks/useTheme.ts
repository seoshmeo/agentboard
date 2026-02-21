import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

function getStoredTheme(): Theme {
  return (localStorage.getItem('agentboard_theme') as Theme) || 'dark';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('agentboard_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  }

  return { theme, toggleTheme };
}
