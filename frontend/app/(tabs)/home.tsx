import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, ActivityIndicator, Dimensions, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/utils/api';

const { width } = Dimensions.get('window');
const MOVIE_CARD_WIDTH = (width - 48 - 24) / 2.5;
const CHANNEL_CARD_WIDTH = (width - 48 - 12) / 2;

export default function HomeScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
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
      if (histData.status === 'fulfilled') setHistory(histData.value || []);
      if (moviesData.status === 'fulfilled') setRecentMovies(moviesData.value || []);
      if (seriesData.status === 'fulfilled') setRecentSeries(seriesData.value || []);
    } catch (e) {
      console.error('Load data error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username, password]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const lastWatched = history.length > 0 ? history[0] : null;

  const playStream = (item: any, type: string = 'live') => {
    router.push({
      pathname: '/player',
      params: {
        streamId: String(item.stream_id),
        streamName: item.stream_name || item.name || 'Unknown',
        streamIcon: item.stream_icon || item.cover || '',
        streamType: type,
        categoryName: item.category_name || '',
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

        {/* Hero Player Area */}
        <View style={[styles.heroContainer, { backgroundColor: '#000' }]}>
          {lastWatched ? (
            <View style={styles.heroContent}>
              {lastWatched.stream_icon ? (
                <Image source={{ uri: lastWatched.stream_icon }} style={styles.heroLogo} resizeMode="contain" />
              ) : (
                <Ionicons name="tv-outline" size={56} color="#333" />
              )}
              <View style={styles.heroOverlay}>
                <View style={styles.heroLiveTag}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LAST WATCHED</Text>
                </View>
                <Text style={styles.heroChannelName} numberOfLines={1}>{lastWatched.stream_name}</Text>
                {lastWatched.category_name ? (
                  <Text style={styles.heroCategoryName}>{lastWatched.category_name}</Text>
                ) : null}
              </View>
              <TouchableOpacity testID="hero-play-btn" style={styles.heroPlayBtn} onPress={() => playStream(lastWatched, lastWatched.stream_type || 'live')}>
                <Ionicons name="play" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.heroEmpty}>
              <Ionicons name="tv-outline" size={48} color="#333" />
              <Text style={styles.heroEmptyText}>Start watching to see your last channel here</Text>
            </View>
          )}
        </View>

        {/* Recently Watched Live Channels */}
        {history.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recently Watched Live Channels</Text>
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
                >
                  <View style={styles.channelCardInner}>
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.channelCardImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={32} color={colors.textSecondary} />
                    )}
                  </View>
                  <Text style={[styles.channelCardNum, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.stream_id}
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
                  style={[styles.posterCard]}
                  activeOpacity={0.8}
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
                  style={[styles.posterCard]}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },

  // Hero
  heroContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    height: 200,
  },
  heroContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroLogo: { width: 80, height: 80, opacity: 0.3, position: 'absolute' },
  heroOverlay: { position: 'absolute', bottom: 16, left: 16, right: 80 },
  heroLiveTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,191,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00BFFF', marginRight: 6 },
  liveText: { color: '#00BFFF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  heroChannelName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroCategoryName: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  heroPlayBtn: {
    position: 'absolute', right: 20, bottom: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,191,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroEmptyText: { color: '#555', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },

  // Sections
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 14, fontWeight: '600' },
  horizontalList: { paddingHorizontal: 16, gap: 12 },

  // Recently watched channel cards
  channelCard: {
    width: CHANNEL_CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 12,
    alignItems: 'center',
  },
  channelCardInner: {
    width: '100%',
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelCardImg: { width: 80, height: 60 },
  channelCardNum: { fontSize: 13, fontWeight: '600', marginTop: 8 },

  // Movie/Series poster cards
  posterCard: {
    width: MOVIE_CARD_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  posterImg: { width: '100%', height: '100%' },
  posterPlaceholder: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
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
