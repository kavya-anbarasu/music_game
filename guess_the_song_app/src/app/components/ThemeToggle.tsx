'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'gts_theme';

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

export function ThemeToggle(props: { className?: string }) {
  const { className } = props;
  const [theme, setTheme] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);
  const isLight = theme === 'light';

  useEffect(() => {
    const initial = getPreferredTheme();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme, ready]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      className={cn('inline-flex items-center gap-2 text-xs sm:text-sm', className)}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle light mode"
    >
      <span className="gts-toggle-track relative h-5 w-9 rounded-full">
        <span
          className={cn(
            'gts-toggle-knob absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-transform duration-200',
            isLight && 'translate-x-4'
          )}
        />
      </span>
    </button>
  );
}
