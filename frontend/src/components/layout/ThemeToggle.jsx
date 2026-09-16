import React, { useEffect, useState } from 'react';

const ORDER = ['auto', 'light', 'dark'];
const LABEL = { auto: 'Theme · Auto', light: 'Theme · Light', dark: 'Theme · Dark' };
const ICON = { auto: '◐', light: '☀', dark: '☾' };
const STORAGE_KEY = 'mc-theme';

/** Applies the stored theme before/while React renders. */
export function applyStoredTheme() {
  const theme = localStorage.getItem(STORAGE_KEY) || 'auto';
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || 'auto');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="sidebar-util"
      onClick={() => setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length])}
      title="Switch between auto, light and dark"
    >
      <span className="util-icon">{ICON[theme]}</span>
      <span>{LABEL[theme]}</span>
    </button>
  );
}
