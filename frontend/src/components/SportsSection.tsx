import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

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

function GameCard({ event, league }: { event: any; league: string }) {
  const router = useRouter();
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
  const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
  if (!away || !home) return null;

  const status = event.status?.type;
  const isLive = status?.state === 'in';
  const isFinal = status?.state === 'post';
  const isScheduled = status?.state === 'pre';

  const statusText = isLive
    ? status?.shortDetail || 'LIVE'
    : isFinal
    ? 'Final'
    : formatGameTime(event.date);

  return (
    <TouchableOpacity
      testID={`game-card-${event.id}`}
      style={styles.gameCard}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/sports-detail', params: { eventId: event.id, league } })}
    >
      {isLive && <View style={styles.liveDot} />}

      <View style={styles.teamRow}>
        <Image source={{ uri: away.team?.logo }} style={styles.teamLogo} resizeMode="contain" />
        <Text style={styles.teamAbbr} numberOfLines={1}>{away.team?.abbreviation}</Text>
        <Text style={[styles.score, isLive && styles.scoreLive]}>
          {isScheduled ? '' : away.score}
        </Text>
      </View>

      <View style={styles.teamRow}>
        <Image source={{ uri: home.team?.logo }} style={styles.teamLogo} resizeMode="contain" />
        <Text style={styles.teamAbbr} numberOfLines={1}>{home.team?.abbreviation}</Text>
        <Text style={[styles.score, isLive && styles.scoreLive]}>
          {isScheduled ? '' : home.score}
        </Text>
      </View>

      <Text style={[styles.statusText, isLive && styles.statusLive]}>
        {statusText}
      </Text>
    </TouchableOpacity>
  );
}

export default function SportsSection() {
  const router = useRouter();
  const [activeLeague, setActiveLeague] = useState('nba');
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sports</Text>
        <TouchableOpacity
          testID="sports-view-all"
          onPress={() => router.push({ pathname: '/sports-all', params: { league: activeLeague } })}
        >
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
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
            testID={`league-tab-${item.key}`}
            style={[styles.leagueTab, activeLeague === item.key && styles.leagueTabActive]}
            onPress={() => setActiveLeague(item.key)}
          >
            <Ionicons
              name={item.icon as any}
              size={16}
              color={activeLeague === item.key ? '#fff' : 'rgba(255,255,255,0.5)'}
            />
            <Text style={[styles.leagueLabel, activeLeague === item.key && styles.leagueLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Games */}
      {loading ? (
        <ActivityIndicator color="#00BFFF" style={{ marginVertical: 24 }} />
      ) : games.length === 0 ? (
        <Text style={styles.noGames}>No games scheduled</Text>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={games.slice(0, 10)}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.gamesList}
          renderItem={({ item }) => <GameCard event={item} league={activeLeague} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 8 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  viewAll: { color: '#00BFFF', fontSize: 14, fontWeight: '600' },

  leagueTabs: { paddingHorizontal: 12, gap: 8, marginBottom: 12 },
  leagueTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  leagueTabActive: { backgroundColor: 'rgba(0,191,255,0.15)', borderColor: 'rgba(0,191,255,0.4)' },
  leagueLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700' },
  leagueLabelActive: { color: '#fff' },

  gamesList: { paddingHorizontal: 12, gap: 10 },
  gameCard: {
    width: 150, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  liveDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30',
  },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
  },
  teamLogo: { width: 24, height: 24, borderRadius: 4 },
  teamAbbr: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  score: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '800' },
  scoreLive: { color: '#fff' },
  statusText: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600',
    textAlign: 'center', marginTop: 4,
  },
  statusLive: { color: '#FF3B30' },
  noGames: {
    color: 'rgba(255,255,255,0.3)', fontSize: 13,
    textAlign: 'center', paddingVertical: 24,
  },
});
