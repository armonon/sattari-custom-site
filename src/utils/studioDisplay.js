import { useEffect, useState } from 'react';

export const COMPACT_ICONS_KEY = 'stemdeck-compact-icons-v1';

export function useCompactIcons() {
  const [compactIcons, setCompactIcons] = useState(() => {
    try {
      return localStorage.getItem(COMPACT_ICONS_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COMPACT_ICONS_KEY, String(compactIcons));
    } catch {
      // Private/restricted storage must not prevent changing the current UI.
    }
  }, [compactIcons]);
  return [compactIcons, setCompactIcons];
}
