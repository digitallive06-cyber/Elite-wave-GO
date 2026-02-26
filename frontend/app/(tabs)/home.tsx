import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, ActivityIndicator, Dimensions, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useFavorites } from '../../src/contexts/FavoritesContext';
import { api } from '../../src/utils/api';

const { width } = Dimensions.get('window');
const MOVIE_CARD_WIDTH = (width - 48 - 24) / 2.5;

export default function HomeScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const { favorites } = useFavorites();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [recentMovies, setRecentMovies] = useState<any[]>([]);
  const [recentSeries, setRecentSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [heroStreamUrl, setHeroStreamUrl] = useState<string | null>(null);

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
        // Load hero stream URL for last watched
        if (h.length > 0) {
          const lastItem = h[0];
          try {
            const urlData = await api.getStreamUrl(
              username, password, lastItem.stream_id,
              lastItem.stream_type || 'live', 'ts'
            );
            setHeroStreamUrl(urlData.url);
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

  const lastWatched = history.length > 0 ? history[0] : null;

  // Hero video player
  const heroPlayer = useVideoPlayer(heroStreamUrl || '', (p) => {
    if (heroStreamUrl) {
      p.loop = true;
      p.volume = 0;
      p.play();
    }
  });

  const playStream = (item: any, type: string = 'live') => {
    router.push({
      pathname: '/player',
      params: {
        streamId: String(item.stream_id),
        streamName: item.stream_name || item.name || 'Unknown',
        streamIcon: item.stream_icon || item.cover || '',
        streamType: type,
        categoryName: item.category_name || '',
        categoryId: item.category_id || '',
        containerExtension: item.container_extension || 'ts',
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
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

        {/* Hero Player - plays live video */}
        <TouchableOpacity
          testID="hero-player-area"
          style={[styles.heroContainer]}
          activeOpacity={0.9}
          onPress={() => lastWatched && playStream(lastWatched, lastWatched.stream_type || 'live')}
        >
          {heroStreamUrl ? (
            <Video
              ref={heroVideoRef}
              testID="hero-video"
              style={styles.heroVideo}
              source={{ uri: heroStreamUrl }}
              resizeMode={ResizeMode.COVER}
              isLooping
              isMuted
              shouldPlay
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              {lastWatched?.stream_icon ? (
                <Image source={{ uri: lastWatched.stream_icon }} style={styles.heroLogoImg} resizeMode="contain" />
              ) : (
                <Ionicons name="tv-outline" size={48} color="#333" />
              )}
            </View>
          )}
          {/* Gradient overlay on top of video */}
          <View style={styles.heroGradient}>
            {lastWatched ? (
              <>
                <View style={styles.heroLiveTag}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
                <Text style={styles.heroChannelName} numberOfLines={1}>{lastWatched.stream_name}</Text>
                {lastWatched.category_name ? (
                  <Text style={styles.heroCategoryName}>{lastWatched.category_name}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.heroEmptyText}>Start watching to see your last channel here</Text>
            )}
          </View>
          {lastWatched && (
            <TouchableOpacity testID="hero-play-btn" style={styles.heroPlayBtn} onPress={() => playStream(lastWatched, lastWatched.stream_type || 'live')}>
              <Ionicons name="play" size={28} color="#fff" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

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
                  onPress={() => playStream({
                    stream_id: item.stream_id,
                    stream_name: item.name,
                    stream_icon: item.stream_icon,
                    category_id: item.category_id,
                  }, 'live')}
                >
                  <View style={styles.channelCardInner}>
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.channelCardImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={24} color={colors.textSecondary} />
                    )}
                  </View>
                  <Text style={[styles.channelCardName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
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
                  onPress={() => playStream(item, item.stream_type || 'live')}
                >
                  <View style={styles.channelCardInner}>
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.channelCardImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={24} color={colors.textSecondary} />
                    )}
                  </View>
                  <Text style={[styles.channelCardName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.stream_name}
                  </Text>
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
                <TouchableOpacity
                  testID={`recent-movie-${index}`}
                  style={styles.posterCard}
                  activeOpacity={0.8}
                  onPress={() => playStream(item, 'movie')}
                >
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
                <TouchableOpacity
                  testID={`recent-series-${index}`}
                  style={styles.posterCard}
                  activeOpacity={0.8}
                >
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
    </SafeAreaView>
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

  // Hero
  heroContainer: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden',
    marginBottom: 24, height: 200, backgroundColor: '#000',
  },
  heroVideo: { width: '100%', height: '100%' },
  heroPlaceholder: {
    width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111',
  },
  heroLogoImg: { width: 80, height: 80, opacity: 0.4 },
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 16, paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.0)',
    // Simulated gradient via layered background
  },
  heroLiveTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(229,9,20,0.9)',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6, gap: 4,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroChannelName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroCategoryName: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  heroEmptyText: { color: '#555', fontSize: 13, textAlign: 'center' },
  heroPlayBtn: {
    position: 'absolute', right: 16, bottom: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,191,255,0.8)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Sections
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 14, fontWeight: '600' },
  horizontalList: { paddingHorizontal: 16, gap: 12 },

  // Channel cards
  channelCard: { width: 100, borderRadius: 12, overflow: 'hidden', padding: 10, alignItems: 'center' },
  channelCardInner: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'center' },
  channelCardImg: { width: 60, height: 44 },
  channelCardName: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 6 },

  // Poster cards
  posterCard: { width: MOVIE_CARD_WIDTH, aspectRatio: 2 / 3, borderRadius: 12, overflow: 'hidden' },
  posterImg: { width: '100%', height: '100%' },
  posterPlaceholder: {
    width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, padding: 8,
  },
  posterPlaceholderText: { fontSize: 11, textAlign: 'center', marginTop: 4 },

  // Empty
  emptyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, padding: 20, borderRadius: 12,
  },
  emptyRowText: { fontSize: 14 },
});
