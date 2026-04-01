import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, ActivityIndicator,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/utils/api';

export default function SportsDetailScreen() {
  const { eventId, league } = useLocalSearchParams<{ eventId: string; league: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.getSportsSummary(league, eventId);
        setData(d);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [eventId, league]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#00BFFF" size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!data || !data.header) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.errorText}>Could not load game details</Text>
      </SafeAreaView>
    );
  }

  const header = data.header;
  const comp = header.competitions?.[0];
  const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
  const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
  const status = comp?.status?.type;
  const isLive = status?.state === 'in';
  const isFinal = status?.state === 'post';
  const statusDetail = comp?.status?.displayClock
    ? `${comp.status.displayClock} - ${comp.status.period}${getOrdinal(comp.status.period)}`
    : status?.shortDetail || status?.description || '';

  // Team stats from boxscore
  const boxscore = data.boxscore;
  const teamStats = boxscore?.teams || [];
  const players = boxscore?.players || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <TouchableOpacity testID="sports-detail-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Scoreboard */}
        <View style={styles.scoreboard}>
          <View style={styles.teamSide}>
            <Image source={{ uri: away?.team?.logo }} style={styles.bigLogo} resizeMode="contain" />
            <Text style={styles.teamName}>{away?.team?.shortDisplayName || away?.team?.abbreviation}</Text>
            <Text style={styles.teamRecord}>{away?.record?.[0]?.displayValue || ''}</Text>
          </View>

          <View style={styles.scoreCenter}>
            <View style={styles.scoreRow}>
              <Text style={[styles.bigScore, isLive && styles.bigScoreLive]}>{away?.score || '0'}</Text>
              <Text style={styles.scoreDash}>-</Text>
              <Text style={[styles.bigScore, isLive && styles.bigScoreLive]}>{home?.score || '0'}</Text>
            </View>
            <View style={[styles.statusBadge, isLive && styles.statusBadgeLive]}>
              <Text style={[styles.statusBadgeText, isLive && styles.statusBadgeTextLive]}>
                {isLive ? 'LIVE' : isFinal ? 'FINAL' : 'SCHEDULED'}
              </Text>
            </View>
            <Text style={styles.statusDetailText}>{statusDetail}</Text>
          </View>

          <View style={styles.teamSide}>
            <Image source={{ uri: home?.team?.logo }} style={styles.bigLogo} resizeMode="contain" />
            <Text style={styles.teamName}>{home?.team?.shortDisplayName || home?.team?.abbreviation}</Text>
            <Text style={styles.teamRecord}>{home?.record?.[0]?.displayValue || ''}</Text>
          </View>
        </View>

        {/* Venue info */}
        {data.gameInfo?.venue && (
          <Text style={styles.venueText}>
            {data.gameInfo.venue.fullName}{data.gameInfo.venue.address?.city ? `, ${data.gameInfo.venue.address.city}` : ''}
          </Text>
        )}

        {/* Team Stats */}
        {teamStats.length >= 2 && teamStats[0]?.statistics?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Stats</Text>
            <View style={styles.statsCard}>
              {teamStats[0].statistics.slice(0, 8).map((stat: any, idx: number) => {
                const homeStat = teamStats[1]?.statistics?.[idx];
                return (
                  <View key={idx} style={styles.statRow}>
                    <Text style={styles.statValue}>{stat.displayValue}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                    <Text style={styles.statValue}>{homeStat?.displayValue || '-'}</Text>
                  </View>
                );
              })}
              <View style={styles.statHeaderRow}>
                <Text style={styles.statTeamLabel}>{away?.team?.abbreviation}</Text>
                <Text style={styles.statTeamLabel}></Text>
                <Text style={styles.statTeamLabel}>{home?.team?.abbreviation}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Player Stats */}
        {players.length > 0 && players.map((teamPlayers: any, tIdx: number) => {
          const teamInfo = teamPlayers.team;
          const statCategories = teamPlayers.statistics || [];
          if (statCategories.length === 0) return null;

          // Show first stat category (e.g., passing, batting)
          const firstCat = statCategories[0];
          const leaders = firstCat?.athletes?.slice(0, 3) || [];
          if (leaders.length === 0) return null;

          return (
            <View key={tIdx} style={styles.section}>
              <View style={styles.playerHeader}>
                <Image source={{ uri: teamInfo?.logo }} style={styles.smallLogo} resizeMode="contain" />
                <Text style={styles.sectionTitle}>{teamInfo?.shortDisplayName || 'Team'} - {firstCat.name}</Text>
              </View>
              <View style={styles.statsCard}>
                {/* Column headers */}
                <View style={styles.playerStatHeader}>
                  <Text style={[styles.playerStatCol, { flex: 2 }]}>Player</Text>
                  {firstCat.labels?.slice(0, 4).map((label: string, li: number) => (
                    <Text key={li} style={styles.playerStatCol}>{label}</Text>
                  ))}
                </View>
                {leaders.map((athlete: any, aIdx: number) => (
                  <View key={aIdx} style={styles.playerStatRow}>
                    <Text style={[styles.playerStatCell, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>
                      {athlete.athlete?.shortName || athlete.athlete?.displayName || 'Unknown'}
                    </Text>
                    {athlete.stats?.slice(0, 4).map((s: string, si: number) => (
                      <Text key={si} style={styles.playerStatCell}>{s}</Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getOrdinal(n: number) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  backBtn: {
    position: 'absolute', top: 12, left: 12, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  errorText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 100, fontSize: 15 },

  scoreboard: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20,
  },
  teamSide: { alignItems: 'center', width: 90 },
  bigLogo: { width: 56, height: 56, marginBottom: 8 },
  teamName: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  teamRecord: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  scoreCenter: { alignItems: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigScore: { color: '#fff', fontSize: 42, fontWeight: '900' },
  bigScoreLive: { color: '#00BFFF' },
  scoreDash: { color: 'rgba(255,255,255,0.3)', fontSize: 28, fontWeight: '300' },
  statusBadge: {
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusBadgeLive: { backgroundColor: 'rgba(255,59,48,0.15)' },
  statusBadgeText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800' },
  statusBadgeTextLive: { color: '#FF3B30' },
  statusDetailText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 },

  venueText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginBottom: 16 },

  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  smallLogo: { width: 24, height: 24 },

  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 4,
  },
  statTeamLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', width: 50, textAlign: 'center' },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, flex: 1, textAlign: 'center' },
  statValue: { color: '#fff', fontSize: 13, fontWeight: '700', width: 50, textAlign: 'center' },

  playerStatHeader: {
    flexDirection: 'row', paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  playerStatCol: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', flex: 1, textAlign: 'center' },
  playerStatRow: { flexDirection: 'row', paddingVertical: 6 },
  playerStatCell: { color: 'rgba(255,255,255,0.7)', fontSize: 12, flex: 1, textAlign: 'center' },
});
