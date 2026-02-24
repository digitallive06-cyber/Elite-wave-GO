import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Animated, Platform, useWindowDimensions
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
import { useFavorites } from '../src/contexts/FavoritesContext';
import { api } from '../src/utils/api';

const ASPECT_MODES = ['contain', 'cover', 'fill'] as const;
type ContentFit = typeof ASPECT_MODES[number];
const ASPECT_LABELS: Record<ContentFit, string> = { contain: 'FIT', cover: 'FILL', fill: 'STRETCH' };

export default function PlayerScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();
  const { width: ww, height: wh } = useWindowDimensions();
  const params = useLocalSearchParams<{
    streamId: string; streamName: string; streamIcon: string;
    streamType: string; categoryName: string; categoryId: string;
    containerExtension: string; directUrl: string;
  }>();

  // Track if opened in landscape (rotation-triggered) for auto-exit
  const openedInLandscape = useRef(ww > wh);
  const hasExited = useRef(false);

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

  // System bars + orientation
  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Only lock to landscape if opened in portrait (button press) - not when already landscape
      if (!openedInLandscape.current) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      }
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }
    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.unlockAsync().catch(() => {});
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
    };
  }, []);

  // Exit fullscreen when rotated back to portrait (only if opened in landscape = natural rotation)
  useEffect(() => {
    if (!openedInLandscape.current || Platform.OS === 'web') return;
    if (wh > ww && !hasExited.current) {
      hasExited.current = true;
      if (Platform.OS !== 'web') {
        ScreenOrientation.unlockAsync().catch(() => {});
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
      router.back();
    }
  }, [ww, wh]);

  // Load channel list for prev/next switching
  useEffect(() => {
    if (currentChannel.streamType !== 'live') return;
    api.getLiveStreams(username, password, currentChannel.categoryId || undefined).then(data => {
      const arr = Array.isArray(data) ? data : [];
      setChannelList(arr);
      const idx = arr.findIndex((s: any) => s.stream_id === currentChannel.streamId);
      if (idx >= 0) setCurrentIndex(idx);
    }).catch(() => {});
  }, [currentChannel.categoryId]);

  // Resolve stream URL - clears old URL first (black screen)
  const resolveUrl = useCallback(async (streamId: number, sType: string, ext: string) => {
    setStreamUrl(null); // Clear → shows black screen immediately
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

  // Init: use directUrl on first mount if provided, otherwise resolve
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (params.directUrl && params.directUrl.length > 5) {
        setStreamUrl(params.directUrl);
        setLoading(false);
        api.addHistory({ username, stream_id: currentChannel.streamId, stream_name: currentChannel.streamName, stream_icon: currentChannel.streamIcon, stream_type: currentChannel.streamType, category_name: currentChannel.categoryName }).catch(() => {});
        return;
      }
    }
    resolveUrl(currentChannel.streamId, currentChannel.streamType, currentChannel.containerExtension);
    api.addHistory({ username, stream_id: currentChannel.streamId, stream_name: currentChannel.streamName, stream_icon: currentChannel.streamIcon, stream_type: currentChannel.streamType, category_name: currentChannel.categoryName }).catch(() => {});
  }, [currentChannel.streamId]);

  // Load EPG
  const loadEpg = useCallback(async (streamId: number) => {
    if (currentChannel.streamType !== 'live') return;
    try {
      const data = await api.getEpg(username, password, streamId);
      if (data?.epg_listings?.length > 0) {
        const now = Math.floor(Date.now() / 1000);
        const getTs = (e: any, f: 'start' | 'end') => f === 'start'
          ? parseInt(e.start_timestamp) || Math.floor(new Date(e.start + ' UTC').getTime() / 1000)
          : parseInt(e.stop_timestamp) || Math.floor(new Date(e.end + ' UTC').getTime() / 1000);
        const cur = data.epg_listings.find((e: any) => now >= getTs(e, 'start') && now <= getTs(e, 'end'));
        const nxt = data.epg_listings.find((e: any) => getTs(e, 'start') > now);
        setEpgCurrent(cur || null); setEpgNext(nxt || null);
        if (cur) setEpgProgress(Math.min(Math.max((now - getTs(cur, 'start')) / (getTs(cur, 'end') - getTs(cur, 'start')), 0), 1));
      }
    } catch { /* skip */ }
  }, [username, password, currentChannel.streamType]);

  useEffect(() => { loadEpg(currentChannel.streamId); }, [currentChannel.streamId, loadEpg]);

  useEffect(() => {
    if (!epgCurrent) return;
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const s = parseInt(epgCurrent.start_timestamp) || Math.floor(new Date(epgCurrent.start + ' UTC').getTime() / 1000);
      const e = parseInt(epgCurrent.stop_timestamp) || Math.floor(new Date(epgCurrent.end + ' UTC').getTime() / 1000);
      setEpgProgress(Math.min(Math.max((now - s) / (e - s), 0), 1));
    }, 10000);
    return () => clearInterval(interval);
  }, [epgCurrent]);

  const player = useVideoPlayer(streamUrl || '', (p) => { if (streamUrl) p.play(); });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Overlay management
  const scheduleHide = useCallback(() => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowOverlay(false));
    }, 5000);
  }, [overlayOpacity]);

  const showOverlayNow = useCallback(() => {
    setShowOverlay(true); overlayOpacity.setValue(1); scheduleHide();
  }, [overlayOpacity, scheduleHide]);

  const hideOverlayNow = useCallback(() => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowOverlay(false));
  }, [overlayOpacity]);

  const toggleOverlay = useCallback(() => {
    showOverlay ? hideOverlayNow() : showOverlayNow();
  }, [showOverlay, showOverlayNow, hideOverlayNow]);

  const showTvGuide = () => {
    setShowGuide(true); guideOpacity.setValue(0);
    Animated.timing(guideOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (guideTimer.current) clearTimeout(guideTimer.current);
    guideTimer.current = setTimeout(() => {
      Animated.timing(guideOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => setShowGuide(false));
    }, 3000);
  };

  const flashLogo = (icon: string) => {
    setSwitchingLogo(icon);
    Animated.sequence([
      Animated.timing(logoOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(logoOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setSwitchingLogo(null));
  };

  const switchChannel = (direction: 'next' | 'prev') => {
    if (channelList.length === 0) return;
    const newIdx = direction === 'next'
      ? (currentIndex + 1) % channelList.length
      : (currentIndex - 1 + channelList.length) % channelList.length;
    const ch = channelList[newIdx];
    if (!ch) return;
    setCurrentIndex(newIdx);
    setCurrentChannel(prev => ({ ...prev, streamId: ch.stream_id, streamName: ch.name, streamIcon: ch.stream_icon || '' }));
    flashLogo(ch.stream_icon || '');
    showTvGuide();
    setEpgCurrent(null); setEpgNext(null); setEpgProgress(0);
  };

  const cycleAspect = () => {
    setContentFit(prev => ASPECT_MODES[(ASPECT_MODES.indexOf(prev) + 1) % ASPECT_MODES.length]);
  };

  const formatTime = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  useEffect(() => {
    if (!loading && !error) { showOverlayNow(); showTvGuide(); }
    return () => {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      if (guideTimer.current) clearTimeout(guideTimer.current);
    };
  }, [loading, error]);

  const handleBack = useCallback(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.unlockAsync().catch(() => {});
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    }
    router.back();
  }, [router]);

  const favData = { stream_id: currentChannel.streamId, name: currentChannel.streamName, stream_icon: currentChannel.streamIcon, category_id: currentChannel.categoryId };
  const starred = isFavorite(currentChannel.streamId);

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* VIDEO */}
      {streamUrl ? (
        <VideoView testID="video-player" style={StyleSheet.absoluteFill} player={player}
          allowsPictureInPicture contentFit={contentFit} nativeControls={false} />
      ) : null}

      {/* LOADING / ERROR */}
      {(loading || !!error) && (
        <View style={[StyleSheet.absoluteFill, styles.blackBg]} pointerEvents="none">
          <View style={styles.centerWrap}>
            {loading ? (
              <>
                <ActivityIndicator size="large" color="#00BFFF" />
                <Text style={styles.loadingText}>Loading...</Text>
              </>
            ) : (
              <>
                <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </>
            )}
          </View>
        </View>
      )}
      {!!error && (
        <View style={styles.retryWrap}>
          <TouchableOpacity style={styles.retryBtn} onPress={() => resolveUrl(currentChannel.streamId, currentChannel.streamType, currentChannel.containerExtension)}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LOGO FLASH - black bg + logo */}
      {switchingLogo !== null && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.blackBg, { opacity: logoOpacity }]} pointerEvents="none">
          <View style={styles.centerWrap}>
            {switchingLogo ? (
              <Image source={{ uri: switchingLogo }} style={styles.logoFlashImg} resizeMode="contain" />
            ) : (
              <Ionicons name="tv" size={64} color="rgba(255,255,255,0.4)" />
            )}
          </View>
        </Animated.View>
      )}

      {/* TV GUIDE OVERLAY */}
      {showGuide && (
        <Animated.View style={[styles.guideOverlay, { opacity: guideOpacity }]} pointerEvents="none">
          <View style={styles.guideContent}>
            {currentChannel.streamIcon ? (
              <Image source={{ uri: currentChannel.streamIcon }} style={styles.guideIcon} resizeMode="contain" />
            ) : null}
            <View style={styles.guideTextWrap}>
              <Text style={styles.guideChannelName} numberOfLines={1}>{currentChannel.streamName}</Text>
              {epgCurrent?.title ? <Text style={styles.guideProgramName} numberOfLines={1}>{epgCurrent.title}</Text> : null}
              {epgCurrent && <View style={styles.guideProgressBar}><View style={[styles.guideProgressFill, { width: `${epgProgress * 100}%` }]} /></View>}
            </View>
          </View>
        </Animated.View>
      )}

      {/* OVERLAY HIDDEN: tap to show */}
      {!showOverlay && (
        <TouchableOpacity testID="player-tap-show" activeOpacity={1} style={StyleSheet.absoluteFill} onPress={toggleOverlay} />
      )}

      {/* OVERLAY VISIBLE */}
      {showOverlay && (
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}>
          {/* Background tap to hide */}
          <TouchableOpacity testID="player-tap-hide" activeOpacity={1} style={StyleSheet.absoluteFill} onPress={toggleOverlay} />

          {/* TOP BAR - slim, very transparent */}
          <SafeAreaView edges={['top', 'left', 'right']} style={styles.topBar} pointerEvents="box-none">
            <TouchableOpacity testID="player-back-btn" onPress={handleBack} style={styles.topBtn}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
            <Text style={styles.topChannelName} numberOfLines={1}>{currentChannel.streamName}</Text>
            <TouchableOpacity testID="player-aspect-btn" onPress={cycleAspect} style={styles.aspectBtn}>
              <Text style={styles.aspectLabel}>{ASPECT_LABELS[contentFit]}</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {/* RIGHT: channel up/down */}
          {currentChannel.streamType === 'live' && (
            <View style={styles.rightControls} pointerEvents="box-none">
              <TouchableOpacity testID="channel-up-btn" style={styles.channelBtn} onPress={() => switchChannel('prev')}>
                <Ionicons name="chevron-up" size={28} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
              {currentChannel.streamIcon ? (
                <Image source={{ uri: currentChannel.streamIcon }} style={styles.rightLogo} resizeMode="contain" />
              ) : null}
              <TouchableOpacity testID="channel-down-btn" style={styles.channelBtn} onPress={() => switchChannel('next')}>
                <Ionicons name="chevron-down" size={28} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>
          )}

          {/* BOTTOM OVERLAY */}
          <View style={styles.bottomOverlay} pointerEvents="box-none">
            <View style={styles.bottomInfo}>
              <Text style={styles.channelNameText} numberOfLines={1}>{currentChannel.streamName}</Text>
              {epgCurrent?.title ? <Text style={styles.programNameText} numberOfLines={1}>{epgCurrent.title}</Text> : null}
              {currentChannel.streamType === 'live' && (
                <View style={styles.liveBadge}><Text style={styles.liveText}>LIVE</Text></View>
              )}
            </View>
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
            <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bottomControls}>
              <TouchableOpacity testID="player-fav-btn" style={styles.bottomBtn} onPress={() => toggleFavorite(favData)}>
                <Ionicons name={starred ? 'star' : 'star-outline'} size={22} color={starred ? '#FFD700' : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomBtn}><Ionicons name="information-circle-outline" size={22} color="#fff" /></TouchableOpacity>
              <View style={styles.centerControls}>
                <TouchableOpacity testID="player-prev-btn" style={styles.centerBtn} onPress={() => switchChannel('prev')}>
                  <Ionicons name="play-skip-back" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity testID="player-play-btn" style={styles.playBtn} onPress={() => {
                  if (player.playing) player.pause(); else player.play();
                }}>
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity testID="player-next-btn" style={styles.centerBtn} onPress={() => switchChannel('next')}>
                  <Ionicons name="play-skip-forward" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.bottomBtn}><Ionicons name="share-outline" size={22} color="#fff" /></TouchableOpacity>
              <TouchableOpacity style={styles.bottomBtn}><Ionicons name="grid-outline" size={22} color="#fff" /></TouchableOpacity>
            </SafeAreaView>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  blackBg: { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  centerWrap: { alignItems: 'center', gap: 12 },
  loadingText: { color: '#666', fontSize: 13 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  retryWrap: { position: 'absolute', bottom: '40%', alignSelf: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00BFFF', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logoFlashImg: { width: 160, height: 100 },

  // Guide overlay
  guideOverlay: { position: 'absolute', top: 48, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 10, padding: 12 },
  guideContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  guideIcon: { width: 44, height: 44, borderRadius: 6 },
  guideTextWrap: { flex: 1 },
  guideChannelName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  guideProgramName: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  guideProgressBar: { height: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 1, marginTop: 6 },
  guideProgressFill: { height: '100%', backgroundColor: '#00BFFF', borderRadius: 1 },

  // Top bar - slim + transparent
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  topBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  topChannelName: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginLeft: 4 },
  aspectBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, marginRight: 4,
  },
  aspectLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },

  // Right controls
  rightControls: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', gap: 6 },
  channelBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  rightLogo: { width: 52, height: 36, marginVertical: 2 },

  // Bottom overlay
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 4 },
  bottomInfo: { marginBottom: 6 },
  channelNameText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  programNameText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  liveBadge: { backgroundColor: '#E50914', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3, alignSelf: 'flex-start', marginTop: 4 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  progressContainer: { marginBottom: 8 },
  progressBar: { height: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 1 },
  progressFill: { height: '100%', backgroundColor: '#00BFFF', borderRadius: 1 },
  progressTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  progressTime: { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
  bottomControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  centerControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  centerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
});
