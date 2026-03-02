import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, ActivityIndicator, Dimensions, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useFavorites } from '../../src/contexts/FavoritesContext';
import { useGlobalVideo } from '../../src/contexts/GlobalVideoContext';
import { api } from '../../src/utils/api';
import { useUpdateChecker } from '../../src/utils/useUpdateChecker';

const { width } = Dimensions.get('window');
const MOVIE_CARD_WIDTH = (width - 48 - 24) / 2.5;
const STATUS_BAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

export default function HomeScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const { favorites, loadServerFavorites } = useFavorites();
  const { playStream, stopStream, state: videoState, setFullscreen, setStreamList } = useGlobalVideo();
  const router = useRouter();
  const heroVideoRef = useRef<Video>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [heroStream, setHeroStream] = useState<any>(null);
  const [heroVideoUrl, setHeroVideoUrl] = useState<string | null>(null);
  const [recentMovies, setRecentMovies] = useState<any[]>([]);
  const [recentSeries, setRecentSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lock Home screen to portrait and stop any active stream when Home gains focus
  useFocusEffect(
    useCallback(() => {
      // Stop any playing global stream when returning to Home
      stopStream();
      // Lock to portrait
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    }, [stopStream])
  );

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

  // Fetch hero stream URL for auto-play preview - use .ts format for best compat
  useEffect(() => {
    if (!heroStream || !username || !password) return;
    (async () => {
      try {
        const data = await api.getStreamUrl(username, password, heroStream.stream_id, 'live', 'ts');
        // Use the direct .ts URL for best compatibility with expo-av
        setHeroVideoUrl(data.ts_url || data.fallback_url || data.url);
      } catch (e) { console.error('Hero URL error:', e); }
    })();
  }, [heroStream, username, password]);

  // Play hero channel -> stop local preview, start global player fullscreen
  const playHeroFullscreen = async () => {
    if (!heroStream) return;
    try {
      // Stop and unload the local preview first
      if (heroVideoRef.current) {
        await heroVideoRef.current.stopAsync().catch(() => {});
        await heroVideoRef.current.unloadAsync().catch(() => {});
      }
      const url = heroVideoUrl || (await api.getStreamUrl(username, password, heroStream.stream_id, 'live', 'ts')).url;
      playStream(url, heroStream.stream_name || heroStream.name || '', heroStream.stream_icon || '', '', heroStream.stream_id, heroStream.category_id || '', '');
      setFullscreen(true);
      // Load stream list for channel up/down navigation
      api.getLiveStreams(username, password).then(streams => {
        if (Array.isArray(streams)) setStreamList(streams);
      }).catch(() => {});
    } catch (e) { console.error('Hero play error:', e); }
  };

  // Play a channel from favorites/history -> play fullscreen directly
  const playChannel = async (item: any) => {
    try {
      if (heroVideoRef.current) {
        await heroVideoRef.current.stopAsync().catch(() => {});
        await heroVideoRef.current.unloadAsync().catch(() => {});
      }
      const urlData = await api.getStreamUrl(username, password, item.stream_id, item.stream_type || 'live', 'ts');
      playStream(urlData.url, item.stream_name || item.name || '', item.stream_icon || '', '', item.stream_id, item.category_id || '', urlData.fallback_url || '');
      setFullscreen(true);
      // Load stream list for channel up/down navigation in fullscreen
      api.getLiveStreams(username, password).then(streams => {
        if (Array.isArray(streams)) setStreamList(streams);
      }).catch(() => {});
    } catch (e) { console.error('Play error:', e); }
  };

  // Hero video plays only when no global stream is active
  const showHeroVideo = !!heroVideoUrl && !videoState.streamUrl;
  const hasActiveStream = !!videoState.streamUrl;

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
        {/* Header - with safe area padding to avoid status bar overlap */}
        <View style={[styles.header, { paddingTop: STATUS_BAR_H + 12 }]}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Elite Wave</Text>
          <TouchableOpacity testID="settings-btn" onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Hero Card with auto-play video preview */}
        {heroStream && (
          <TouchableOpacity
            testID="hero-card"
            style={styles.heroCard}
            activeOpacity={0.85}
            onPress={playHeroFullscreen}
          >
            {/* Live video preview - muted, auto-plays when no global stream is active */}
            {showHeroVideo ? (
              <Video
                ref={heroVideoRef}
                source={{ uri: heroVideoUrl! }}
                style={styles.heroVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isMuted={true}
                isLooping={false}
                onError={(e: any) => console.warn('Hero video error:', e)}
              />
            ) : heroStream.stream_icon ? (
              <Image source={{ uri: heroStream.stream_icon }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImagePlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
                <Ionicons name="tv" size={48} color={colors.textSecondary} />
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)']}
              style={styles.heroGradient}
            >
              <View style={styles.heroOverlayContent}>
                <View style={styles.heroLeftCol}>
                  <View style={styles.heroLiveBadge}>
                    <View style={styles.heroLiveDot} />
                    <Text style={styles.heroLiveText}>LIVE</Text>
                  </View>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {heroStream.stream_name || heroStream.name || 'Featured'}
                  </Text>
                  <Text style={styles.heroCat}>
                    {heroStream.category_name || 'USA'}
                  </Text>
                </View>
                <View style={styles.heroRightCol}>
                  <View style={styles.heroPlayBtn}>
                    <Ionicons name="play" size={28} color="#fff" />
                  </View>
                  {heroStream.stream_icon ? (
                    <Image source={{ uri: heroStream.stream_icon }} style={styles.heroSmallLogo} resizeMode="contain" />
                  ) : null}
                </View>
              </View>
            </LinearGradient>
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
            <View style={[styles.emptyRow, { backgroundColor: colors.surface }]}><Ionicons name="film-outline" size={24} color={colors.textSecondary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nothing in this section</Text></View>
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
            <View style={[styles.emptyRow, { backgroundColor: colors.surface }]}><Ionicons name="albums-outline" size={24} color={colors.textSecondary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nothing in this section</Text></View>
          )}
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Continue Watching mini-player banner */}
      {!hasActiveStream && history.length > 0 && (
        <TouchableOpacity
          testID="continue-watching-banner"
          style={[styles.cwBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.85}
          onPress={() => playChannel(history[0])}
        >
          <View style={styles.cwLeft}>
            {history[0]?.stream_icon ? (
              <Image source={{ uri: history[0].stream_icon }} style={styles.cwIcon} resizeMode="contain" />
            ) : (
              <View style={[styles.cwIconPlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
                <Ionicons name="tv" size={18} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.cwTextWrap}>
              <Text style={[styles.cwTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {history[0]?.stream_name || history[0]?.name || 'Last Channel'}
              </Text>
              <Text style={[styles.cwSub, { color: colors.textSecondary }]}>Tap to resume watching</Text>
            </View>
          </View>
          <View style={styles.cwPlayBtn}>
            <Ionicons name="play" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800' },

  heroCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 24, height: 220, position: 'relative', backgroundColor: '#000' },
  heroVideo: { width: '100%', height: '100%' },
  heroImage: { width: '100%', height: '100%' },
  heroImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 60 },
  heroOverlayContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroLeftCol: { flex: 1, marginRight: 16 },
  heroLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E50914', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 8 },
  heroLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  heroLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroCat: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  heroRightCol: { alignItems: 'center', gap: 8 },
  heroPlayBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#00B4D8', justifyContent: 'center', alignItems: 'center' },
  heroSmallLogo: { width: 32, height: 32, borderRadius: 6 },

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

  cwBanner: {
    position: 'absolute', bottom: 0, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, borderWidth: 1, padding: 12, paddingRight: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
  },
  cwLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  cwIcon: { width: 40, height: 40, borderRadius: 8 },
  cwIconPlaceholder: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cwTextWrap: { flex: 1 },
  cwTitle: { fontSize: 14, fontWeight: '700' },
  cwSub: { fontSize: 11, marginTop: 2 },
  cwPlayBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#00B4D8', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
});
