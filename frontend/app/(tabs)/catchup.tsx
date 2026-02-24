import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/utils/api';

export default function CatchupScreen() {
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

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.getCatchupCategories(username, password);
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [username, password]);

  const loadStreams = useCallback(async (catId?: string) => {
    setLoadingStreams(true);
    try {
      const data = await api.getCatchupStreams(username, password, catId);
      const arr = Array.isArray(data) ? data : [];
      setStreams(arr);
      setFilteredStreams(arr);
    } catch (e) { console.error(e); }
    finally { setLoadingStreams(false); setRefreshing(false); }
  }, [username, password]);

  useEffect(() => {
    Promise.all([loadCategories(), loadStreams()]).then(() => setLoading(false));
  }, [loadCategories, loadStreams]);

  useEffect(() => {
    if (search.trim()) {
      setFilteredStreams(streams.filter(s => s.name?.toLowerCase().includes(search.toLowerCase())));
    } else {
      setFilteredStreams(streams);
    }
  }, [search, streams]);

  const selectCategory = (catId: string | null) => {
    setSelectedCategory(catId);
    setSearch('');
    loadStreams(catId || undefined);
  };

  const renderCatchupItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      testID={`catchup-item-${index}`}
      style={[styles.itemRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.7}
    >
      <View style={[styles.itemLogo, { backgroundColor: colors.surfaceHighlight }]}>
        {item.stream_icon ? (
          <Image source={{ uri: item.stream_icon }} style={styles.itemLogoImg} resizeMode="contain" />
        ) : (
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
        {item.tv_archive_duration ? (
          <Text style={[styles.itemDuration, { color: colors.textSecondary }]}>
            {item.tv_archive_duration} day{item.tv_archive_duration !== '1' ? 's' : ''} available
          </Text>
        ) : null}
      </View>
      <View style={[styles.archiveBadge, { backgroundColor: colors.success + '20' }]}>
        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
        <Text style={[styles.archiveText, { color: colors.success }]}>DVR</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Catch-Up</Text>

      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="catchup-search-input"
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search catch-up..."
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

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ category_id: null, category_name: 'All' }, ...categories]}
        keyExtractor={(item, i) => `ccat-${i}`}
        contentContainerStyle={styles.catList}
        style={styles.catListWrap}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`catchup-cat-${item.category_id || 'all'}`}
            style={[styles.catChip, {
              backgroundColor: selectedCategory === item.category_id ? colors.primary : colors.surface,
              borderColor: selectedCategory === item.category_id ? colors.primary : colors.border,
            }]}
            onPress={() => selectCategory(item.category_id)}
          >
            <Text style={[styles.catChipText, {
              color: selectedCategory === item.category_id ? '#fff' : colors.textPrimary,
            }]} numberOfLines={1}>{item.category_name}</Text>
          </TouchableOpacity>
        )}
      />

      <Text style={[styles.countText, { color: colors.textSecondary }]}>
        {filteredStreams.length} channel{filteredStreams.length !== 1 ? 's' : ''} with catch-up
      </Text>

      {loadingStreams ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredStreams}
          keyExtractor={(item, i) => `cu-${item.stream_id || i}`}
          renderItem={renderCatchupItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadStreams(selectedCategory || undefined);
          }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="time-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No catch-up channels found</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Channels with DVR/catch-up enabled will appear here
              </Text>
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
  itemRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 12,
    borderRadius: 12, marginBottom: 8, borderWidth: 1,
  },
  itemLogo: {
    width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  itemLogoImg: { width: 36, height: 36 },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemDuration: { fontSize: 12, marginTop: 2 },
  archiveBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4,
  },
  archiveText: { fontSize: 11, fontWeight: '700' },
  emptyState: { margin: 16, padding: 40, borderRadius: 12, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600' },
  emptySubtext: { fontSize: 12, textAlign: 'center' },
});
