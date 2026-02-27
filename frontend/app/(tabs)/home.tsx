import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  const { favorites, loadServerFavorites } = useFavorites();
  const { playStream, state: videoState } = useGlobalVideo();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [heroStream, setHeroStream] = useState<any>(null);
  const [recentMovies, setRecentMovies] = useState<any[]>([]);
  const [recentSeries, setRecentSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didLoad = useRef(false);

  const loadData = useCallback(async () => {
    if (!username || !password) return;
    try {
      // Load all data in parallel
      const [histRes, moviesRes, seriesRes, liveRes] = await Promise.allSettled([
        api.getHistory(username),
        api.getRecentVod(username, password, 20),
        api.getRecentSeries(username, password, 20),
        api.getLiveStreams(username, password),
      ]);

      // History
      if (histRes.status === 'fulfilled') {
        const h = Array.isArray(histRes.value) ? histRes.value : [];
        setHistory(h);
      }

      // Movies
      if (moviesRes.status === 'fulfilled') {
        setRecentMovies(Array.isArray(moviesRes.value) ? moviesRes.value : []);
      }

      // Series
      if (seriesRes.status === 'fulfilled') {
        setRecentSeries(Array.isArray(seriesRes.value) ? seriesRes.value : []);
      }

      // Pick a hero stream from history or random live channel
      if (histRes.status === 'fulfilled' && Array.isArray(histRes.value) && histRes.value.length > 0) {
        setHeroStream(histRes.value[0]);
      } else if (liveRes.status === 'fulfilled' && Array.isArray(liveRes.value) && liveRes.value.length > 0) {
        const randomIdx = Math.floor(Math.random() * Math.min(liveRes.value.length, 10));
        setHeroStream(liveRes.value[randomIdx]);
      }

      // Sync favorites from server
      if (loadServerFavorites) {
        loadServerFavorites(username).catch(() => {});
      }

      didLoad.current = true;
    } catch (e) {
      console.error('Load data error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username, password]);

  // Load data when credentials are ready
  useEffect(() => {
    if (username && password) {
      loadData();
    }
  }, [username, password, loadData]);

  // Auto-play hero stream (muted) when no other stream is playing
  useEffect(() => {
    if (!heroStream || videoState.streamUrl || !username || !password) return;
    const autoPlay = async () => {
      try {
        const urlData = await api.getStreamUrl(
          username, password,
          heroStream.stream_id,
          heroStream.stream_type || 'live', 'ts'
        );
        playStream(
          urlData.url,
          heroStream.stream_name || heroStream.name || 'Featured',
          heroStream.stream_icon || '',
          '',
          heroStream.stream_id,
          heroStream.category_id || '',
          urlData.fallback_url || '',
        );
      } catch (e) { console.error('Hero auto-play error:', e); }
    };
    autoPlay();
  }, [heroStream, videoState.streamUrl, username, password]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

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
      router.push('/(tabs)/live');
    } catch (e) { console.error('Play error:', e); }
  };

  // Hero card (when no global player is showing a stream yet, or always as a fallback)
  const renderHeroCard = () => {
    if (!heroStream) return null;
    const name = heroStream.stream_name || heroStream.name || 'Featured Channel';
    const icon = heroStream.stream_icon || '';
    const catName = heroStream.category_name || 'Live TV';
    return (
      <TouchableOpacity
        testID="hero-card"
        style={styles.heroCard}
        activeOpacity={0.85}
        onPress={() => playLiveChannel(heroStream)}
      >
        <LinearGradient colors={['#1A1F3A', '#0D1225']} style={styles.heroGradient}>
          <View style={styles.heroInner}>
            {icon ? (
              <Image source={{ uri: icon }} style={styles.heroLogo} resizeMode="contain" />
            ) : (
              <View style={[styles.heroLogoPlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
                <Ionicons name="tv" size={32} color={colors.primary} />
              </View>
            )}
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroChannelName} numberOfLines={1}>{name}</Text>
              <Text style={styles.heroCatName}>{catName}</Text>
              <View style={styles.heroLiveBadge}>
                <View style={styles.heroLiveDot} />
                <Text style={styles.heroLiveText}>LIVE</Text>
              </View>
            </View>
            <View style={styles.heroPlayBtn}>
              <Ionicons name="play" size={28} color="#fff" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
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

        {/* Hero Card (shows when global player isn't visible) */}
        {!videoState.streamUrl && renderHeroCard()}

        {/* Favorites */}
        {favorites.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={18} color="#FFD700" />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginLeft: 6 }]}>Favorites</Text>
            </View>
            <FlatList
              horizontal showsHorizontalScrollIndicator={false}
              data={favorites}
              keyExtractor={(item) => `fav-${item.stream_id}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  testID={`home-fav-${index}`}
                  style={[styles.channelCard, { backgroundColor: colors.surface }]}
                  activeOpacity={0.7}
                  onPress={() => playLiveChannel({ stream_id: item.stream_id, stream_name: item.name, stream_icon: item.stream_icon, category_id: item.category_id })}
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
              horizontal showsHorizontalScrollIndicator={false}
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
                  <Text style={[styles.channelCardName, { color: colors.textPrimary }]} numberOfLines={1}>{item.stream_name || item.name}</Text>
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
              horizontal showsHorizontalScrollIndicator={false}
              data={recentMovies}
              keyExtractor={(item, i) => `movie-${item.stream_id || i}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.posterCard} activeOpacity={0.8}>
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
              horizontal showsHorizontalScrollIndicator={false}
              data={recentSeries}
              keyExtractor={(item, i) => `series-${item.series_id || i}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.posterCard} activeOpacity={0.8}>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800' },

  // Hero card
  heroCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  heroGradient: { padding: 20, borderRadius: 16 },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroLogo: { width: 72, height: 72, borderRadius: 14 },
  heroLogoPlaceholder: { width: 72, height: 72, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  heroTextWrap: { flex: 1 },
  heroChannelName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroCatName: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 3 },
  heroLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: '#E50914', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  heroLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  heroLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  heroPlayBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
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
  posterPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 12, padding: 8 },
  posterPlaceholderText: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, padding: 20, borderRadius: 12 },
  emptyRowText: { fontSize: 14 },
});
