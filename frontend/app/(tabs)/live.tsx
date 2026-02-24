import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/utils/api';

export default function LiveScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [epgData, setEpgData] = useState<{ [key: number]: any }>({});

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.getLiveCategories(username, password);
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Load categories error:', e); }
  }, [username, password]);

  const loadStreams = useCallback(async (catId?: string) => {
    setLoadingStreams(true);
    try {
      const data = await api.getLiveStreams(username, password, catId);
      const arr = Array.isArray(data) ? data : [];
      setStreams(arr);
      setFilteredStreams(arr);
      // Load EPG for first 15 visible streams
      loadEpgBatch(arr.slice(0, 15));
    } catch (e) { console.error('Load streams error:', e); }
    finally { setLoadingStreams(false); setRefreshing(false); }
  }, [username, password]);

  const loadEpgBatch = async (streamList: any[]) => {
    const epgMap: { [key: number]: any } = {};
    const promises = streamList
      .filter(s => s.epg_channel_id)
      .slice(0, 10)
      .map(async (stream) => {
        try {
          const data = await api.getEpg(username, password, stream.stream_id);
          if (data?.epg_listings && data.epg_listings.length > 0) {
            const now = Math.floor(Date.now() / 1000);
            const current = data.epg_listings.find((e: any) => {
              const start = new Date(e.start).getTime() / 1000;
              const end = new Date(e.end).getTime() / 1000;
              return now >= start && now <= end;
            });
            const next = data.epg_listings.find((e: any) => {
              const start = new Date(e.start).getTime() / 1000;
              return start > now;
            });
            epgMap[stream.stream_id] = { current, next };
          }
        } catch (e) { /* skip individual failures */ }
      });
    await Promise.allSettled(promises);
    setEpgData(prev => ({ ...prev, ...epgMap }));
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

  const addToHistory = async (item: any) => {
    try {
      const cat = categories.find(c => c.category_id === item.category_id);
      await api.addHistory({
        username,
        stream_id: item.stream_id,
        stream_name: item.name,
        stream_icon: item.stream_icon || '',
        stream_type: 'live',
        category_name: cat?.category_name || '',
      });
    } catch (e) { console.error(e); }
  };

  const playChannel = (item: any) => {
    const cat = categories.find(c => c.category_id === item.category_id);
    router.push({
      pathname: '/player',
      params: {
        streamId: String(item.stream_id),
        streamName: item.name,
        streamIcon: item.stream_icon || '',
        streamType: 'live',
        categoryName: cat?.category_name || '',
        containerExtension: 'ts',
      },
    });
    addToHistory(item);
  };

  const formatEpgTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const renderChannel = ({ item, index }: { item: any; index: number }) => {
    const epg = epgData[item.stream_id];
    return (
      <TouchableOpacity
        testID={`live-channel-${index}`}
        style={[styles.channelRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
            <Text style={[styles.channelName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
            {epg?.current ? (
              <View style={styles.epgRow}>
                <Ionicons name="radio-button-on" size={8} color={colors.success} />
                <Text style={[styles.epgText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {epg.current.title}
                </Text>
                <Text style={[styles.epgTime, { color: colors.textSecondary }]}>
                  {formatEpgTime(epg.current.start)} - {formatEpgTime(epg.current.end)}
                </Text>
              </View>
            ) : null}
            {epg?.next ? (
              <View style={styles.epgRow}>
                <Ionicons name="time-outline" size={8} color={colors.textSecondary} />
                <Text style={[styles.epgNextText, { color: colors.textSecondary }]} numberOfLines={1}>
                  Next: {epg.next.title}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {item.tv_archive === 1 && (
          <View style={[styles.catchupBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.catchupText, { color: colors.primary }]}>DVR</Text>
          </View>
        )}
        <Ionicons name="play-circle" size={28} color={colors.primary} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Live TV</Text>

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
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ category_id: null, category_name: 'All' }, ...categories]}
        keyExtractor={(item, i) => `cat-${i}`}
        contentContainerStyle={styles.catList}
        style={styles.catListWrap}
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
            ]} numberOfLines={1}>
              {item.category_name}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Text style={[styles.countText, { color: colors.textSecondary }]}>
        {filteredStreams.length} channel{filteredStreams.length !== 1 ? 's' : ''}
      </Text>

      {/* Channels List */}
      {loadingStreams ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
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
            // Load EPG for newly visible streams
            const loaded = Object.keys(epgData).map(Number);
            const needEpg = filteredStreams.filter(s => !loaded.includes(s.stream_id));
            if (needEpg.length > 0) loadEpgBatch(needEpg.slice(0, 10));
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingHorizontal: 14,
    height: 44, borderRadius: 12, borderWidth: 1, marginBottom: 12, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  catListWrap: { maxHeight: 44, marginBottom: 8 },
  catList: { paddingHorizontal: 16, gap: 8 },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: 13, fontWeight: '600' },
  countText: { fontSize: 12, paddingHorizontal: 20, marginBottom: 8 },
  channelRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 12,
    borderRadius: 12, marginBottom: 8, borderWidth: 1,
  },
  channelLogo: {
    width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  channelLogoImg: { width: 36, height: 36 },
  channelInfo: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', marginLeft: 12 },
  channelNum: { fontSize: 14, fontWeight: '700', marginRight: 10, marginTop: 2 },
  channelTextWrap: { flex: 1 },
  channelName: { fontSize: 14, fontWeight: '600' },
  epgRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  epgText: { fontSize: 11, flex: 1 },
  epgTime: { fontSize: 10 },
  epgNextText: { fontSize: 10, fontStyle: 'italic', flex: 1 },
  catchupBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catchupText: { fontSize: 10, fontWeight: '700' },
  emptyState: { margin: 16, padding: 40, borderRadius: 12, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14 },
});
