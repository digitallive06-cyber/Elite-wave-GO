import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useFavorites } from '../../src/contexts/FavoritesContext';
import { useGlobalVideo } from '../../src/contexts/GlobalVideoContext';
import { api } from '../../src/utils/api';

const { width } = Dimensions.get('window');
const MOVIE_CARD_WIDTH = (width - 48 - 24) / 2.5;

export default function HomeScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const { favorites } = useFavorites();
  const { playStream, state: videoState } = useGlobalVideo();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [recentMovies, setRecentMovies] = useState<any[]>([]);
  const [recentSeries, setRecentSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [histData, moviesData, seriesData] = await Promise.allSettled([
        api.getHistory(username),
        api.getRecentVod(username, password, 20),
        api.getRecentSeries(username, password, 20),
      ]);
      if (histData.status === 'fulfilled') {
        const h = histData.value || [];
        setHistory(h);
        // Auto-play last watched channel (muted) if no stream is currently playing
        if (h.length > 0 && !videoState.streamUrl) {
          const lastItem = h[0];
          try {
            const urlData = await api.getStreamUrl(
              username, password, lastItem.stream_id,
              lastItem.stream_type || 'live', 'ts'
            );
            playStream(
              urlData.url,
              lastItem.stream_name || lastItem.name || 'Unknown',
              lastItem.stream_icon || '',
              '',
              lastItem.stream_id,
              lastItem.category_id || '',
              urlData.fallback_url || '',
            );
          } catch (e) { console.error('Hero URL error:', e); }
        }
      }
      if (moviesData.status === 'fulfilled') setRecentMovies(moviesData.value || []);
      if (seriesData.status === 'fulfilled') setRecentSeries(seriesData.value || []);
    } catch (e) { console.error('Load data error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [username, password]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Play a channel via global context (navigates to Live tab)
  const playLiveChannel = async (item: any) => {
    try {
      const urlData = await api.getStreamUrl(username, password, item.stream_id, item.stream_type || 'live', 'ts');
      playStream(
        urlData.url,
        item.stream_name || item.name || 'Unknown',
        item.stream_icon || item.cover || '',
        '',
        item.stream_id,
        item.category_id || '',
        urlData.fallback_url || '',
      );
      // Navigate to Live tab
      router.push('/(tabs)/live');
    } catch (e) { console.error('Play error:', e); }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Elite Wave</Text>
          <TouchableOpacity testID="settings-btn" onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Favorites */}
        {favorites.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={18} color="#FFD700" />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginLeft: 6 }]}>Favorites</Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={favorites}
              keyExtractor={(item) => `fav-${item.stream_id}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  testID={`home-fav-${index}`}
                  style={[styles.channelCard, { backgroundColor: colors.surface }]}
                  activeOpacity={0.7}
                  onPress={() => playLiveChannel({
                    stream_id: item.stream_id,
                    stream_name: item.name,
                    stream_icon: item.stream_icon,
                    category_id: item.category_id,
                  })}
                >
                  <View style={styles.channelCardInner}>
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.channelCardImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={24} color={colors.textSecondary} />
                    )}
                  </View>
                  <Text style={[styles.channelCardName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                  <Ionicons name="star" size={10} color="#FFD700" style={{ position: 'absolute', top: 4, right: 4 }} />
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Recently Watched */}
        {history.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recently Watched</Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={history.slice(0, 10)}
              keyExtractor={(item, i) => `hist-${i}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  testID={`history-item-${index}`}
                  style={[styles.channelCard, { backgroundColor: colors.surface }]}
                  activeOpacity={0.7}
                  onPress={() => playLiveChannel(item)}
                >
                  <View style={styles.channelCardInner}>
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.channelCardImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={24} color={colors.textSecondary} />
                    )}
                  </View>
                  <Text style={[styles.channelCardName, { color: colors.textPrimary }]} numberOfLines={1}>{item.stream_name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Last Added Movies */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Last Added Movies</Text>
            <TouchableOpacity testID="see-all-movies-btn" style={styles.seeAllBtn} onPress={() => router.push('/(tabs)/vod')}>
              <Text style={[styles.seeAllText, { color: colors.textSecondary }]}>See All</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {recentMovies.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={recentMovies}
              keyExtractor={(item, i) => `movie-${item.stream_id || i}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item, index }) => (
                <TouchableOpacity testID={`recent-movie-${index}`} style={styles.posterCard} activeOpacity={0.8}>
                  {item.stream_icon ? (
                    <Image source={{ uri: item.stream_icon }} style={styles.posterImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.posterPlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
                      <Ionicons name="film-outline" size={28} color={colors.textSecondary} />
                      <Text style={[styles.posterPlaceholderText, { color: colors.textSecondary }]} numberOfLines={2}>{item.name}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={[styles.emptyRow, { backgroundColor: colors.surface }]}>
              <Ionicons name="film-outline" size={24} color={colors.textSecondary} />
              <Text style={[styles.emptyRowText, { color: colors.textSecondary }]}>No movies available</Text>
            </View>
          )}
        </View>

        {/* Last Added Series */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Last Added Series</Text>
            <TouchableOpacity testID="see-all-series-btn" style={styles.seeAllBtn} onPress={() => router.push('/(tabs)/series')}>
              <Text style={[styles.seeAllText, { color: colors.textSecondary }]}>See All</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {recentSeries.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={recentSeries}
              keyExtractor={(item, i) => `series-${item.series_id || i}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item, index }) => (
                <TouchableOpacity testID={`recent-series-${index}`} style={styles.posterCard} activeOpacity={0.8}>
                  {item.cover ? (
                    <Image source={{ uri: item.cover }} style={styles.posterImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.posterPlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
                      <Ionicons name="albums-outline" size={28} color={colors.textSecondary} />
                      <Text style={[styles.posterPlaceholderText, { color: colors.textSecondary }]} numberOfLines={2}>{item.name}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={[styles.emptyRow, { backgroundColor: colors.surface }]}>
              <Ionicons name="albums-outline" size={24} color={colors.textSecondary} />
              <Text style={[styles.emptyRowText, { color: colors.textSecondary }]}>No series available</Text>
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 14, fontWeight: '600' },
  horizontalList: { paddingHorizontal: 16, gap: 12 },
  channelCard: { width: 100, borderRadius: 12, overflow: 'hidden', padding: 10, alignItems: 'center' },
  channelCardInner: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'center' },
  channelCardImg: { width: 60, height: 44 },
  channelCardName: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  posterCard: { width: MOVIE_CARD_WIDTH, aspectRatio: 2 / 3, borderRadius: 12, overflow: 'hidden' },
  posterImg: { width: '100%', height: '100%' },
  posterPlaceholder: {
    width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, padding: 8,
  },
  posterPlaceholderText: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  emptyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, padding: 20, borderRadius: 12,
  },
  emptyRowText: { fontSize: 14 },
});
