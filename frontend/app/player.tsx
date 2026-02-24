import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Platform, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { api } from '../src/utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PlayerScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    streamId: string;
    streamName: string;
    streamIcon: string;
    streamType: string;
    categoryName: string;
    containerExtension: string;
  }>();

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [epgInfo, setEpgInfo] = useState<any>(null);

  const streamId = parseInt(params.streamId || '0');
  const streamName = params.streamName || 'Unknown';
  const streamIcon = params.streamIcon || '';
  const streamType = params.streamType || 'live';
  const categoryName = params.categoryName || '';
  const containerExtension = params.containerExtension || 'ts';

  // Resolve stream URL (handles LB redirects)
  const resolveUrl = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStreamUrl(
        username, password, streamId, streamType, containerExtension
      );
      setStreamUrl(data.url);
      setFallbackUrl(data.fallback_url);

      // Save to history
      api.addHistory({
        username,
        stream_id: streamId,
        stream_name: streamName,
        stream_icon: streamIcon,
        stream_type: streamType,
        category_name: categoryName,
      }).catch(() => {});

      // Load EPG for live streams
      if (streamType === 'live') {
        api.getEpg(username, password, streamId).then(epg => {
          if (epg?.epg_listings?.length > 0) {
            const now = Math.floor(Date.now() / 1000);
            const current = epg.epg_listings.find((e: any) => {
              const start = new Date(e.start).getTime() / 1000;
              const end_ts = typeof e.end === 'string' && e.end.includes('-')
                ? new Date(e.end).getTime() / 1000
                : parseInt(e.end);
              return now >= start && now <= end_ts;
            });
            setEpgInfo(current || epg.epg_listings[0]);
          }
        }).catch(() => {});
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load stream');
    } finally {
      setLoading(false);
    }
  }, [username, password, streamId, streamType, containerExtension, retryCount]);

  useEffect(() => { resolveUrl(); }, [resolveUrl]);

  // Create video player
  const player = useVideoPlayer(streamUrl || '', (p) => {
    if (streamUrl) {
      p.play();
    }
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Handle retry with fallback URL
  const handleRetry = () => {
    if (fallbackUrl && retryCount === 0) {
      setStreamUrl(fallbackUrl);
      setRetryCount(1);
    } else {
      setRetryCount(prev => prev + 1);
      resolveUrl();
    }
  };

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="player-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{streamName}</Text>
          {categoryName ? (
            <Text style={styles.headerSubtitle}>{categoryName}</Text>
          ) : null}
        </View>
        {streamType === 'live' && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Video Player */}
      <View style={styles.playerContainer}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#00BFFF" />
            <Text style={styles.loadingText}>Resolving stream...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity testID="player-retry-btn" style={styles.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : streamUrl ? (
          <VideoView
            testID="video-player"
            style={styles.video}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
            nativeControls={true}
          />
        ) : null}
      </View>

      {/* Controls Bar */}
      <View style={styles.controlsBar}>
        <TouchableOpacity testID="player-play-pause-btn" style={styles.controlBtn} onPress={togglePlay}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.controlInfo}>
          {streamIcon ? (
            <Image source={{ uri: streamIcon }} style={styles.controlIcon} resizeMode="contain" />
          ) : null}
          <View style={styles.controlTextWrap}>
            <Text style={styles.controlName} numberOfLines={1}>{streamName}</Text>
            {epgInfo?.title ? (
              <Text style={styles.controlEpg} numberOfLines={1}>{epgInfo.title}</Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity testID="player-fullscreen-btn" style={styles.controlBtn} onPress={() => {
          // Fullscreen handled by native controls
        }}>
          <Ionicons name="expand-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* EPG Info Panel */}
      {epgInfo && (
        <View style={[styles.epgPanel, { backgroundColor: colors.surface }]}>
          <Text style={[styles.epgTitle, { color: colors.textPrimary }]}>Now Playing</Text>
          <Text style={[styles.epgProgramTitle, { color: colors.primary }]}>{epgInfo.title}</Text>
          {epgInfo.description ? (
            <Text style={[styles.epgDescription, { color: colors.textSecondary }]} numberOfLines={3}>
              {epgInfo.description}
            </Text>
          ) : null}
          {epgInfo.start && (
            <Text style={[styles.epgTime, { color: colors.textSecondary }]}>
              {new Date(epgInfo.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {epgInfo.end ? ` - ${typeof epgInfo.end === 'string' && epgInfo.end.includes('-')
                ? new Date(epgInfo.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date(parseInt(epgInfo.end) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }` : ''}
            </Text>
          )}
        </View>
      )}

      {/* Stream Info */}
      <View style={[styles.streamInfoPanel, { backgroundColor: colors.surface }]}>
        <Text style={[styles.streamInfoLabel, { color: colors.textSecondary }]}>Stream Type</Text>
        <Text style={[styles.streamInfoValue, { color: colors.textPrimary }]}>
          {streamType === 'live' ? 'Live TV' : streamType === 'movie' ? 'Movie' : 'Series'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 4 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { color: '#EF4444', fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingText: { color: '#888', fontSize: 14 },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00BFFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  controlsBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(20,25,41,0.95)',
  },
  controlBtn: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  controlInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  controlIcon: { width: 32, height: 32, borderRadius: 6 },
  controlTextWrap: { flex: 1 },
  controlName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  controlEpg: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },

  epgPanel: {
    marginHorizontal: 12, marginTop: 12, padding: 16, borderRadius: 12,
  },
  epgTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  epgProgramTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  epgDescription: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  epgTime: { fontSize: 12 },

  streamInfoPanel: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 12, marginTop: 8, padding: 16, borderRadius: 12,
  },
  streamInfoLabel: { fontSize: 13 },
  streamInfoValue: { fontSize: 13, fontWeight: '600' },
});
