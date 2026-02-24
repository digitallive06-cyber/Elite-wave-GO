import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserInfo {
  username: string;
  password: string;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: string[];
}

interface ServerInfo {
  url: string;
  port: string;
  https_port: string;
  server_protocol: string;
  rtmp_port: string;
  timezone: string;
  timestamp_now: number;
  time_now: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  username: string;
  password: string;
  userInfo: UserInfo | null;
  serverInfo: ServerInfo | null;
  login: (username: string, password: string, data: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isLoading: true,
  username: '',
  password: '',
  userInfo: null,
  serverInfo: null,
  login: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
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

async function safeRemoveItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    loadSavedSession();
  }, []);

  const loadSavedSession = async () => {
    try {
      const saved = await safeGetItem('auth_session');
      if (saved) {
        const data = JSON.parse(saved);
        setUsername(data.username);
        setPassword(data.password);
        setUserInfo(data.userInfo);
        setServerInfo(data.serverInfo);
        setIsLoggedIn(true);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (user: string, pass: string, data: any) => {
    setUsername(user);
    setPassword(pass);
    setUserInfo(data.user_info);
    setServerInfo(data.server_info);
    setIsLoggedIn(true);
    await safeSetItem('auth_session', JSON.stringify({
      username: user,
      password: pass,
      userInfo: data.user_info,
      serverInfo: data.server_info,
    }));
  };

  const logout = async () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setUserInfo(null);
    setServerInfo(null);
    await safeRemoveItem('auth_session');
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, username, password, userInfo, serverInfo, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
