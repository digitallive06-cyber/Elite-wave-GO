import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';

export interface FavoriteChannel {
  stream_id: number;
  name: string;
  stream_icon: string;
  category_id: string;
}

interface FavoritesContextType {
  favorites: FavoriteChannel[];
  isFavorite: (streamId: number) => boolean;
  toggleFavorite: (channel: FavoriteChannel) => void;
  loadServerFavorites: (username: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  isFavorite: () => false,
  toggleFavorite: () => {},
  loadServerFavorites: async () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteChannel[]>([]);

  // Load from AsyncStorage on mount
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem('@iptv_favorites');
        if (stored) setFavorites(JSON.parse(stored));
      } catch {}
    };
    load();
  }, []);

  // Sync favorites from server (merges with local)
  const loadServerFavorites = useCallback(async (username: string) => {
    try {
      const serverFavs = await api.getFavorites(username);
      if (Array.isArray(serverFavs) && serverFavs.length > 0) {
        setFavorites(prev => {
          // Merge: server favorites take priority, add any local-only ones
          const serverIds = new Set(serverFavs.map((f: any) => f.stream_id));
          const localOnly = prev.filter(f => !serverIds.has(f.stream_id));
          const merged = [...serverFavs.map((f: any) => ({
            stream_id: f.stream_id,
            name: f.name || f.stream_name || '',
            stream_icon: f.stream_icon || '',
            category_id: f.category_id || '',
          })), ...localOnly];
          AsyncStorage.setItem('@iptv_favorites', JSON.stringify(merged));
          return merged;
        });
      }
    } catch {}
  }, []);

  const isFavorite = useCallback((streamId: number) => {
    return favorites.some(f => f.stream_id === streamId);
  }, [favorites]);

  const toggleFavorite = useCallback((channel: FavoriteChannel) => {
    setFavorites(prev => {
      let updated: FavoriteChannel[];
      if (prev.some(f => f.stream_id === channel.stream_id)) {
        updated = prev.filter(f => f.stream_id !== channel.stream_id);
      } else {
        updated = [...prev, channel];
      }
      // Save locally
      AsyncStorage.setItem('@iptv_favorites', JSON.stringify(updated));
      // Also save to server (fire and forget)
      api.toggleFavorite({
        stream_id: channel.stream_id,
        name: channel.name,
        stream_icon: channel.stream_icon,
        category_id: channel.category_id,
        stream_type: 'live',
      }).catch(() => {});
      return updated;
    });
  }, []);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, loadServerFavorites }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
