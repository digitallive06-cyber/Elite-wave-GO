import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

const LEAGUES = [
  { key: 'nfl', label: 'NFL', icon: 'american-football', color: '#013369' },
  { key: 'nba', label: 'NBA', icon: 'basketball', color: '#F58426' },
  { key: 'mlb', label: 'MLB', icon: 'baseball', color: '#002D72' },
  { key: 'nhl', label: 'NHL', icon: 'snow', color: '#000' },
  { key: 'mls', label: 'MLS', icon: 'football', color: '#5A2D81' },
];

function formatGameTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return isToday ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function getOrdinal(n: number) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return (s[(v - 20) % 10] || s[v] || s[0]) || 'th';
}

function GameCard({ event, league }: { event: any; league: any }) {
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

  const awayScore = parseInt(away.score) || 0;
  const homeScore = parseInt(home.score) || 0;
  const awayWinning = awayScore > homeScore;
  const homeWinning = homeScore > awayScore;

  const clockText = isLive
    ? `${comp.status?.displayClock || ''} - ${comp.status?.period || ''}${getOrdinal(comp.status?.period)}`
    : isFinal
    ? 'Final'
    : formatGameTime(event.date);

  return (
    <TouchableOpacity
      testID={`game-card-${event.id}`}
      style={styles.gameCard}
      activeOpacity={0.8}
      onPress={() => router.push({ pathname: '/sports-detail', params: { eventId: event.id, league: league.key } })}
    >
      {/* Top bar: league + LIVE badge */}
      <View style={styles.cardTop}>
        <View style={styles.leagueBadge}>
          <Ionicons name={league.icon as any} size={14} color={league.color} />
          <Text style={styles.leagueName}>{league.label}</Text>
        </View>
        {isLive && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
        {isFinal && <Text style={styles.finalBadge}>FINAL</Text>}
      </View>

      {/* Teams + Scores */}
      <View style={styles.matchup}>
        <View style={styles.teamCol}>
          <Image source={{ uri: away.team?.logo }} style={styles.teamLogo} resizeMode="contain" />
          <Text style={styles.teamName} numberOfLines={1}>{away.team?.shortDisplayName || away.team?.abbreviation}</Text>
          {!isScheduled && (
            <Text style={[
              styles.score,
              isLive && awayWinning && styles.scoreWinning,
              isFinal && awayWinning && styles.scoreWinning,
            ]}>
              {away.score}
            </Text>
          )}
        </View>

        <Text style={styles.atSymbol}>@</Text>

        <View style={styles.teamCol}>
          <Image source={{ uri: home.team?.logo }} style={styles.teamLogo} resizeMode="contain" />
          <Text style={styles.teamName} numberOfLines={1}>{home.team?.shortDisplayName || home.team?.abbreviation}</Text>
          {!isScheduled && (
            <Text style={[
              styles.score,
              isLive && homeWinning && styles.scoreWinning,
              isFinal && homeWinning && styles.scoreWinning,
            ]}>
              {home.score}
            </Text>
          )}
        </View>
      </View>

      {/* Bottom bar: clock + ESPN */}
      <View style={styles.cardBottom}>
        <View style={styles.clockRow}>
          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.4)" />
          <Text style={styles.clockText}>{clockText}</Text>
        </View>
        <View style={styles.espnBadge}>
          <Text style={styles.espnText}>ESPN</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SportsSection() {
  const router = useRouter();
  const [activeLeague, setActiveLeague] = useState('nba');
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const leagueObj = LEAGUES.find(l => l.key === activeLeague) || LEAGUES[1];

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
        <View style={styles.headerLeft}>
          <Ionicons name={leagueObj.icon as any} size={22} color={leagueObj.color} />
          <Text style={styles.headerTitle}>Upcoming Games</Text>
        </View>
        <TouchableOpacity
          testID="sports-view-all"
          style={styles.seeAllBtn}
          onPress={() => router.push({ pathname: '/sports-all', params: { league: activeLeague } })}
        >
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="chevron-forward" size={16} color="#00BFFF" />
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
            <Ionicons name={item.icon as any} size={14}
              color={activeLeague === item.key ? '#fff' : 'rgba(255,255,255,0.4)'} />
            <Text style={[styles.leagueTabLabel, activeLeague === item.key && styles.leagueTabLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Games */}
      {loading ? (
        <ActivityIndicator color="#00BFFF" style={{ marginVertical: 30 }} />
      ) : games.length === 0 ? (
        <Text style={styles.noGames}>No games scheduled</Text>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={games.slice(0, 10)}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.gamesList}
          renderItem={({ item }) => <GameCard event={item} league={leagueObj} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 8 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: '#00BFFF', fontSize: 14, fontWeight: '700' },

  // League Tabs
  leagueTabs: { paddingHorizontal: 12, gap: 8, marginBottom: 14 },
  leagueTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  leagueTabActive: { backgroundColor: 'rgba(0,191,255,0.18)' },
  leagueTabLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' },
  leagueTabLabelActive: { color: '#fff' },

  // Games list
  gamesList: { paddingHorizontal: 12, gap: 12 },

  // Game Card
  gameCard: {
    width: 220, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },

  // Card top
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  leagueBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  leagueName: { color: '#fff', fontSize: 12, fontWeight: '800' },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,59,48,0.15)', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  liveText: { color: '#FF3B30', fontSize: 10, fontWeight: '900' },
  finalBadge: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' },

  // Matchup
  matchup: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  teamCol: { alignItems: 'center', flex: 1 },
  teamLogo: { width: 48, height: 48, marginBottom: 6 },
  teamName: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  score: { color: '#fff', fontSize: 26, fontWeight: '900' },
  scoreWinning: { color: '#34C759' },
  atSymbol: { color: 'rgba(255,255,255,0.2)', fontSize: 16, fontWeight: '600', marginHorizontal: 2 },

  // Card bottom
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10,
  },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clockText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  espnBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  espnText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800' },

  noGames: {
    color: 'rgba(255,255,255,0.3)', fontSize: 13,
    textAlign: 'center', paddingVertical: 30,
  },
});
