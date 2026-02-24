import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@iptv_favorites';

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
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  isFavorite: () => false,
  toggleFavorite: () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteChannel[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(data => { if (data) setFavorites(JSON.parse(data)); })
      .catch(() => {});
  }, []);

  const toggleFavorite = useCallback((channel: FavoriteChannel) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.stream_id === channel.stream_id);
      const updated = exists
        ? prev.filter(f => f.stream_id !== channel.stream_id)
        : [...prev, channel];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const isFavorite = useCallback((streamId: number) => {
    return favorites.some(f => f.stream_id === streamId);
  }, [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
