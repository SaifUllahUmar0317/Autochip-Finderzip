import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import { type SQLiteDatabase } from 'expo-sqlite';
import colors, { type ThemeColors, type ThemePreference } from '@/constants/colors';
import { initializeDatabase, readSetting, writeSetting } from '@/lib/database';

interface AppContextValue {
  db: SQLiteDatabase | null;
  ready: boolean;
  error: string | null;
  theme: ThemePreference;
  colors: ThemeColors;
  revision: number;
  refresh: () => void;
  setTheme: (theme: ThemePreference) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function initializeAppDatabase(): Promise<SQLiteDatabase> {
  if (Platform.OS === 'web') {
    return Promise.reject(
      new Error(
        'The Replit browser preview cannot start the offline SQLite worker. Open this app in Expo Go on Android to use the local library.',
      ),
    );
  }
  return initializeDatabase();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<ThemePreference>('dark');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const database = await initializeAppDatabase();
        const savedTheme = await readSetting(database, 'theme');
        if (!active) return;
        setDb(database);
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemeState(savedTheme);
        }
        setReady(true);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Local library could not be opened.');
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const setTheme = useCallback(
    async (nextTheme: ThemePreference) => {
      setThemeState(nextTheme);
      if (db) await writeSetting(db, 'theme', nextTheme);
      refresh();
    },
    [db, refresh],
  );
  const activeScheme = theme === 'system' ? systemScheme ?? 'dark' : theme;
  const value = useMemo<AppContextValue>(
    () => ({
      db,
      ready,
      error,
      theme,
      colors: activeScheme === 'light' ? colors.light : colors.dark,
      revision,
      refresh,
      setTheme,
    }),
    [db, ready, error, theme, activeScheme, revision, refresh, setTheme],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}