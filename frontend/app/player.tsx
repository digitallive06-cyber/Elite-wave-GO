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

const ASPECT_MODES = ['contain', 'cover', 'fill'] as const;
type ContentFit = typeof ASPECT_MODES[number];
const ASPECT_LABELS: Record<ContentFit, string> = { contain: 'FIT', cover: 'FILL', fill: 'STRETCH' };

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
    directUrl: string;
  }>();

  const [streamUrl, setStreamUrl] = useState<string | null>(
    params.directUrl && params.directUrl.length > 5 ? params.directUrl : null
  );
  const [loading, setLoading] = useState(!params.directUrl || params.directUrl.length <= 5);
  const [error, setError] = useState('');
  const [contentFit, setContentFit] = useState<ContentFit>('contain');
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
  const isFirstMount = useRef(true);

  const [currentChannel, setCurrentChannel] = useState({
    streamId: parseInt(params.streamId || '0'),
    streamName: params.streamName || 'Unknown',
    streamIcon: params.streamIcon || '',
    streamType: params.streamType || 'live',
    categoryName: params.categoryName || '',
    categoryId: params.categoryId || '',
    containerExtension: params.containerExtension || 'ts',
  });

  // Lock landscape + hide system bars on mount
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

  // Load channel list for prev/next switching
  useEffect(() => {
    if (currentChannel.streamType !== 'live') return;
    const catId = currentChannel.categoryId || undefined;
    api.getLiveStreams(username, password, catId).then(data => {
      const arr = Array.isArray(data) ? data : [];
      setChannelList(arr);
      const idx = arr.findIndex((s: any) => s.stream_id === currentChannel.streamId);
      if (idx >= 0) setCurrentIndex(idx);
    }).catch(() => {});
  }, [currentChannel.categoryId, currentChannel.streamType]);

  // Resolve stream URL
  const resolveUrl = useCallback(async (streamId: number, sType: string, ext: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStreamUrl(username, password, streamId, sType, ext);
      setStreamUrl(data.url);
    } catch (e: any) {
      setError(e.message || 'Failed to load stream');
    } finally {
      setLoading(false);
    }
  }, [username, password]);

  // On channel change: use directUrl on first mount if provided, otherwise resolve
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (params.directUrl && params.directUrl.length > 5) {
        // Use pre-resolved URL — no re-resolution needed
        setStreamUrl(params.directUrl);
        setLoading(false);
        api.addHistory({
          username,
          stream_id: currentChannel.streamId,
          stream_name: currentChannel.streamName,
          stream_icon: currentChannel.streamIcon,
          stream_type: currentChannel.streamType,
          category_name: currentChannel.categoryName,
        }).catch(() => {});
        return;
      }
    }
    resolveUrl(currentChannel.streamId, currentChannel.streamType, currentChannel.containerExtension);
    api.addHistory({
      username,
      stream_id: currentChannel.streamId,
      stream_name: currentChannel.streamName,
      stream_icon: currentChannel.streamIcon,
      stream_type: currentChannel.streamType,
      category_name: currentChannel.categoryName,
    }).catch(() => {});
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
        const current = data.epg_listings.find((e: any) => now >= getTs(e, 'start') && now <= getTs(e, 'end'));
        const next = data.epg_listings.find((e: any) => getTs(e, 'start') > now);
        setEpgCurrent(current || null);
        setEpgNext(next || null);
        if (current) {
          const start = getTs(current, 'start');
          const end = getTs(current, 'end');
          setEpgProgress(Math.min(Math.max((now - start) / (end - start), 0), 1));
        }
      }
    } catch (e) { /* skip */ }
  }, [username, password, currentChannel.streamType]);

  useEffect(() => { loadEpg(currentChannel.streamId); }, [currentChannel.streamId, loadEpg]);

  // EPG progress tick
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

  // Overlay auto-hide
  const scheduleHideOverlay = useCallback(() => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowOverlay(false));
    }, 5000);
  }, [overlayOpacity]);

  const showOverlayNow = useCallback(() => {
    setShowOverlay(true);
    overlayOpacity.setValue(1);
    scheduleHideOverlay();
  }, [overlayOpacity, scheduleHideOverlay]);

  const hideOverlayNow = useCallback(() => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowOverlay(false));
  }, [overlayOpacity]);

  const toggleOverlay = useCallback(() => {
    if (showOverlay) {
      hideOverlayNow();
    } else {
      showOverlayNow();
    }
  }, [showOverlay, showOverlayNow, hideOverlayNow]);

  // Show TV guide for 3s on channel change
  const showTvGuide = () => {
    setShowGuide(true);
    guideOpacity.setValue(0);
    Animated.timing(guideOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (guideTimer.current) clearTimeout(guideTimer.current);
    guideTimer.current = setTimeout(() => {
      Animated.timing(guideOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => setShowGuide(false));
    }, 3000);
  };

  // Flash logo on channel switch
  const flashLogo = (icon: string) => {
    setSwitchingLogo(icon);
    Animated.sequence([
      Animated.timing(logoOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(logoOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setSwitchingLogo(null));
  };

  // Switch channel
  const switchChannel = (direction: 'next' | 'prev') => {
    if (channelList.length === 0) return;
    const newIdx = direction === 'next'
      ? (currentIndex + 1) % channelList.length
      : (currentIndex - 1 + channelList.length) % channelList.length;
    const ch = channelList[newIdx];
    if (!ch) return;
    setCurrentIndex(newIdx);
    setCurrentChannel(prev => ({
      ...prev,
      streamId: ch.stream_id,
      streamName: ch.name,
      streamIcon: ch.stream_icon || '',
    }));
    flashLogo(ch.stream_icon || '');
    showTvGuide();
    setEpgCurrent(null);
    setEpgNext(null);
    setEpgProgress(0);
  };

  // Cycle aspect ratio
  const cycleAspect = () => {
    setContentFit(prev => {
      const idx = ASPECT_MODES.indexOf(prev);
      return ASPECT_MODES[(idx + 1) % ASPECT_MODES.length];
    });
  };

  const formatTime = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  // Show overlay + guide when stream loads
  useEffect(() => {
    if (!loading && !error) {
      showOverlayNow();
      showTvGuide();
    }
    return () => {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      if (guideTimer.current) clearTimeout(guideTimer.current);
    };
  }, [loading, error]);

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.unlockAsync().catch(() => {});
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* === VIDEO (always rendered) === */}
      {streamUrl ? (
        <VideoView
          testID="video-player"
          style={StyleSheet.absoluteFill}
          player={player}
          allowsPictureInPicture
          contentFit={contentFit}
          nativeControls={false}
        />
      ) : null}

      {/* === LOADING / ERROR (non-interactive) === */}
      {(loading || !!error) && (
        <View style={[StyleSheet.absoluteFill, styles.loadingBg]} pointerEvents="none">
          {loading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color="#00BFFF" />
              <Text style={styles.loadingText}>Loading stream...</Text>
            </View>
          ) : (
            <View style={styles.centerWrap}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
      )}
      {/* Error retry button (interactive, separate from non-interactive overlay) */}
      {!!error && (
        <View style={styles.retryWrap}>
          <TouchableOpacity testID="player-retry-btn" style={styles.retryBtn}
            onPress={() => resolveUrl(currentChannel.streamId, currentChannel.streamType, currentChannel.containerExtension)}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* === WHEN OVERLAY HIDDEN: invisible tap layer to show controls === */}
      {!showOverlay && (
        <TouchableOpacity
          testID="player-tap-show"
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={toggleOverlay}
        />
      )}

      {/* === LOGO FLASH (non-interactive) === */}
      {switchingLogo !== null && (
        <Animated.View style={[styles.logoFlash, { opacity: logoOpacity }]} pointerEvents="none">
          {switchingLogo ? (
            <Image source={{ uri: switchingLogo }} style={styles.logoFlashImg} resizeMode="contain" />
          ) : (
            <Ionicons name="tv" size={60} color="#fff" />
          )}
        </Animated.View>
      )}

      {/* === TV GUIDE OVERLAY (non-interactive, shows 3s on channel change) === */}
      {showGuide && (
        <Animated.View style={[styles.guideOverlay, { opacity: guideOpacity }]} pointerEvents="none">
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

      {/* === WHEN OVERLAY VISIBLE: gradient bg + controls === */}
      {showOverlay && (
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
        >
          {/* Background tap to HIDE overlay */}
          <TouchableOpacity
            testID="player-tap-hide"
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={toggleOverlay}
          />

          {/* Top bar — box-none wrapper so background tap still works */}
          <SafeAreaView edges={['top', 'left', 'right']} style={styles.topBar} pointerEvents="box-none">
            <TouchableOpacity testID="player-back-btn" onPress={handleBack} style={styles.topBtn}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {/* Aspect ratio button */}
            <TouchableOpacity testID="player-aspect-btn" onPress={cycleAspect} style={styles.aspectBtn}>
              <Ionicons name="scan-outline" size={18} color="#fff" />
              <Text style={styles.aspectLabel}>{ASPECT_LABELS[contentFit]}</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {/* Right: channel up/down + logo */}
          {currentChannel.streamType === 'live' && (
            <View style={styles.rightControls} pointerEvents="box-none">
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

          {/* Bottom overlay */}
          <View style={styles.bottomOverlay} pointerEvents="box-none">
            {/* Channel name + EPG */}
            <View style={styles.bottomInfo}>
              <Text style={styles.channelNameText} numberOfLines={1}>{currentChannel.streamName}</Text>
              {epgCurrent?.title ? (
                <Text style={styles.programNameText} numberOfLines={1}>{epgCurrent.title}</Text>
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
            <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bottomControls}>
              <TouchableOpacity testID="player-fav-btn" style={styles.bottomBtn}>
                <Ionicons name="star-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="player-info-btn" style={styles.bottomBtn}>
                <Ionicons name="information-circle-outline" size={22} color="#fff" />
              </TouchableOpacity>

              {/* Center: prev | play/pause | next */}
              <View style={styles.centerControls}>
                <TouchableOpacity testID="player-prev-btn" style={styles.centerBtn} onPress={() => switchChannel('prev')}>
                  <Ionicons name="play-skip-back" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity testID="player-play-btn" style={styles.playBtn} onPress={() => {
                  if (player.playing) player.pause(); else player.play();
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
  loadingBg: { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  centerWrap: { alignItems: 'center', gap: 12 },
  loadingText: { color: '#888', fontSize: 14 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryWrap: { position: 'absolute', bottom: '40%', alignSelf: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00BFFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Logo flash
  logoFlash: {
    ...StyleSheet.absoluteFillObject,
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

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 4,
    backgroundColor: 'linear-gradient(transparent, rgba(0,0,0,0.5))' as any,
  },
  topBtn: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  aspectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 8,
  },
  aspectLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Right controls
  rightControls: {
    position: 'absolute', right: 16, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  channelBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  rightLogo: { width: 60, height: 40, marginVertical: 4 },

  // Bottom overlay
  bottomOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.0)',
  },
  bottomInfo: { marginBottom: 8 },
  channelNameText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  programNameText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 4, alignSelf: 'flex-start', marginTop: 6,
  },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Progress
  progressContainer: { marginBottom: 10 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: '#00BFFF', borderRadius: 2 },
  progressTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressTime: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  // Bottom controls
  bottomControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  centerControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  centerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
});
