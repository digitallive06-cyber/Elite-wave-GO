import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'dark' | 'light';

const darkColors = {
  background: '#0A0E1A',
  surface: '#141929',
  surfaceHighlight: '#1E2540',
  textPrimary: '#F1F5F9',
  textSecondary: '#7B8DB3',
  border: '#1E2540',
  primary: '#00BFFF',
  accent: '#00E5FF',
  success: '#10B981',
  error: '#EF4444',
  tabBar: 'rgba(10, 14, 26, 0.95)',
  card: '#141929',
  inputBg: '#1E2540',
  overlay: 'rgba(0,0,0,0.6)',
};

const lightColors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceHighlight: '#EDF0F7',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  primary: '#007BFF',
  accent: '#00BFFF',
  success: '#059669',
  error: '#DC2626',
  tabBar: 'rgba(255, 255, 255, 0.95)',
  card: '#FFFFFF',
  inputBg: '#EDF0F7',
  overlay: 'rgba(0,0,0,0.4)',
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: typeof darkColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: darkColors,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    // Fallback for web or when native module unavailable
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    safeGetItem('theme_mode').then(saved => {
      if (saved === 'light' || saved === 'dark') setMode(saved);
    });
  }, []);

  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    safeSetItem('theme_mode', next);
  };

  const colors = mode === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
