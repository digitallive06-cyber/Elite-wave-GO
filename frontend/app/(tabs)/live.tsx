import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, RefreshControl, Dimensions, Animated, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/utils/api';

const { width: SCREEN_W } = Dimensions.get('window');

export default function LiveScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [epgData, setEpgData] = useState<{ [key: number]: any }>({});

  // Inline player state
  const [activeChannel, setActiveChannel] = useState<any>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerEpg, setPlayerEpg] = useState<{ current: any; next: any } | null>(null);
  const [playerProgress, setPlayerProgress] = useState(0);

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.getLiveCategories(username, password);
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [username, password]);

  const loadStreams = useCallback(async (catId?: string) => {
    setLoadingStreams(true);
    try {
      const data = await api.getLiveStreams(username, password, catId);
      const arr = Array.isArray(data) ? data : [];
      setStreams(arr);
      setFilteredStreams(arr);
      // Load EPG for ALL channels with epg_channel_id (batch of 20)
      loadEpgBatch(arr.filter(s => s.epg_channel_id).slice(0, 20));
    } catch (e) { console.error(e); }
    finally { setLoadingStreams(false); setRefreshing(false); }
  }, [username, password]);

  const loadEpgBatch = async (streamList: any[]) => {
    const ids = streamList.filter(s => s.epg_channel_id).map(s => s.stream_id);
    if (ids.length === 0) return;
    try {
      const batchData = await api.getBatchEpg(username, password, ids);
      const epgMap: { [key: number]: any } = {};
      const now = Math.floor(Date.now() / 1000);
      for (const [sid, data] of Object.entries(batchData) as any) {
        const listings = data?.epg_listings || [];
        if (listings.length > 0) {
          const current = listings.find((e: any) => {
            const start = new Date(e.start).getTime() / 1000;
            const end = new Date(e.end).getTime() / 1000;
            return now >= start && now <= end;
          });
          const next = listings.find((e: any) => {
            const start = new Date(e.start).getTime() / 1000;
            return start > now;
          });
          let progress = 0;
          if (current) {
            const start = new Date(current.start).getTime() / 1000;
            const end = new Date(current.end).getTime() / 1000;
            progress = Math.min(Math.max((now - start) / (end - start), 0), 1);
          }
          epgMap[parseInt(sid)] = { current, next, progress };
        }
      }
      setEpgData(prev => ({ ...prev, ...epgMap }));
    } catch (e) { console.error('Batch EPG error:', e); }
  };

  useEffect(() => {
    Promise.all([loadCategories(), loadStreams()]).then(() => setLoading(false));
  }, [loadCategories, loadStreams]);

  useEffect(() => {
    if (search.trim()) {
      setFilteredStreams(streams.filter(s =>
        s.name?.toLowerCase().includes(search.toLowerCase())
      ));
    } else {
      setFilteredStreams(streams);
    }
  }, [search, streams]);

  const selectCategory = (catId: string | null) => {
    setSelectedCategory(catId);
    setSearch('');
    setEpgData({});
    loadStreams(catId || undefined);
  };

  // Play channel inline (hero preview)
  const playChannelInline = async (item: any) => {
    setActiveChannel(item);
    setPlayerLoading(true);
    setPlayerEpg(null);
    try {
      const data = await api.getStreamUrl(username, password, item.stream_id, 'live', 'ts');
      setStreamUrl(data.url);
      // Save history
      const cat = categories.find(c => c.category_id === item.category_id);
      api.addHistory({
        username,
        stream_id: item.stream_id,
        stream_name: item.name,
        stream_icon: item.stream_icon || '',
        stream_type: 'live',
        category_name: cat?.category_name || '',
      }).catch(() => {});
      // Load EPG for this channel
      const epg = await api.getEpg(username, password, item.stream_id).catch(() => null);
      if (epg?.epg_listings?.length > 0) {
        const now = Math.floor(Date.now() / 1000);
        const current = epg.epg_listings.find((e: any) => {
          const start = new Date(e.start).getTime() / 1000;
          const end = new Date(e.end).getTime() / 1000;
          return now >= start && now <= end;
        });
        const next = epg.epg_listings.find((e: any) => {
          const start = new Date(e.start).getTime() / 1000;
          return start > now;
        });
        setPlayerEpg({ current: current || null, next: next || null });
        if (current) {
          const start = new Date(current.start).getTime() / 1000;
          const end = new Date(current.end).getTime() / 1000;
          setPlayerProgress(Math.min(Math.max((now - start) / (end - start), 0), 1));
        }
      }
    } catch (e) { console.error(e); }
    finally { setPlayerLoading(false); }
  };

  // Go fullscreen (navigate to player screen)
  const goFullscreen = () => {
    if (!activeChannel) return;
    const cat = categories.find(c => c.category_id === activeChannel.category_id);
    router.push({
      pathname: '/player',
      params: {
        streamId: String(activeChannel.stream_id),
        streamName: activeChannel.name,
        streamIcon: activeChannel.stream_icon || '',
        streamType: 'live',
        categoryName: cat?.category_name || '',
        categoryId: selectedCategory || activeChannel.category_id || '',
        containerExtension: 'ts',
      },
    });
  };

  // Video player for inline preview
  const inlinePlayer = useVideoPlayer(streamUrl || '', (p) => {
    if (streamUrl) p.play();
  });

  const { isPlaying } = useEvent(inlinePlayer, 'playingChange', { isPlaying: inlinePlayer.playing });

  const formatTime = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const renderChannel = ({ item, index }: { item: any; index: number }) => {
    const epg = epgData[item.stream_id];
    const isActive = activeChannel?.stream_id === item.stream_id;
    return (
      <TouchableOpacity
        testID={`live-channel-${index}`}
        style={[
          styles.channelRow,
          { backgroundColor: isActive ? colors.primary + '15' : colors.surface, borderColor: isActive ? colors.primary : colors.border },
        ]}
        activeOpacity={0.7}
        onPress={() => playChannelInline(item)}
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
            <Text style={[styles.channelName, { color: isActive ? colors.primary : colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
            {/* What's on now */}
            {epg?.current?.title ? (
              <View style={styles.epgCurrentRow}>
                <View style={[styles.epgLiveDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.epgCurrentText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {epg.current.title}
                </Text>
              </View>
            ) : null}
            {/* Progress bar */}
            {epg?.current ? (
              <View style={[styles.epgProgressBar, { backgroundColor: colors.border }]}>
                <View style={[styles.epgProgressFill, { width: `${(epg.progress || 0) * 100}%`, backgroundColor: colors.primary }]} />
              </View>
            ) : null}
            {/* What's next */}
            {epg?.next?.title ? (
              <View style={styles.epgNextRow}>
                <Text style={[styles.epgNextLabel, { color: colors.textSecondary }]}>Next: </Text>
                <Text style={[styles.epgNextText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {epg.next.title}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {isActive ? (
          <View style={[styles.nowPlayingBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="radio" size={12} color="#fff" />
          </View>
        ) : (
          <Ionicons name="play-circle" size={28} color={colors.primary} style={{ marginLeft: 8 }} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Inline Hero Player (when a channel is active) */}
      {activeChannel && (
        <View style={styles.inlinePlayerSection}>
          <View style={styles.inlinePlayerWrap}>
            {playerLoading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color="#00BFFF" />
              </View>
            ) : streamUrl ? (
              <TouchableOpacity activeOpacity={0.95} onPress={goFullscreen} style={styles.inlineVideoTouch}>
                <VideoView
                  testID="inline-video-player"
                  style={styles.inlineVideo}
                  player={inlinePlayer}
                  contentFit="contain"
                  nativeControls={false}
                />
              </TouchableOpacity>
            ) : null}
            {/* Overlay info */}
            <View style={styles.inlineOverlay}>
              <View style={styles.inlineInfoRow}>
                {activeChannel.stream_icon ? (
                  <Image source={{ uri: activeChannel.stream_icon }} style={styles.inlineIcon} resizeMode="contain" />
                ) : null}
                <View style={styles.inlineInfoText}>
                  <Text style={styles.inlineChannelName} numberOfLines={1}>{activeChannel.name}</Text>
                  {playerEpg?.current?.title ? (
                    <Text style={styles.inlineProgramName} numberOfLines={1}>{playerEpg.current.title}</Text>
                  ) : null}
                </View>
                <View style={styles.inlineLiveBadge}>
                  <Text style={styles.inlineLiveText}>LIVE</Text>
                </View>
              </View>
              {/* Progress */}
              {playerEpg?.current && (
                <View style={styles.inlineProgress}>
                  <View style={styles.inlineProgressBar}>
                    <View style={[styles.inlineProgressFill, { width: `${playerProgress * 100}%` }]} />
                  </View>
                </View>
              )}
            </View>
            {/* Controls */}
            <View style={styles.inlineControls}>
              <TouchableOpacity testID="inline-play-btn" style={styles.inlineControlBtn} onPress={() => {
                if (inlinePlayer.playing) inlinePlayer.pause(); else inlinePlayer.play();
              }}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="inline-fullscreen-btn" style={styles.inlineControlBtn} onPress={goFullscreen}>
                <Ionicons name="expand" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Title */}
      {!activeChannel && (
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Live TV</Text>
      )}

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="live-search-input"
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search channels..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Categories */}
      <View style={styles.catSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ category_id: null, category_name: 'All' }, ...categories]}
          keyExtractor={(item, i) => `cat-${i}`}
          contentContainerStyle={styles.catList}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`live-cat-${item.category_id || 'all'}`}
              style={[
                styles.catChip,
                {
                  backgroundColor: selectedCategory === item.category_id ? colors.primary : colors.surface,
                  borderColor: selectedCategory === item.category_id ? colors.primary : colors.border,
                },
              ]}
              onPress={() => selectCategory(item.category_id)}
            >
              <Text style={[
                styles.catChipText,
                { color: selectedCategory === item.category_id ? '#fff' : colors.textPrimary },
              ]}>
                {item.category_name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* TV Guide header */}
      <View style={styles.guideHeader}>
        <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
          {activeChannel ? 'TV Guide' : `${filteredStreams.length} channels`}
        </Text>
      </View>

      {/* Channel List (TV Guide) */}
      {loadingStreams ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredStreams}
          keyExtractor={(item, i) => `stream-${item.stream_id || i}`}
          renderItem={renderChannel}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            setEpgData({});
            loadStreams(selectedCategory || undefined);
          }} tintColor={colors.primary} />}
          onEndReached={() => {
            const loaded = Object.keys(epgData).map(Number);
            const needEpg = filteredStreams.filter(s => s.epg_channel_id && !loaded.includes(s.stream_id));
            if (needEpg.length > 0) loadEpgBatch(needEpg.slice(0, 20));
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="tv-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No channels found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const PLAYER_HEIGHT = Math.min(SCREEN_W * 9 / 16, 240);

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },

  // Inline player
  inlinePlayerSection: { backgroundColor: '#000' },
  inlinePlayerWrap: { width: '100%', height: PLAYER_HEIGHT, position: 'relative' },
  inlineLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  inlineVideoTouch: { flex: 1 },
  inlineVideo: { width: '100%', height: '100%' },
  inlineOverlay: {
    position: 'absolute', bottom: 36, left: 12, right: 12,
  },
  inlineInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineIcon: { width: 32, height: 32, borderRadius: 6 },
  inlineInfoText: { flex: 1 },
  inlineChannelName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  inlineProgramName: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  inlineLiveBadge: {
    backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 3,
  },
  inlineLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  inlineProgress: { marginTop: 6 },
  inlineProgressBar: { height: 2, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1 },
  inlineProgressFill: { height: '100%', backgroundColor: '#00BFFF', borderRadius: 1 },
  inlineControls: {
    position: 'absolute', bottom: 6, right: 8,
    flexDirection: 'row', gap: 4,
  },
  inlineControlBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingHorizontal: 14,
    height: 44, borderRadius: 12, borderWidth: 1, marginBottom: 8, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },

  // Categories
  catSection: { height: 44, marginBottom: 4 },
  catList: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    height: 36, justifyContent: 'center',
  },
  catChipText: { fontSize: 13, fontWeight: '600' },

  // Guide header
  guideHeader: { paddingHorizontal: 20, paddingVertical: 6 },
  guideTitle: { fontSize: 14, fontWeight: '700' },

  // Channel rows
  channelRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 12,
    borderRadius: 12, marginBottom: 6, borderWidth: 1,
  },
  channelLogo: {
    width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  channelLogoImg: { width: 40, height: 40 },
  channelInfo: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', marginLeft: 12 },
  channelNum: { fontSize: 14, fontWeight: '700', marginRight: 8, marginTop: 2, minWidth: 22 },
  channelTextWrap: { flex: 1 },
  channelName: { fontSize: 14, fontWeight: '700' },

  // EPG in channel list
  epgCurrentRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  epgLiveDot: { width: 6, height: 6, borderRadius: 3 },
  epgCurrentText: { fontSize: 12, flex: 1 },
  epgProgressBar: { height: 3, borderRadius: 2, marginTop: 4, marginBottom: 4 },
  epgProgressFill: { height: '100%', borderRadius: 2 },
  epgNextRow: { flexDirection: 'row', alignItems: 'center' },
  epgNextLabel: { fontSize: 11, fontWeight: '600' },
  epgNextText: { fontSize: 11, fontStyle: 'italic', flex: 1 },

  nowPlayingBadge: {
    width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },

  emptyState: { margin: 16, padding: 40, borderRadius: 12, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14 },
});
