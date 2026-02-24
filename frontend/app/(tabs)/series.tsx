import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, Dimensions, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/utils/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 12) / 3;

export default function SeriesScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [filteredSeries, setFilteredSeries] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.getSeriesCategories(username, password);
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [username, password]);

  const loadSeries = useCallback(async (catId?: string) => {
    setLoadingSeries(true);
    try {
      const data = await api.getSeries(username, password, catId);
      const arr = Array.isArray(data) ? data : [];
      setSeriesList(arr);
      setFilteredSeries(arr);
    } catch (e) { console.error(e); }
    finally { setLoadingSeries(false); setRefreshing(false); }
  }, [username, password]);

  useEffect(() => {
    Promise.all([loadCategories(), loadSeries()]).then(() => setLoading(false));
  }, [loadCategories, loadSeries]);

  useEffect(() => {
    if (search.trim()) {
      setFilteredSeries(seriesList.filter(s => s.name?.toLowerCase().includes(search.toLowerCase())));
    } else {
      setFilteredSeries(seriesList);
    }
  }, [search, seriesList]);

  const selectCategory = (catId: string | null) => {
    setSelectedCategory(catId);
    setSearch('');
    loadSeries(catId || undefined);
  };

  const renderSeries = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      testID={`series-item-${index}`}
      style={[styles.card, { backgroundColor: colors.surface }]}
      activeOpacity={0.8}
    >
      <View style={styles.posterWrap}>
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.posterPlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
            <Ionicons name="albums-outline" size={28} color={colors.textSecondary} />
          </View>
        )}
        {item.rating ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.ratingText}>{parseFloat(item.rating).toFixed(1)}</Text>
          </View>
        ) : null}
        {item.last_modified ? (
          <View style={styles.yearBadge}>
            <Text style={styles.yearText}>{new Date(parseInt(item.last_modified) * 1000).getFullYear()}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
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
      <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>TV Series</Text>

      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="series-search-input"
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search series..."
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
        keyExtractor={(item, i) => `scat-${i}`}
        contentContainerStyle={styles.catList}
        style={styles.catListWrap}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`series-cat-${item.category_id || 'all'}`}
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
        {filteredSeries.length} series
      </Text>

      {loadingSeries ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredSeries}
          keyExtractor={(item, i) => `ser-${item.series_id || i}`}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderSeries}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadSeries(selectedCategory || undefined);
          }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="albums-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No series found</Text>
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
  gridRow: { gap: 12, marginBottom: 12 },
  card: { width: CARD_WIDTH, borderRadius: 10, overflow: 'hidden' },
  posterWrap: { width: '100%', aspectRatio: 2 / 3, position: 'relative' },
  poster: { width: '100%', height: '100%', borderRadius: 10 },
  posterPlaceholder: { width: '100%', height: '100%', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  ratingBadge: {
    position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 3,
  },
  ratingText: { color: '#FFD700', fontSize: 10, fontWeight: '700' },
  yearBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  yearText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  title: { fontSize: 12, fontWeight: '600', padding: 6, lineHeight: 16 },
  emptyState: { margin: 16, padding: 40, borderRadius: 12, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14 },
});
