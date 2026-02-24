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

export default function HomeScreen() {
  const { colors } = useTheme();
  const { username, password, userInfo } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [histData, favData, liveData] = await Promise.allSettled([
        api.getHistory(username),
        api.getFavorites(username),
        api.getLiveStreams(username, password),
      ]);
      if (histData.status === 'fulfilled') setHistory(histData.value || []);
      if (favData.status === 'fulfilled') setFavorites(favData.value || []);
      if (liveData.status === 'fulfilled') {
        const streams = liveData.value || [];
        setLiveStreams(streams.slice(0, 20));
      }
    } catch (e) {
      console.error('Load data error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username, password]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const lastWatched = history.length > 0 ? history[0] : null;

  const renderChannelItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      testID={`home-channel-${index}`}
      style={[styles.channelRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.7}
    >
      <View style={[styles.channelLogo, { backgroundColor: colors.surfaceHighlight }]}>
        {item.stream_icon ? (
          <Image source={{ uri: item.stream_icon }} style={styles.channelLogoImg} resizeMode="contain" />
        ) : (
          <Ionicons name="tv-outline" size={20} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.channelInfo}>
        <Text style={[styles.channelNum, { color: colors.primary }]}>{item.num || index + 1}</Text>
        <View style={styles.channelTextWrap}>
          <Text style={[styles.channelName, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.epg_channel_id ? (
            <Text style={[styles.channelEpg, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.epg_channel_id}
            </Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="play-circle" size={28} color={colors.primary} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View style={[styles.heroContainer, { backgroundColor: colors.surface }]}>
          <View style={[styles.heroPlayer, { backgroundColor: '#000' }]}>
            {lastWatched ? (
              <View style={styles.heroContent}>
                {lastWatched.stream_icon ? (
                  <Image source={{ uri: lastWatched.stream_icon }} style={styles.heroLogo} resizeMode="contain" />
                ) : null}
                <View style={styles.heroOverlay}>
                  <View style={styles.heroLiveTag}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LAST WATCHED</Text>
                  </View>
                  <Text style={styles.heroChannelName}>{lastWatched.stream_name}</Text>
                  <Text style={styles.heroCategoryName}>{lastWatched.category_name}</Text>
                </View>
                <TouchableOpacity testID="hero-play-btn" style={styles.heroPlayBtn}>
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
        </View>

        {/* Recently Watched */}
        {history.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recently Watched</Text>
              <TouchableOpacity testID="clear-history-btn" onPress={async () => {
                await api.clearHistory(username);
                setHistory([]);
              }}>
                <Text style={[styles.clearText, { color: colors.primary }]}>Clear</Text>
              </TouchableOpacity>
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
                  style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.historyIcon, { backgroundColor: colors.surfaceHighlight }]}>
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.historyIconImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={24} color={colors.textSecondary} />
                    )}
                  </View>
                  <Text style={[styles.historyName, { color: colors.textPrimary }]} numberOfLines={1}>{item.stream_name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Favorites</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={favorites.slice(0, 10)}
              keyExtractor={(item, i) => `fav-${i}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  testID={`favorite-item-${index}`}
                  style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.historyIcon, { backgroundColor: colors.surfaceHighlight }]}>
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.historyIconImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="heart" size={24} color={colors.primary} />
                    )}
                  </View>
                  <Text style={[styles.historyName, { color: colors.textPrimary }]} numberOfLines={1}>{item.stream_name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Now on TV */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Now on TV</Text>
          {liveStreams.length > 0 ? (
            liveStreams.map((item, index) => renderChannelItem({ item, index }))
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="tv-outline" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No channels available</Text>
            </View>
          )}
        </View>

        <View style={{ height: 20 }} />
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
  heroContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroPlayer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLogo: {
    width: 80,
    height: 80,
    opacity: 0.3,
    position: 'absolute',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  heroLiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,191,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00BFFF', marginRight: 6 },
  liveText: { color: '#00BFFF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  heroChannelName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroCategoryName: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  heroPlayBtn: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,191,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroEmpty: { alignItems: 'center', gap: 8 },
  heroEmptyText: { color: '#555', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  clearText: { fontSize: 14, fontWeight: '600' },
  horizontalList: { paddingHorizontal: 16, gap: 12 },
  historyCard: {
    width: 90,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyIconImg: { width: 40, height: 40, borderRadius: 20 },
  historyName: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  channelLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  channelLogoImg: { width: 36, height: 36 },
  channelInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  channelNum: { fontSize: 14, fontWeight: '700', marginRight: 10 },
  channelTextWrap: { flex: 1 },
  channelName: { fontSize: 14, fontWeight: '600' },
  channelEpg: { fontSize: 12, marginTop: 2 },
  emptyState: {
    marginHorizontal: 16,
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 14 },
});
