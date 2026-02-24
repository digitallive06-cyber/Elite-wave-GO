import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Dimensions, Animated, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { api } from '../src/utils/api';

const { width: SW, height: SH } = Dimensions.get('window');

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
    categoryId: string;
    containerExtension: string;
  }>();

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [epgCurrent, setEpgCurrent] = useState<any>(null);
  const [epgNext, setEpgNext] = useState<any>(null);
  const [epgProgress, setEpgProgress] = useState(0);
  const [channelList, setChannelList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [switchingLogo, setSwitchingLogo] = useState<string | null>(null);

  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const guideOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const overlayTimer = useRef<NodeJS.Timeout | null>(null);
  const guideTimer = useRef<NodeJS.Timeout | null>(null);

  // Current channel info
  const [currentChannel, setCurrentChannel] = useState({
    streamId: parseInt(params.streamId || '0'),
    streamName: params.streamName || 'Unknown',
    streamIcon: params.streamIcon || '',
    streamType: params.streamType || 'live',
    categoryName: params.categoryName || '',
    categoryId: params.categoryId || '',
    containerExtension: params.containerExtension || 'ts',
  });

  // Lock to landscape on mount, hide system bars, unlock on unmount
  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }
    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.unlockAsync().catch(() => {});
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
    };
  }, []);

  // Load channel list for category (for prev/next switching)
  useEffect(() => {
    if (currentChannel.streamType === 'live' && currentChannel.categoryId) {
      api.getLiveStreams(username, password, currentChannel.categoryId).then(data => {
        const arr = Array.isArray(data) ? data : [];
        setChannelList(arr);
        const idx = arr.findIndex((s: any) => s.stream_id === currentChannel.streamId);
        if (idx >= 0) setCurrentIndex(idx);
      }).catch(() => {});
    } else if (currentChannel.streamType === 'live') {
      api.getLiveStreams(username, password).then(data => {
        const arr = Array.isArray(data) ? data : [];
        setChannelList(arr);
        const idx = arr.findIndex((s: any) => s.stream_id === currentChannel.streamId);
        if (idx >= 0) setCurrentIndex(idx);
      }).catch(() => {});
    }
  }, [currentChannel.categoryId, currentChannel.streamType]);

  // Resolve stream URL
  const resolveUrl = useCallback(async (streamId: number, sType: string, ext: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStreamUrl(username, password, streamId, sType, ext);
      setStreamUrl(data.url);
      // Save to history
      api.addHistory({
        username,
        stream_id: currentChannel.streamId,
        stream_name: currentChannel.streamName,
        stream_icon: currentChannel.streamIcon,
        stream_type: currentChannel.streamType,
        category_name: currentChannel.categoryName,
      }).catch(() => {});
    } catch (e: any) {
      setError(e.message || 'Failed to load stream');
    } finally {
      setLoading(false);
    }
  }, [username, password]);

  useEffect(() => {
    resolveUrl(currentChannel.streamId, currentChannel.streamType, currentChannel.containerExtension);
  }, [currentChannel.streamId]);

  // Load EPG
  const loadEpg = useCallback(async (streamId: number) => {
    if (currentChannel.streamType !== 'live') return;
    try {
      const data = await api.getEpg(username, password, streamId);
      if (data?.epg_listings?.length > 0) {
        const now = Math.floor(Date.now() / 1000);
        const getTs = (e: any, field: 'start' | 'end') => {
          if (field === 'start') return parseInt(e.start_timestamp) || Math.floor(new Date(e.start + ' UTC').getTime() / 1000);
          return parseInt(e.stop_timestamp) || Math.floor(new Date(e.end + ' UTC').getTime() / 1000);
        };
        const current = data.epg_listings.find((e: any) => {
          return now >= getTs(e, 'start') && now <= getTs(e, 'end');
        });
        const next = data.epg_listings.find((e: any) => getTs(e, 'start') > now);
        setEpgCurrent(current || null);
        setEpgNext(next || null);
        if (current) {
          const start = getTs(current, 'start');
          const end = getTs(current, 'end');
          const prog = (now - start) / (end - start);
          setEpgProgress(Math.min(Math.max(prog, 0), 1));
        }
      }
    } catch (e) { /* skip */ }
  }, [username, password, currentChannel.streamType]);

  useEffect(() => { loadEpg(currentChannel.streamId); }, [currentChannel.streamId, loadEpg]);

  // EPG progress updater
  useEffect(() => {
    if (!epgCurrent) return;
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const start = parseInt(epgCurrent.start_timestamp) || Math.floor(new Date(epgCurrent.start + ' UTC').getTime() / 1000);
      const end = parseInt(epgCurrent.stop_timestamp) || Math.floor(new Date(epgCurrent.end + ' UTC').getTime() / 1000);
      setEpgProgress(Math.min(Math.max((now - start) / (end - start), 0), 1));
    }, 10000);
    return () => clearInterval(interval);
  }, [epgCurrent]);

  // Video player
  const player = useVideoPlayer(streamUrl || '', (p) => {
    if (streamUrl) p.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Auto-hide overlay after 5 seconds
  const scheduleHideOverlay = () => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowOverlay(false));
    }, 5000);
  };

  const toggleOverlay = () => {
    if (showOverlay) {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowOverlay(false));
    } else {
      setShowOverlay(true);
      Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      scheduleHideOverlay();
    }
  };

  // Show TV guide overlay for 3 seconds on channel change
  const showTvGuide = () => {
    setShowGuide(true);
    Animated.timing(guideOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (guideTimer.current) clearTimeout(guideTimer.current);
    guideTimer.current = setTimeout(() => {
      Animated.timing(guideOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => setShowGuide(false));
    }, 3000);
  };

  // Flash channel logo on switch
  const flashLogo = (icon: string) => {
    setSwitchingLogo(icon);
    Animated.sequence([
      Animated.timing(logoOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(logoOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setSwitchingLogo(null));
  };

  // Switch to next/prev channel
  const switchChannel = (direction: 'next' | 'prev') => {
    if (channelList.length === 0) return;
    let newIdx = direction === 'next'
      ? (currentIndex + 1) % channelList.length
      : (currentIndex - 1 + channelList.length) % channelList.length;
    const ch = channelList[newIdx];
    if (!ch) return;
    setCurrentIndex(newIdx);
    setCurrentChannel({
      streamId: ch.stream_id,
      streamName: ch.name,
      streamIcon: ch.stream_icon || '',
      streamType: 'live',
      categoryName: currentChannel.categoryName,
      categoryId: currentChannel.categoryId,
      containerExtension: 'ts',
    });
    flashLogo(ch.stream_icon || '');
    showTvGuide();
    setEpgCurrent(null);
    setEpgNext(null);
    setEpgProgress(0);
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  useEffect(() => {
    if (!loading && !error) {
      setShowOverlay(true);
      overlayOpacity.setValue(1);
      scheduleHideOverlay();
      showTvGuide();
    }
    return () => {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      if (guideTimer.current) clearTimeout(guideTimer.current);
    };
  }, [loading, error]);

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      {/* Background touch layer - ALWAYS responds to taps to toggle overlay */}
      <TouchableOpacity activeOpacity={1} onPress={toggleOverlay} style={StyleSheet.absoluteFill}>
        {/* Video */}
        {streamUrl && !loading ? (
          <VideoView
            testID="video-player"
            style={StyleSheet.absoluteFill}
            player={player}
            allowsPictureInPicture
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View style={styles.blackBg}>
            {loading ? (
              <View style={styles.centerWrap}>
                <ActivityIndicator size="large" color="#00BFFF" />
                <Text style={styles.loadingText}>Loading stream...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerWrap}>
                <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity testID="player-retry-btn" style={styles.retryBtn} onPress={() => resolveUrl(currentChannel.streamId, currentChannel.streamType, currentChannel.containerExtension)}>
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </TouchableOpacity>

      {/* Channel logo flash on switch */}
      {switchingLogo !== null && (
        <Animated.View style={[styles.logoFlash, { opacity: logoOpacity }]}>
          {switchingLogo ? (
            <Image source={{ uri: switchingLogo }} style={styles.logoFlashImg} resizeMode="contain" />
          ) : (
            <Ionicons name="tv" size={60} color="#fff" />
          )}
        </Animated.View>
      )}

      {/* TV Guide overlay (auto-shows for 3 seconds) */}
      {showGuide && (
        <Animated.View style={[styles.guideOverlay, { opacity: guideOpacity }]}>
          <View style={styles.guideContent}>
            {currentChannel.streamIcon ? (
              <Image source={{ uri: currentChannel.streamIcon }} style={styles.guideIcon} resizeMode="contain" />
            ) : null}
            <View style={styles.guideTextWrap}>
              <Text style={styles.guideChannelName} numberOfLines={1}>{currentChannel.streamName}</Text>
              {epgCurrent?.title ? (
                <Text style={styles.guideProgramName} numberOfLines={1}>{epgCurrent.title}</Text>
              ) : null}
              {epgCurrent && (
                <View style={styles.guideProgressBar}>
                  <View style={[styles.guideProgressFill, { width: `${epgProgress * 100}%` }]} />
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Player overlay (Tubi-style) - pointerEvents box-none so background taps reach outer TouchableOpacity */}
      {showOverlay && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="box-none">
          {/* Top bar */}
          <SafeAreaView edges={['top']} style={styles.topBar}>
            <TouchableOpacity testID="player-back-btn" onPress={() => {
              if (Platform.OS !== 'web') ScreenOrientation.unlockAsync().catch(() => {});
              router.back();
            }} style={styles.topBtn}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </SafeAreaView>

          {/* Right side: channel up/down arrows + logo */}
          {currentChannel.streamType === 'live' && (
            <View style={styles.rightControls}>
              <TouchableOpacity testID="channel-up-btn" style={styles.channelBtn} onPress={() => switchChannel('prev')}>
                <Ionicons name="chevron-up" size={32} color="#fff" />
              </TouchableOpacity>
              {currentChannel.streamIcon ? (
                <Image source={{ uri: currentChannel.streamIcon }} style={styles.rightLogo} resizeMode="contain" />
              ) : null}
              <TouchableOpacity testID="channel-down-btn" style={styles.channelBtn} onPress={() => switchChannel('next')}>
                <Ionicons name="chevron-down" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom info (Tubi-style) */}
          <View style={styles.bottomOverlay}>
            {/* Channel info */}
            <View style={styles.bottomInfo}>
              <Text style={styles.channelName} numberOfLines={1}>{currentChannel.streamName}</Text>
              {epgCurrent?.title ? (
                <Text style={styles.programName} numberOfLines={1}>{epgCurrent.title}</Text>
              ) : null}
              {currentChannel.streamType === 'live' && (
                <View style={styles.liveBadge}>
                  <Ionicons name="flash" size={12} color="#fff" />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>

            {/* Progress bar */}
            {epgCurrent && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${epgProgress * 100}%` }]} />
                </View>
                <View style={styles.progressTimes}>
                  <Text style={styles.progressTime}>{formatTime(epgCurrent.start)}</Text>
                  <Text style={styles.progressTime}>{formatTime(epgCurrent.stop || epgCurrent.end)}</Text>
                </View>
              </View>
            )}

            {/* Bottom controls */}
            <SafeAreaView edges={['bottom']} style={styles.bottomControls}>
              <TouchableOpacity testID="player-fav-btn" style={styles.bottomBtn}>
                <Ionicons name="star-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="player-info-btn" style={styles.bottomBtn}>
                <Ionicons name="information-circle-outline" size={22} color="#fff" />
              </TouchableOpacity>

              {/* Center: prev | pause/play | next */}
              <View style={styles.centerControls}>
                <TouchableOpacity testID="player-prev-btn" style={styles.centerBtn} onPress={() => switchChannel('prev')}>
                  <Ionicons name="play-skip-back" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity testID="player-play-btn" style={styles.playBtn} onPress={() => {
                  if (player.playing) player.pause();
                  else player.play();
                }}>
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity testID="player-next-btn" style={styles.centerBtn} onPress={() => switchChannel('next')}>
                  <Ionicons name="play-skip-forward" size={26} color="#fff" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity testID="player-share-btn" style={styles.bottomBtn}>
                <Ionicons name="share-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="player-grid-btn" style={styles.bottomBtn}>
                <Ionicons name="grid-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  blackBg: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  centerWrap: { alignItems: 'center', gap: 12 },
  loadingText: { color: '#888', fontSize: 14 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00BFFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Logo flash
  logoFlash: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  logoFlashImg: { width: 120, height: 80 },

  // TV Guide overlay
  guideOverlay: {
    position: 'absolute', top: 60, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 12, padding: 16,
  },
  guideContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  guideIcon: { width: 48, height: 48, borderRadius: 8 },
  guideTextWrap: { flex: 1 },
  guideChannelName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  guideProgramName: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  guideProgressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 8 },
  guideProgressFill: { height: '100%', backgroundColor: '#00BFFF', borderRadius: 2 },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 4 },
  topBtn: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },

  // Right controls (channel up/down + logo)
  rightControls: {
    position: 'absolute', right: 16, top: '30%',
    alignItems: 'center', gap: 8,
  },
  channelBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  rightLogo: { width: 60, height: 40, marginVertical: 4 },

  // Bottom overlay
  bottomOverlay: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  bottomInfo: { marginBottom: 8 },
  channelName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  programName: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E50914', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 4, alignSelf: 'flex-start', marginTop: 8,
  },
  liveText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Progress
  progressContainer: { marginBottom: 8 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  progressTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressTime: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  // Bottom controls
  bottomControls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 4,
  },
  bottomBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  centerControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  centerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  playBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
});
