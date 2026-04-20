import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type ThemeId =
  | 'light'
  | 'dark'
  | 'mono-light'
  | 'mono-dark'
  | 'forest'
  | 'ocean'
  | 'midnight'
  | 'sunset'
  | 'lavender'
  | 'sand'
  | 'crimson'
  | 'mint';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  isDark: boolean;
  swatch: { background: string; surface: string; accent: string };
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Daylight',
    description: 'Crisp white with the indigo accent.',
    isDark: false,
    swatch: { background: '#F5F5F5', surface: '#FFFFFF', accent: '#5856D6' },
  },
  {
    id: 'dark',
    label: 'Eclipse',
    description: 'Deep neutral dark with indigo accent.',
    isDark: true,
    swatch: { background: '#000000', surface: '#1C1C1E', accent: '#7B79E8' },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Warm coral light theme.',
    isDark: false,
    swatch: { background: '#FFF8F4', surface: '#FFEDE0', accent: '#F97316' },
  },
  {
    id: 'lavender',
    label: 'Lavender',
    description: 'Soft pink-purple light theme.',
    isDark: false,
    swatch: { background: '#FBF6FE', surface: '#F3E5FB', accent: '#C026D3' },
  },
  {
    id: 'sand',
    label: 'Sand',
    description: 'Sepia-warm beige reading mode.',
    isDark: false,
    swatch: { background: '#FAF6EE', surface: '#F0E8D6', accent: '#B45309' },
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Deep green-tinted dark.',
    isDark: true,
    swatch: { background: '#0A1410', surface: '#1A2D22', accent: '#4ADE80' },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Cool blue-tinted dark.',
    isDark: true,
    swatch: { background: '#07101A', surface: '#182F47', accent: '#38BDF8' },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep violet dark with cool whites.',
    isDark: true,
    swatch: { background: '#08081A', surface: '#1F1F4D', accent: '#A78BFA' },
  },
  {
    id: 'mono-light',
    label: 'Mono Light',
    description: 'Pure grayscale, no color.',
    isDark: false,
    swatch: { background: '#FFFFFF', surface: '#ECECEC', accent: '#1A1A1A' },
  },
  {
    id: 'mono-dark',
    label: 'Mono Dark',
    description: 'Pure grayscale dark.',
    isDark: true,
    swatch: { background: '#000000', surface: '#232323', accent: '#FFFFFF' },
  },
  {
    id: 'mint',
    label: 'Mint',
    description: 'Fresh mint-green light theme.',
    isDark: false,
    swatch: { background: '#F2FBF5', surface: '#DAF1E2', accent: '#14B8A6' },
  },
  {
    id: 'crimson',
    label: 'Crimson',
    description: 'Deep red dark with rose accent.',
    isDark: true,
    swatch: { background: '#150A0E', surface: '#381A24', accent: '#F43F5E' },
  },
];

const VALID_THEMES = new Set<ThemeId>(THEME_OPTIONS.map((t) => t.id));

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && VALID_THEMES.has(value as ThemeId);
}

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

function readInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return 'light';
  const manual = window.localStorage.getItem('theme-manual');
  const stored = window.localStorage.getItem('theme');
  if (manual && isThemeId(stored)) return stored;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(readInitialTheme);
  const hydratedFromDbRef = useRef(false);

  // Apply the theme to <html data-theme> + persist to localStorage.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Pull the persisted theme from the user's profile once after auth, then
  // mirror future changes back to the DB.
  useEffect(() => {
    let alive = true;

    const hydrate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) return;
      const { data: row } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', user.id)
        .maybeSingle();
      if (!alive) return;
      hydratedFromDbRef.current = true;
      if (row?.theme && isThemeId(row.theme) && row.theme !== theme) {
        setThemeState(row.theme);
      }
    };

    hydrate();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        hydratedFromDbRef.current = false;
        return;
      }
      hydrate();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // System-pref fallback: if the user never picked manually, follow the OS.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme-manual')) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = useCallback(async (next: ThemeId) => {
    if (!isThemeId(next)) return;
    localStorage.setItem('theme-manual', 'true');
    setThemeState(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ theme: next }).eq('id', user.id);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = theme;
    const opt = THEME_OPTIONS.find((t) => t.id === current);
    // Toggle within a (light <-> dark) family when one is obvious; otherwise
    // fall back to default light/dark.
    const next: ThemeId = opt?.isDark ? 'light' : 'dark';
    void setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: THEME_OPTIONS.find((t) => t.id === theme)?.isDark ?? false,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
