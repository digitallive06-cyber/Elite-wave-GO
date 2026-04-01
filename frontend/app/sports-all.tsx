import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, ActivityIndicator,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/utils/api';

const LEAGUES = [
  { key: 'nfl', label: 'NFL', icon: 'american-football' },
  { key: 'nba', label: 'NBA', icon: 'basketball' },
  { key: 'mlb', label: 'MLB', icon: 'baseball' },
  { key: 'nhl', label: 'NHL', icon: 'snow' },
  { key: 'mls', label: 'MLS', icon: 'football' },
];

function formatGameTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return isToday ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

export default function SportsAllScreen() {
  const { league: initLeague } = useLocalSearchParams<{ league: string }>();
  const router = useRouter();
  const [activeLeague, setActiveLeague] = useState(initLeague || 'nba');
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async (league: string) => {
    setLoading(true);
    try {
      const data = await api.getSportsScoreboard(league);
      setGames(data.events || []);
    } catch { setGames([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGames(activeLeague); }, [activeLeague]);

  const renderGame = ({ item: event }: { item: any }) => {
    const comp = event.competitions?.[0];
    if (!comp) return null;
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
    const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
    if (!away || !home) return null;

    const status = event.status?.type;
    const isLive = status?.state === 'in';
    const isFinal = status?.state === 'post';
    const isScheduled = status?.state === 'pre';
    const statusText = isLive ? (status?.shortDetail || 'LIVE') : isFinal ? 'Final' : formatGameTime(event.date);

    return (
      <TouchableOpacity
        testID={`game-all-${event.id}`}
        style={styles.gameRow}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/sports-detail', params: { eventId: event.id, league: activeLeague } })}
      >
        {/* Away team */}
        <View style={styles.teamInfo}>
          <Image source={{ uri: away.team?.logo }} style={styles.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamFullName} numberOfLines={1}>{away.team?.shortDisplayName || away.team?.displayName}</Text>
            <Text style={styles.record}>{away.record?.[0]?.displayValue || ''}</Text>
          </View>
          <Text style={[styles.rowScore, isLive && styles.rowScoreLive]}>
            {isScheduled ? '' : away.score}
          </Text>
        </View>

        {/* Home team */}
        <View style={styles.teamInfo}>
          <Image source={{ uri: home.team?.logo }} style={styles.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamFullName} numberOfLines={1}>{home.team?.shortDisplayName || home.team?.displayName}</Text>
            <Text style={styles.record}>{home.record?.[0]?.displayValue || ''}</Text>
          </View>
          <Text style={[styles.rowScore, isLive && styles.rowScoreLive]}>
            {isScheduled ? '' : home.score}
          </Text>
        </View>

        {/* Status bar */}
        <View style={[styles.statusBar, isLive && styles.statusBarLive]}>
          {isLive && <View style={styles.liveDot} />}
          <Text style={[styles.statusText, isLive && styles.statusTextLive]}>{statusText}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="sports-all-back" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sports</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* League Tabs */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={LEAGUES}
        keyExtractor={item => item.key}
        contentContainerStyle={styles.leagueTabs}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`all-league-${item.key}`}
            style={[styles.leagueTab, activeLeague === item.key && styles.leagueTabActive]}
            onPress={() => setActiveLeague(item.key)}
          >
            <Ionicons name={item.icon as any} size={16}
              color={activeLeague === item.key ? '#fff' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.leagueLabel, activeLeague === item.key && styles.leagueLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Games List */}
      {loading ? (
        <ActivityIndicator color="#00BFFF" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={games}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={renderGame}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No games scheduled</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },

  leagueTabs: { paddingHorizontal: 12, gap: 8, marginBottom: 16 },
  leagueTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  leagueTabActive: { backgroundColor: 'rgba(0,191,255,0.15)', borderColor: 'rgba(0,191,255,0.4)' },
  leagueLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700' },
  leagueLabelActive: { color: '#fff' },

  gameRow: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  teamInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  logo: { width: 32, height: 32, borderRadius: 4 },
  teamFullName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  record: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  rowScore: { color: 'rgba(255,255,255,0.7)', fontSize: 22, fontWeight: '900' },
  rowScoreLive: { color: '#fff' },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statusBarLive: { borderTopColor: 'rgba(255,59,48,0.2)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  statusText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' },
  statusTextLive: { color: '#FF3B30' },

  emptyText: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
