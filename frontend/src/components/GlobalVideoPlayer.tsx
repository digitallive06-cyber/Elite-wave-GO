import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Pressable,
  Platform, BackHandler, useWindowDimensions, Image, Animated, StatusBar,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useRouter, usePathname } from 'expo-router';
import { useGlobalVideo } from '../contexts/GlobalVideoContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

const RESIZE_MODES = [ResizeMode.CONTAIN, ResizeMode.COVER, ResizeMode.STRETCH];
const RESIZE_LABELS = ['FIT', 'FILL', 'STRETCH'];

const formatTime = (t: string) => {
  try {
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
};

export const GlobalVideoPlayer: React.FC = () => {
  const {
    videoRef, state, streamList, playStream, stopStream, setFullscreen,
    togglePlay, cycleResizeMode, setIsPlaying, setTransitioning, tryFallbackUrl, setMuted,
    liveGuideActive,
  } = useGlobalVideo();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { username, password } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [showControls, setShowControls] = useState(true);
  const isFullscreenRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionOpacity = useRef(new Animated.Value(1)).current;

  // EPG state for fullscreen TV guide
  const [nowProgram, setNowProgram] = useState<{ title: string; start: string; end: string } | null>(null);
  const [nextProgram, setNextProgram] = useState<{ title: string; start: string; end: string } | null>(null);

  // Tab detection
  const isOnLiveTab = pathname?.includes('live') || false;
  const isOnHomeTab = pathname === '/' || pathname === '/(tabs)' || pathname?.includes('home') || false;
  const isOnMultiview = pathname?.includes('multiview') || false;
  const hasStream = !!state.streamUrl;
  const isFS = state.isFullscreen;
  // Only show inline player on Live tab when user is in guide mode (selected a channel from list)
  // Never show inline player on Home tab - the static hero card handles that
  const showPlayer = hasStream && isOnLiveTab && liveGuideActive && !isFS;
  const showHidden = hasStream && !isFS && !showPlayer;

  // Keep refs in sync
  useEffect(() => { isFullscreenRef.current = isFS; }, [isFS]);
  useEffect(() => { isTransitioningRef.current = state.isTransitioning; }, [state.isTransitioning]);

  // Auto unmute on Live tab or fullscreen
  useEffect(() => {
    if (!hasStream) return;
    if (isOnLiveTab || isFS) {
      setMuted(false);
    }
  }, [isOnLiveTab, isFS, hasStream, setMuted]);

  // Fetch EPG data for fullscreen TV guide
  useEffect(() => {
    if (!isFS || !state.streamId) { setNowProgram(null); setNextProgram(null); return; }
    const fetchEpg = async () => {
      try {
        const data = await api.getBatchEpg(username, password, [state.streamId!]);
        const programs = data?.[String(state.streamId)]?.epg_listings || [];
        const now = Math.floor(Date.now() / 1000);
        const current = programs.find((p: any) => Number(p.start_timestamp) <= now && Number(p.stop_timestamp) > now);
        const next = programs.find((p: any) => Number(p.start_timestamp) > now);
        setNowProgram(current ? { title: current.title, start: current.start, end: current.stop || current.end } : null);
        setNextProgram(next ? { title: next.title, start: next.start, end: next.stop || next.end } : null);
      } catch { setNowProgram(null); setNextProgram(null); }
    };
    fetchEpg();
  }, [isFS, state.streamId, username, password]);

  // --- Controls auto-hide ---
  const clearControlsTimer = useCallback(() => {
    if (controlsTimer.current) { clearTimeout(controlsTimer.current); controlsTimer.current = null; }
  }, []);
  const resetControlsTimer = useCallback(() => {
    clearControlsTimer();
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, [clearControlsTimer]);
  useEffect(() => {
    if (isFS) resetControlsTimer(); else { setShowControls(true); clearControlsTimer(); }
    return clearControlsTimer;
  }, [isFS, resetControlsTimer, clearControlsTimer]);

  // --- Transition overlay ---
  useEffect(() => {
    if (state.isTransitioning) {
      transitionOpacity.setValue(1);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => { if (isTransitioningRef.current) setTransitioning(false); }, 3000);
    }
    return () => { if (transitionTimer.current) clearTimeout(transitionTimer.current); };
  }, [state.isTransitioning, state.streamId, setTransitioning]);
  useEffect(() => {
    if (!state.isTransitioning) {
      Animated.timing(transitionOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }
  }, [state.isTransitioning, transitionOpacity]);

  // --- Orientation ---
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (isOnMultiview) return; // Let multiview manage its own orientation
    if (!hasStream) { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); return; }
    if (isFS) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
        .then(() => { setTimeout(() => { if (isFullscreenRef.current) ScreenOrientation.unlockAsync().catch(() => {}); }, 500); })
        .catch(() => {});
      if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      // Only unlock on Live tab to allow rotation-triggered fullscreen
      if (isOnLiveTab) {
        setTimeout(() => {
          if (!isFullscreenRef.current && state.streamUrl) ScreenOrientation.unlockAsync().catch(() => {});
        }, 300);
      }
      if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('visible').catch(() => {});
    }
  }, [hasStream, isFS, isOnLiveTab, isOnMultiview]);

  // --- Back button ---
  useEffect(() => {
    if (!isFS) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => { setFullscreen(false); return true; });
    return () => handler.remove();
  }, [isFS, setFullscreen]);

  // --- Orientation listener ---
  useEffect(() => {
    if (Platform.OS === 'web' || !hasStream || !isOnLiveTab) return;
    const sub = ScreenOrientation.addOrientationChangeListener((e) => {
      const o = e.orientationInfo.orientation;
      const landscape = o === ScreenOrientation.Orientation.LANDSCAPE_LEFT || o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      const portrait = o === ScreenOrientation.Orientation.PORTRAIT_UP || o === ScreenOrientation.Orientation.PORTRAIT_DOWN;
      if (landscape && !isFullscreenRef.current) setFullscreen(true);
      else if (portrait && isFullscreenRef.current) setFullscreen(false);
    });
    return () => ScreenOrientation.removeOrientationChangeListener(sub);
  }, [hasStream, setFullscreen, isOnLiveTab]);

  // --- Playback status ---
  const handlePlaybackStatus = useCallback((status: any) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      if (status.isPlaying && isTransitioningRef.current) setTransitioning(false);
    }
    if (status.error) { console.warn('Video error:', status.error); tryFallbackUrl(); }
  }, [setIsPlaying, setTransitioning, tryFallbackUrl]);

  // --- Channel up/down ---
  const handleChangeChannel = useCallback(async (direction: 'next' | 'prev') => {
    if (streamList.length === 0 || !state.streamId) return;
    const idx = streamList.findIndex((s: any) => s.stream_id === state.streamId);
    const newIdx = direction === 'next'
      ? (idx + 1) % streamList.length
      : (idx > 0 ? idx - 1 : streamList.length - 1);
    const channel = streamList[newIdx];
    if (!channel) return;
    try {
      const data = await api.getStreamUrl(username, password, channel.stream_id, 'live', 'ts');
      playStream(data.url, channel.name, channel.stream_icon || '', '', channel.stream_id, channel.category_id || '', data.fallback_url || '');
      resetControlsTimer();
    } catch (e) { console.error('Channel change error:', e); }
  }, [streamList, state.streamId, username, password, playStream, resetControlsTimer]);

  const handleFavToggle = useCallback(() => {
    if (!state.streamId) return;
    toggleFavorite({ stream_id: state.streamId, name: state.channelName, stream_icon: state.channelIcon, category_id: state.categoryId });
  }, [state.streamId, state.channelName, state.channelIcon, state.categoryId, toggleFavorite]);

  const handleMultiview = useCallback(() => {
    const mvParams = {
      streamId: String(state.streamId || ''),
      streamName: state.channelName,
      streamIcon: state.channelIcon,
      categoryId: state.categoryId,
      directUrl: state.streamUrl || '',
    };
    setFullscreen(false);
    stopStream();
    setTimeout(() => {
      router.push({ pathname: '/multiview', params: mvParams });
    }, 100);
  }, [setFullscreen, stopStream, router, state]);

  if (!hasStream) return null;

  const containerStyle = isFS
    ? [styles.fullscreenContainer, { width: screenW, height: screenH }]
    : showPlayer
      ? styles.inlineContainer
      : styles.hiddenContainer;

  return (
    <View style={containerStyle}>
      <Video
        ref={videoRef}
        testID="global-video-player"
        source={{ uri: state.streamUrl }}
        style={styles.video}
        resizeMode={RESIZE_MODES[state.resizeModeIdx]}
        shouldPlay={isFS || showPlayer}
        isMuted={state.isMuted || (!isFS && !showPlayer)}
        useNativeControls={false}
        onPlaybackStatusUpdate={handlePlaybackStatus}
      />

      {/* CHANNEL TRANSITION OVERLAY */}
      {state.isTransitioning && (showPlayer || isFS) && (
        <Animated.View style={[styles.transitionOverlay, { opacity: transitionOpacity }]}>
          <View style={styles.transitionContent}>
            {state.channelIcon ? (
              <Image source={{ uri: state.channelIcon }} style={styles.transitionIcon} resizeMode="contain" />
            ) : (
              <View style={styles.transitionIconPlaceholder}><Ionicons name="tv" size={40} color="#fff" /></View>
            )}
            <Text style={styles.transitionName}>{state.channelName}</Text>
            {state.programTitle ? <Text style={styles.transitionProgram}>{state.programTitle}</Text> : null}
          </View>
        </Animated.View>
      )}

      {/* INLINE CONTROLS */}
      {showPlayer && !state.isTransitioning && (
        <View style={styles.inlineOverlay} pointerEvents="box-none">
          <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={styles.inlineTopGrad}>
            <View style={styles.inlineInfoRow}>
              {state.channelIcon ? <Image source={{ uri: state.channelIcon }} style={styles.inlineIcon} resizeMode="contain" /> : null}
              <View style={styles.inlineInfoText}>
                <Text style={styles.inlineChannelName} numberOfLines={1}>{state.channelName}</Text>
                {state.programTitle ? <Text style={styles.inlineProgramName} numberOfLines={1}>{state.programTitle}</Text> : null}
              </View>
              <View style={styles.inlineLiveBadge}><Text style={styles.inlineLiveText}>LIVE</Text></View>
            </View>
          </LinearGradient>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.inlineBottomGrad}>
            <View style={styles.inlineControls}>
              {isOnHomeTab && (
                <TouchableOpacity style={styles.inlineBtn} onPress={() => { setMuted(!state.isMuted); }}>
                  <Ionicons name={state.isMuted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity testID="player-close-btn" style={styles.inlineBtn} onPress={stopStream}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="player-play-btn" style={styles.inlineBtn} onPress={togglePlay}>
                <Ionicons name={state.isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="player-fav-btn" style={styles.inlineBtn} onPress={handleFavToggle}>
                <Ionicons name={state.streamId && isFavorite(state.streamId) ? 'star' : 'star-outline'} size={18} color="#FFD700" />
              </TouchableOpacity>
              <TouchableOpacity testID="player-fullscreen-btn" style={styles.inlineBtn} onPress={() => setFullscreen(true)}>
                <Ionicons name="expand" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* FULLSCREEN CONTROLS */}
      {isFS && (
        <View style={StyleSheet.absoluteFill}>
          {/* Background tap detector - toggles controls visibility */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (showControls) { setShowControls(false); clearControlsTimer(); }
              else { resetControlsTimer(); }
            }}
          />

          {showControls && (
            <View style={styles.fsOverlay} pointerEvents="box-none">
              {/* Top bar - captures touches to prevent hiding */}
              <Pressable onPress={() => resetControlsTimer()}>
                <LinearGradient colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.3)', 'transparent']} style={styles.fsTopBar}>
                  <TouchableOpacity testID="fs-back-btn" style={styles.fsBackBtn} onPress={() => setFullscreen(false)}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity testID="fs-ratio-btn" style={styles.fsTopIconBtn} onPress={() => { cycleResizeMode(); resetControlsTimer(); }}>
                    <Ionicons name="resize-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity testID="fs-exit-btn" style={styles.fsTopIconBtn} onPress={() => setFullscreen(false)}>
                    <Ionicons name="scan-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                </LinearGradient>
              </Pressable>

              {/* Right side: channel arrows + logo */}
              <View style={styles.fsRightSide}>
                <Pressable testID="fs-ch-up-btn" style={styles.fsRightArrow} hitSlop={{ top: 20, bottom: 10, left: 20, right: 20 }} onPress={() => { handleChangeChannel('prev'); resetControlsTimer(); }}>
                  <Ionicons name="chevron-up" size={32} color="rgba(255,255,255,0.9)" />
                </Pressable>
                {state.channelIcon ? <Image source={{ uri: state.channelIcon }} style={styles.fsRightLogo} resizeMode="contain" /> : null}
                <Pressable testID="fs-ch-down-btn" style={styles.fsRightArrow} hitSlop={{ top: 10, bottom: 20, left: 20, right: 20 }} onPress={() => { handleChangeChannel('next'); resetControlsTimer(); }}>
                  <Ionicons name="chevron-down" size={32} color="rgba(255,255,255,0.9)" />
                </Pressable>
              </View>

              {/* Center play/pause */}
              <View style={styles.fsCenterRow} pointerEvents="box-none">
                <Pressable testID="fs-play-btn" style={styles.fsCenterBtn} onPress={() => { togglePlay(); resetControlsTimer(); }}>
                  <Ionicons name={state.isPlaying ? 'pause' : 'play'} size={44} color="#fff" />
                </Pressable>
              </View>

              {/* Bottom bar - captures touches to prevent hiding */}
              <Pressable onPress={() => resetControlsTimer()}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)']} style={styles.fsBottomBar}>
                  <View style={styles.fsBottomInfo}>
                    <View style={styles.fsNameRow}>
                      <View style={styles.fsLiveBadge}>
                        <Ionicons name="flash" size={10} color="#fff" />
                        <Text style={styles.fsLiveText}>LIVE</Text>
                      </View>
                      <Text style={styles.fsChannelName} numberOfLines={1}>{state.channelName}</Text>
                    </View>
                    {nowProgram && (
                      <View style={styles.fsGuideRow}>
                        <Text style={styles.fsGuideLabel}>Now</Text>
                        <Text style={styles.fsGuideTitle} numberOfLines={1}>{nowProgram.title}</Text>
                        <Text style={styles.fsGuideTime}>{formatTime(nowProgram.start)} - {formatTime(nowProgram.end)}</Text>
                      </View>
                    )}
                    {nextProgram && (
                      <View style={styles.fsGuideRow}>
                        <Text style={[styles.fsGuideLabel, { opacity: 0.6 }]}>Next</Text>
                        <Text style={[styles.fsGuideTitle, { opacity: 0.6 }]} numberOfLines={1}>{nextProgram.title}</Text>
                        <Text style={[styles.fsGuideTime, { opacity: 0.6 }]}>{formatTime(nextProgram.start)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.fsBottomIcons}>
                    <TouchableOpacity testID="fs-fav-btn" style={styles.fsBottomIconBtn} onPress={() => { handleFavToggle(); resetControlsTimer(); }}>
                      <Ionicons name={state.streamId && isFavorite(state.streamId) ? 'star' : 'star-outline'} size={22} color={state.streamId && isFavorite(state.streamId) ? '#FFD700' : '#fff'} />
                    </TouchableOpacity>
                    <TouchableOpacity testID="fs-ratio-label-btn" style={styles.fsBottomIconBtn} onPress={() => { cycleResizeMode(); resetControlsTimer(); }}>
                      <Text style={styles.fsRatioLabel}>{RESIZE_LABELS[state.resizeModeIdx]}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="fs-multiview-btn" style={styles.fsBottomIconBtn} onPress={handleMultiview}>
                      <Ionicons name="grid" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inlineContainer: { width: '100%', aspectRatio: 16 / 9, maxHeight: 240, backgroundColor: '#000', position: 'relative', marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0 },
  fullscreenContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 99999, elevation: 99999 },
  hiddenContainer: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  transitionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  transitionContent: { alignItems: 'center', gap: 10 },
  transitionIcon: { width: 72, height: 72, borderRadius: 14 },
  transitionIconPlaceholder: { width: 72, height: 72, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  transitionName: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  transitionProgram: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  inlineOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  inlineTopGrad: { paddingTop: 8, paddingHorizontal: 12, paddingBottom: 16 },
  inlineInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineIcon: { width: 32, height: 32, borderRadius: 6 },
  inlineInfoText: { flex: 1 },
  inlineChannelName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  inlineProgramName: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  inlineLiveBadge: { backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 },
  inlineLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  inlineBottomGrad: { paddingBottom: 8, paddingHorizontal: 8, paddingTop: 16 },
  inlineControls: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  inlineBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  fsOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  fsTopBar: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 8, paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  fsBackBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  fsTopIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  fsRightSide: { position: 'absolute', right: 16, top: '30%', alignItems: 'center', gap: 12, zIndex: 10 },
  fsRightArrow: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  fsRightLogo: { width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)' },
  fsCenterRow: { alignItems: 'center', justifyContent: 'center' },
  fsCenterBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  fsBottomBar: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 12, paddingTop: 40 },
  fsBottomInfo: { marginBottom: 12 },
  fsChannelName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fsProgramTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500', marginTop: 3 },
  fsLiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E50914', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 3, marginRight: 8 },
  fsLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  fsNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  fsGuideRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  fsGuideLabel: { color: '#00BFFF', fontSize: 11, fontWeight: '700', width: 32 },
  fsGuideTitle: { color: '#fff', fontSize: 12, flex: 1 },
  fsGuideTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  fsBottomIcons: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  fsBottomIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  fsRatioLabel: { color: '#fff', fontSize: 12, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
});
