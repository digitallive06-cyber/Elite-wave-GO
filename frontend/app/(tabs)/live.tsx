import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useFavorites } from '../../src/contexts/FavoritesContext';
import { useGlobalVideo } from '../../src/contexts/GlobalVideoContext';
import { api } from '../../src/utils/api';

const STATUS_BAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const getDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function LiveScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const { playStream, stopStream, state: videoState, setStreamList, setLiveGuideActive } = useGlobalVideo();

  // Active channel is tracked via global video state
  const activeStreamId = videoState.streamId;

  const [categories, setCategories] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [epgData, setEpgData] = useState<{ [key: number]: any }>({});

  // TV guide state
  const [showGuide, setShowGuide] = useState(false);
  const [channelFullEpg, setChannelFullEpg] = useState<any[]>([]);
  const [epgLoading, setEpgLoading] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState(getDateStr(new Date()));

  // Reset guide view when leaving the Live tab
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Tab lost focus -> reset to channel list view
        setShowGuide(false);
        setLiveGuideActive(false);
      };
    }, [setLiveGuideActive])
  );

  // Date options for guide
  const dateOptions = useMemo(() => {
    const today = new Date();
    const options = [];
    for (let i = -1; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      options.push({
        label: i === 0 ? 'Today' : i === -1 ? 'Yesterday'
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        value: getDateStr(d),
        isToday: i === 0,
      });
    }
    return options;
  }, []);

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
      setStreamList(arr); // Push to global context for channel up/down
      // Load EPG for ALL channels with guide data, in batches of 30
      const withEpg = arr.filter(s => s.epg_channel_id);
      loadEpgBatches(withEpg);
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
      const getTs = (e: any, field: 'start' | 'end') => {
        if (field === 'start') return parseInt(e.start_timestamp) || Math.floor(new Date(e.start + ' UTC').getTime() / 1000);
        return parseInt(e.stop_timestamp) || Math.floor(new Date(e.end + ' UTC').getTime() / 1000);
      };
      for (const [sid, data] of Object.entries(batchData) as any) {
        const listings = data?.epg_listings || [];
        if (listings.length > 0) {
          const current = listings.find((e: any) => {
            const start = getTs(e, 'start');
            const end = getTs(e, 'end');
            return now >= start && now <= end;
          });
          const next = listings.find((e: any) => getTs(e, 'start') > now);
          let progress = 0;
          if (current) {
            const start = getTs(current, 'start');
            const end = getTs(current, 'end');
            progress = Math.min(Math.max((now - start) / (end - start), 0), 1);
          }
          epgMap[parseInt(sid)] = { current, next, progress };
        }
      }
      setEpgData(prev => ({ ...prev, ...epgMap }));
    } catch (e) { console.error('Batch EPG error:', e); }
  };

  // Load EPG for ALL channels in sequential batches of 30
  const loadEpgBatches = async (allStreams: any[]) => {
    const BATCH_SIZE = 30;
    for (let i = 0; i < allStreams.length; i += BATCH_SIZE) {
      const batch = allStreams.slice(i, i + BATCH_SIZE);
      await loadEpgBatch(batch);
    }
  };

  // Load full TV guide EPG
  const loadFullEpg = async (streamId: number) => {
    setEpgLoading(true);
    setChannelFullEpg([]);
    try {
      const data = await api.getFullEpg(username, password, streamId);
      const listings = (data?.epg_listings || []).filter((e: any) => e.start_timestamp);
      listings.sort((a: any, b: any) => parseInt(a.start_timestamp) - parseInt(b.start_timestamp));
      setChannelFullEpg(listings);
    } catch (e) { console.error('Full EPG error:', e); }
    finally { setEpgLoading(false); }
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

  // Play a channel via global video player
  const playChannel = async (item: any) => {
    try {
      const data = await api.getStreamUrl(username, password, item.stream_id, 'live', 'ts');

      // Get current program title from EPG
      let programTitle = '';
      try {
        const epg = await api.getEpg(username, password, item.stream_id);
        if (epg?.epg_listings?.length > 0) {
          const now = Math.floor(Date.now() / 1000);
          const current = epg.epg_listings.find((e: any) => {
            const start = parseInt(e.start_timestamp) || 0;
            const end = parseInt(e.stop_timestamp) || 0;
            return now >= start && now <= end;
          });
          if (current?.title) programTitle = current.title;
        }
      } catch {}

      // Tell global player to play this stream (with fallback URL for LB)
      playStream(
        data.url,
        item.name,
        item.stream_icon || '',
        programTitle,
        item.stream_id,
        item.category_id || '',
        data.fallback_url || data.raw_url || '',
      );

      // Add to watch history
      const cat = categories.find((c: any) => c.category_id === item.category_id);
      api.addHistory({
        username,
        stream_id: item.stream_id,
        stream_name: item.name,
        stream_icon: item.stream_icon || '',
        stream_type: 'live',
        category_name: cat?.category_name || '',
      }).catch(() => {});

      // Load full EPG for TV guide and show guide view
      setSelectedDateStr(getDateStr(new Date()));
      loadFullEpg(item.stream_id);
      setShowGuide(true);
      setLiveGuideActive(true);
    } catch (e) { console.error('Error playing channel:', e); }
  };

  // Reset guide view when stream stops
  useEffect(() => {
    if (showGuide && !activeStreamId) {
      setShowGuide(false);
      setLiveGuideActive(false);
    }
  }, [showGuide, activeStreamId]);

  // Filtered programs for TV guide
  const filteredPrograms = useMemo(() => {
    if (!channelFullEpg.length) return [];
    return channelFullEpg.filter((item: any) => {
      const ts = parseInt(item.start_timestamp);
      if (!ts) return false;
      const d = new Date(ts * 1000);
      return getDateStr(d) === selectedDateStr;
    });
  }, [channelFullEpg, selectedDateStr]);

  const formatTime12h = (timestamp: string | number) => {
    const ts = parseInt(String(timestamp));
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const renderChannel = ({ item, index }: { item: any; index: number }) => {
    const epg = epgData[item.stream_id];
    const isActive = activeStreamId === item.stream_id;
    return (
      <TouchableOpacity
        testID={`live-channel-${index}`}
        style={[
          styles.channelRow,
          { backgroundColor: isActive ? colors.primary + '15' : colors.surface, borderColor: isActive ? colors.primary : colors.border },
        ]}
        activeOpacity={0.7}
        onPress={() => playChannel(item)}
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
            {epg?.current?.title ? (
              <View style={styles.epgCurrentRow}>
                <View style={[styles.epgLiveDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.epgCurrentText, { color: colors.textSecondary }]} numberOfLines={1}>{epg.current.title}</Text>
              </View>
            ) : null}
            {epg?.current ? (
              <View style={[styles.epgProgressBar, { backgroundColor: colors.border }]}>
                <View style={[styles.epgProgressFill, { width: `${(epg.progress || 0) * 100}%`, backgroundColor: colors.primary }]} />
              </View>
            ) : null}
            {epg?.next?.title ? (
              <View style={styles.epgNextRow}>
                <Text style={[styles.epgNextLabel, { color: colors.textSecondary }]}>Next: </Text>
                <Text style={[styles.epgNextText, { color: colors.textSecondary }]} numberOfLines={1}>{epg.next.title}</Text>
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

  const renderProgram = ({ item }: { item: any }) => {
    const now = Math.floor(Date.now() / 1000);
    const startTs = parseInt(item.start_timestamp);
    const endTs = parseInt(item.stop_timestamp);
    const isLive = now >= startTs && now <= endTs;
    const isPast = endTs < now;
    const progress = isLive ? Math.min(Math.max((now - startTs) / (endTs - startTs), 0), 1) : 0;
    return (
      <View style={[
        styles.programRow,
        isLive ? { backgroundColor: colors.surface } : { backgroundColor: 'transparent' },
        isPast ? { opacity: 0.5 } : {},
      ]}>
        <Text style={[styles.programTime, { color: isLive ? colors.primary : colors.textSecondary }]}>
          {formatTime12h(startTs)}
        </Text>
        <View style={styles.programInfo}>
          <View style={styles.programTitleRow}>
            <Text style={[styles.programTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title || 'Unknown Program'}
            </Text>
            {isLive && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>Live</Text>
              </View>
            )}
          </View>
          {item.description ? (
            <Text style={[styles.programDesc, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          {isLive && (
            <View style={[styles.programProgress, { backgroundColor: colors.border }]}>
              <View style={[styles.programProgressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
            </View>
          )}
        </View>
      </View>
    );
  };

  // TV Guide header
  const renderGuideHeader = () => (
    <View>
      {/* Back to channel list */}
      <TouchableOpacity
        testID="guide-back-btn"
        style={styles.guideBackRow}
        onPress={() => { setShowGuide(false); setLiveGuideActive(false); }}
      >
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
        <Text style={[styles.guideBackText, { color: colors.primary }]}>Back to channels</Text>
      </TouchableOpacity>
      {/* Channel selector strip */}
      <FlatList
        horizontal
        nestedScrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        data={filteredStreams}
        keyExtractor={(item, i) => `sel-${item.stream_id || i}`}
        contentContainerStyle={styles.channelSelectorList}
        renderItem={({ item }) => {
          const isActive = activeStreamId === item.stream_id;
          return (
            <TouchableOpacity
              style={[
                styles.channelSelectorCard,
                { backgroundColor: colors.surface, borderColor: isActive ? colors.primary : colors.border },
                isActive && styles.channelSelectorCardActive,
              ]}
              onPress={() => playChannel(item)}
              activeOpacity={0.7}
            >
              {item.stream_icon ? (
                <Image source={{ uri: item.stream_icon }} style={styles.channelSelectorImg} resizeMode="contain" />
              ) : (
                <Ionicons name="tv" size={22} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          );
        }}
      />
      {/* Date picker */}
      <FlatList
        horizontal
        nestedScrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        data={dateOptions}
        keyExtractor={item => item.value}
        contentContainerStyle={styles.dateSelectorList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.dateChip,
              { backgroundColor: selectedDateStr === item.value ? colors.primary : colors.surface, borderColor: selectedDateStr === item.value ? colors.primary : colors.border },
            ]}
            onPress={() => setSelectedDateStr(item.value)}
          >
            <Text style={[
              styles.dateChipText,
              { color: selectedDateStr === item.value ? '#fff' : (item.isToday ? colors.primary : colors.textSecondary), fontWeight: item.isToday ? '700' : '400' },
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
      {/* Guide section title */}
      <View style={[styles.guideSectionHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.guideSectionTitle, { color: colors.textPrimary }]}>TV Schedule</Text>
        {epgLoading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: STATUS_BAR_H }]}>
      {/* CHANNEL LIST VIEW (default when entering Live tab) */}
      {!showGuide ? (
        <>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Live TV</Text>

          {/* Favorites */}
          {favorites.length > 0 && (
            <View style={styles.favSection}>
              <Text style={[styles.favSectionTitle, { color: colors.textPrimary }]}>Favorites</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={favorites}
                keyExtractor={(item) => `fav-${item.stream_id}`}
                contentContainerStyle={styles.favList}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    testID={`live-fav-${index}`}
                    style={[styles.favCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      const fullStream = streams.find(s => s.stream_id === item.stream_id) || {
                        stream_id: item.stream_id,
                        name: item.name,
                        stream_icon: item.stream_icon,
                        category_id: item.category_id,
                      };
                      playChannel(fullStream);
                    }}
                  >
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.favCardImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={20} color={colors.textSecondary} />
                    )}
                    <Text style={[styles.favCardName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                    <Ionicons name="star" size={12} color="#FFD700" style={styles.favStar} />
                  </TouchableOpacity>
                )}
              />
            </View>
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
                    { backgroundColor: selectedCategory === item.category_id ? colors.primary : colors.surface, borderColor: selectedCategory === item.category_id ? colors.primary : colors.border },
                  ]}
                  onPress={() => selectCategory(item.category_id)}
                >
                  <Text style={[styles.catChipText, { color: selectedCategory === item.category_id ? '#fff' : colors.textPrimary }]}>
                    {item.category_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Channel count */}
          <View style={styles.guideHeader}>
            <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>{filteredStreams.length} channels</Text>
          </View>

          {/* Channel list */}
          {loadingStreams ? (
            <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
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
        </>
      ) : (
        /* TV GUIDE VIEW (after selecting a channel from the list) */
        loadingStreams ? (
          <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            data={filteredPrograms}
            keyExtractor={(item, i) => `prog-${i}-${item.start_timestamp}`}
            renderItem={renderProgram}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListHeaderComponent={renderGuideHeader}
            ListEmptyComponent={
              epgLoading ? null : (
                <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                  <Ionicons name="calendar-outline" size={36} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No schedule for this day</Text>
                </View>
              )
            }
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },

  // Favorites
  favSection: { marginBottom: 8 },
  favSectionTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 20, marginBottom: 10 },
  favList: { paddingHorizontal: 16, gap: 10 },
  favCard: {
    width: 88, borderRadius: 12, borderWidth: 1, padding: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  favCardImg: { width: 48, height: 36, marginBottom: 4 },
  favCardName: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  favStar: { position: 'absolute', top: 4, right: 4 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingHorizontal: 14,
    height: 44, borderRadius: 12, borderWidth: 1, marginBottom: 8, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },

  // Categories
  catSection: { height: 44, marginBottom: 4 },
  catList: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, height: 36, justifyContent: 'center' },
  catChipText: { fontSize: 13, fontWeight: '600' },

  guideHeader: { paddingHorizontal: 20, paddingVertical: 6 },
  guideTitle: { fontSize: 14, fontWeight: '700' },

  // Channel list
  channelRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 12,
    borderRadius: 12, marginBottom: 6, borderWidth: 1,
  },
  channelLogo: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  channelLogoImg: { width: 40, height: 40 },
  channelInfo: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', marginLeft: 12 },
  channelNum: { fontSize: 14, fontWeight: '700', marginRight: 8, marginTop: 2, minWidth: 22 },
  channelTextWrap: { flex: 1 },
  channelName: { fontSize: 14, fontWeight: '700' },
  epgCurrentRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  epgLiveDot: { width: 6, height: 6, borderRadius: 3 },
  epgCurrentText: { fontSize: 12, flex: 1 },
  epgProgressBar: { height: 3, borderRadius: 2, marginTop: 4, marginBottom: 4 },
  epgProgressFill: { height: '100%', borderRadius: 2 },
  epgNextRow: { flexDirection: 'row', alignItems: 'center' },
  epgNextLabel: { fontSize: 11, fontWeight: '600' },
  epgNextText: { fontSize: 11, fontStyle: 'italic', flex: 1 },
  nowPlayingBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  emptyState: { margin: 16, padding: 40, borderRadius: 12, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14 },

  // TV Guide - back button
  guideBackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  guideBackText: { fontSize: 14, fontWeight: '600' },

  // TV Guide - channel selector
  channelSelectorList: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  channelSelectorCard: {
    width: 72, height: 56, borderRadius: 12, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  channelSelectorCardActive: { borderWidth: 2.5 },
  channelSelectorImg: { width: 56, height: 40 },

  // Date picker
  dateSelectorList: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  dateChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, height: 34, justifyContent: 'center',
  },
  dateChipText: { fontSize: 13 },

  // Guide section header
  guideSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1,
  },
  guideSectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Program rows
  programRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
    alignItems: 'flex-start', gap: 14,
  },
  programTime: { fontSize: 13, fontWeight: '600', minWidth: 68, paddingTop: 2 },
  programInfo: { flex: 1 },
  programTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  programTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  programDesc: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  programProgress: { height: 3, borderRadius: 2, marginTop: 8 },
  programProgressFill: { height: '100%', borderRadius: 2 },
  liveBadge: {
    backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
