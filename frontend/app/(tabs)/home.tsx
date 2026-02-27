import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
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
  const { favorites, loadServerFavorites } = useFavorites();
  const { playStream, state: videoState, setFullscreen } = useGlobalVideo();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [heroStream, setHeroStream] = useState<any>(null);
  const [recentMovies, setRecentMovies] = useState<any[]>([]);
  const [recentSeries, setRecentSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!username || !password) return;
    try {
      const [histRes, moviesRes, seriesRes, liveRes] = await Promise.allSettled([
        api.getHistory(username),
        api.getRecentVod(username, password, 20),
        api.getRecentSeries(username, password, 20),
        api.getLiveStreams(username, password),
      ]);
      if (histRes.status === 'fulfilled') {
        const h = Array.isArray(histRes.value) ? histRes.value : [];
        setHistory(h);
        if (h.length > 0) setHeroStream(h[0]);
      }
      if (!heroStream && liveRes.status === 'fulfilled' && Array.isArray(liveRes.value) && liveRes.value.length > 0) {
        const r = Math.floor(Math.random() * Math.min(liveRes.value.length, 10));
        setHeroStream(liveRes.value[r]);
      }
      if (moviesRes.status === 'fulfilled') setRecentMovies(Array.isArray(moviesRes.value) ? moviesRes.value : []);
      if (seriesRes.status === 'fulfilled') setRecentSeries(Array.isArray(seriesRes.value) ? seriesRes.value : []);
      if (loadServerFavorites) loadServerFavorites(username).catch(() => {});
    } catch (e) { console.error('Load error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [username, password]);

  useEffect(() => { if (username && password) loadData(); }, [username, password, loadData]);

  // Play hero channel -> start stream and go fullscreen
  const playHeroFullscreen = async () => {
    if (!heroStream) return;
    try {
      const urlData = await api.getStreamUrl(username, password, heroStream.stream_id, heroStream.stream_type || 'live', 'ts');
      playStream(urlData.url, heroStream.stream_name || heroStream.name || '', heroStream.stream_icon || '', '', heroStream.stream_id, heroStream.category_id || '', urlData.fallback_url || '');
      setFullscreen(true);
    } catch (e) { console.error('Hero play error:', e); }
  };

  // Play a channel from favorites/history -> navigate to live tab
  const playChannel = async (item: any) => {
    try {
      const urlData = await api.getStreamUrl(username, password, item.stream_id, item.stream_type || 'live', 'ts');
      playStream(urlData.url, item.stream_name || item.name || '', item.stream_icon || '', '', item.stream_id, item.category_id || '', urlData.fallback_url || '');
      router.push('/(tabs)/live');
    } catch (e) { console.error('Play error:', e); }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Elite Wave</Text>
          <TouchableOpacity testID="settings-btn" onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Hero Card - dark card with play button */}
        {heroStream && (
          <TouchableOpacity testID="hero-card" style={[styles.heroCard, { backgroundColor: colors.surface }]} activeOpacity={0.85} onPress={playHeroFullscreen}>
            <View style={styles.heroInner}>
              {heroStream.stream_icon ? (
                <Image source={{ uri: heroStream.stream_icon }} style={styles.heroLogo} resizeMode="contain" />
              ) : null}
              <View style={styles.heroTextWrap}>
                <View style={styles.heroLiveBadge}>
                  <View style={styles.heroLiveDot} />
                  <Text style={styles.heroLiveText}>LIVE</Text>
                </View>
                <Text style={[styles.heroName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {heroStream.stream_name || heroStream.name || 'Featured'}
                </Text>
                <Text style={[styles.heroCat, { color: colors.textSecondary }]}>
                  {heroStream.category_name || 'USA'}
                </Text>
              </View>
              <View style={styles.heroPlayBtn}>
                <Ionicons name="play" size={28} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Favorites</Text>
            <FlatList horizontal showsHorizontalScrollIndicator={false} data={favorites}
              keyExtractor={(item) => `fav-${item.stream_id}`} contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.chCard, { backgroundColor: colors.surface }]} onPress={() => playChannel({ stream_id: item.stream_id, stream_name: item.name, stream_icon: item.stream_icon, category_id: item.category_id })}>
                  <View style={styles.chCardInner}>
                    {item.stream_icon ? <Image source={{ uri: item.stream_icon }} style={styles.chCardImg} resizeMode="contain" /> : <Ionicons name="tv-outline" size={24} color={colors.textSecondary} />}
                  </View>
                  <Text style={[styles.chCardName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Recently Watched */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recently Watched</Text>
            <FlatList horizontal showsHorizontalScrollIndicator={false} data={history.slice(0, 10)}
              keyExtractor={(item, i) => `hist-${i}`} contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.chCard, { backgroundColor: colors.surface }]} onPress={() => playChannel(item)}>
                  <View style={styles.chCardInner}>
                    {item.stream_icon ? <Image source={{ uri: item.stream_icon }} style={styles.chCardImg} resizeMode="contain" /> : <Ionicons name="tv-outline" size={24} color={colors.textSecondary} />}
                  </View>
                  <Text style={[styles.chCardName, { color: colors.textPrimary }]} numberOfLines={1}>{item.stream_name || item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Last Added Movies */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Last Added Movies</Text>
            <TouchableOpacity style={styles.seeAllBtn} onPress={() => router.push('/(tabs)/vod')}>
              <Text style={[styles.seeAllText, { color: colors.textSecondary }]}>See All</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {recentMovies.length > 0 ? (
            <FlatList horizontal showsHorizontalScrollIndicator={false} data={recentMovies}
              keyExtractor={(item, i) => `m-${item.stream_id || i}`} contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.posterCard}>
                  {item.stream_icon ? <Image source={{ uri: item.stream_icon }} style={styles.posterImg} resizeMode="cover" /> :
                    <View style={[styles.posterPH, { backgroundColor: colors.surfaceHighlight }]}><Ionicons name="film-outline" size={28} color={colors.textSecondary} /><Text style={[styles.posterPHText, { color: colors.textSecondary }]} numberOfLines={2}>{item.name}</Text></View>}
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={[styles.emptyRow, { backgroundColor: colors.surface }]}><Ionicons name="film-outline" size={24} color={colors.textSecondary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>No movies available</Text></View>
          )}
        </View>

        {/* Last Added Series */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Last Added Series</Text>
            <TouchableOpacity style={styles.seeAllBtn} onPress={() => router.push('/(tabs)/series')}>
              <Text style={[styles.seeAllText, { color: colors.textSecondary }]}>See All</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {recentSeries.length > 0 ? (
            <FlatList horizontal showsHorizontalScrollIndicator={false} data={recentSeries}
              keyExtractor={(item, i) => `s-${item.series_id || i}`} contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.posterCard}>
                  {item.cover ? <Image source={{ uri: item.cover }} style={styles.posterImg} resizeMode="cover" /> :
                    <View style={[styles.posterPH, { backgroundColor: colors.surfaceHighlight }]}><Ionicons name="albums-outline" size={28} color={colors.textSecondary} /><Text style={[styles.posterPHText, { color: colors.textSecondary }]} numberOfLines={2}>{item.name}</Text></View>}
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={[styles.emptyRow, { backgroundColor: colors.surface }]}><Ionicons name="albums-outline" size={24} color={colors.textSecondary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>No series available</Text></View>
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800' },

  // Hero card - matches old design
  heroCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 24, padding: 20 },
  heroInner: { flexDirection: 'row', alignItems: 'center' },
  heroLogo: { width: 64, height: 64, borderRadius: 12, marginRight: 14 },
  heroTextWrap: { flex: 1 },
  heroLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E50914', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 8 },
  heroLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  heroLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  heroName: { fontSize: 18, fontWeight: '800' },
  heroCat: { fontSize: 13, marginTop: 3 },
  heroPlayBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#00B4D8', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },

  section: { marginBottom: 24, paddingHorizontal: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 14, fontWeight: '600' },
  hList: { gap: 12 },
  chCard: { width: 100, borderRadius: 12, padding: 10, alignItems: 'center' },
  chCardInner: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'center' },
  chCardImg: { width: 60, height: 44 },
  chCardName: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  posterCard: { width: MOVIE_CARD_WIDTH, aspectRatio: 2 / 3, borderRadius: 12, overflow: 'hidden' },
  posterImg: { width: '100%', height: '100%' },
  posterPH: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 8 },
  posterPHText: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 20, borderRadius: 12 },
  emptyText: { fontSize: 14 },
});
