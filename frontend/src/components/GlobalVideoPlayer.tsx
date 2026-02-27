import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Platform, BackHandler, useWindowDimensions, Image, Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useRouter, usePathname } from 'expo-router';
import { useGlobalVideo } from '../contexts/GlobalVideoContext';
import { useFavorites } from '../contexts/FavoritesContext';

const RESIZE_MODES = [ResizeMode.CONTAIN, ResizeMode.COVER, ResizeMode.STRETCH];
const RESIZE_LABELS = ['FIT', 'FILL', 'STRETCH'];

export const GlobalVideoPlayer: React.FC = () => {
  const {
    videoRef, state, stopStream, setFullscreen,
    togglePlay, cycleResizeMode, setIsPlaying, setTransitioning, tryFallbackUrl,
  } = useGlobalVideo();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();
  const pathname = usePathname();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [showControls, setShowControls] = useState(true);
  const isFullscreenRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionOpacity = useRef(new Animated.Value(1)).current;

  // Keep refs in sync with state
  useEffect(() => { isFullscreenRef.current = state.isFullscreen; }, [state.isFullscreen]);
  useEffect(() => { isTransitioningRef.current = state.isTransitioning; }, [state.isTransitioning]);

  // Determine visibility: only show inline on Live tab
  const isOnLiveTab = pathname?.includes('live') || false;
  const hasStream = !!state.streamUrl;
  const isFS = state.isFullscreen;
  const showInline = hasStream && !isFS && isOnLiveTab;
  const showHidden = hasStream && !isFS && !isOnLiveTab;

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
    if (isFS) { resetControlsTimer(); } else { setShowControls(true); clearControlsTimer(); }
    return clearControlsTimer;
  }, [isFS, resetControlsTimer, clearControlsTimer]);

  // --- Channel transition overlay ---
  useEffect(() => {
    if (state.isTransitioning) {
      transitionOpacity.setValue(1);
      // Safety timeout: force-dismiss after 3s even if playback status hasn't fired
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => {
        if (isTransitioningRef.current) {
          setTransitioning(false);
        }
      }, 3000);
    }
    return () => { if (transitionTimer.current) clearTimeout(transitionTimer.current); };
  }, [state.isTransitioning, state.streamId, setTransitioning]);

  // Fade out transition overlay
  useEffect(() => {
    if (!state.isTransitioning) {
      Animated.timing(transitionOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }
  }, [state.isTransitioning, transitionOpacity]);

  // --- Orientation lock ---
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!hasStream) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      return;
    }
    if (isFS) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
        .then(() => { setTimeout(() => { if (isFullscreenRef.current) ScreenOrientation.unlockAsync().catch(() => {}); }, 500); })
        .catch(() => {});
      if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .then(() => { setTimeout(() => { if (!isFullscreenRef.current && state.streamUrl) ScreenOrientation.unlockAsync().catch(() => {}); }, 300); })
        .catch(() => {});
      if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('visible').catch(() => {});
    }
  }, [hasStream, isFS]);

  // --- Back button ---
  useEffect(() => {
    if (!isFS) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => { setFullscreen(false); return true; });
    return () => handler.remove();
  }, [isFS, setFullscreen]);

  // --- Orientation listener ---
  useEffect(() => {
    if (Platform.OS === 'web' || !hasStream) return;
    const sub = ScreenOrientation.addOrientationChangeListener((e) => {
      const o = e.orientationInfo.orientation;
      const landscape = o === ScreenOrientation.Orientation.LANDSCAPE_LEFT || o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      const portrait = o === ScreenOrientation.Orientation.PORTRAIT_UP || o === ScreenOrientation.Orientation.PORTRAIT_DOWN;
      if (landscape && !isFullscreenRef.current) setFullscreen(true);
      else if (portrait && isFullscreenRef.current) setFullscreen(false);
    });
    return () => ScreenOrientation.removeOrientationChangeListener(sub);
  }, [hasStream, setFullscreen]);

  // --- Playback status handler (uses refs to avoid stale closures) ---
  const handlePlaybackStatus = useCallback((status: any) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      if (status.isPlaying && isTransitioningRef.current) {
        setTransitioning(false);
      }
    }
    if (status.error) {
      console.warn('Video error, trying fallback:', status.error);
      tryFallbackUrl();
    }
  }, [setIsPlaying, setTransitioning, tryFallbackUrl]);

  const handleFavToggle = useCallback(() => {
    if (!state.streamId) return;
    toggleFavorite({ stream_id: state.streamId, name: state.channelName, stream_icon: state.channelIcon, category_id: state.categoryId });
  }, [state.streamId, state.channelName, state.channelIcon, state.categoryId, toggleFavorite]);

  const handleMultiview = useCallback(() => {
    setFullscreen(false);
    setTimeout(() => {
      router.push({ pathname: '/multiview', params: { streamId: String(state.streamId || ''), streamName: state.channelName, streamIcon: state.channelIcon, categoryId: state.categoryId, directUrl: state.streamUrl || '' } });
    }, 100);
  }, [setFullscreen, router, state]);

  // Don't render anything if no stream
  if (!hasStream) return null;

  // Container style: fullscreen, inline, or hidden (keeps Video mounted)
  const containerStyle = isFS
    ? [styles.fullscreenContainer, { width: screenW, height: screenH }]
    : showInline
      ? styles.inlineContainer
      : styles.hiddenContainer;

  return (
    <View style={containerStyle}>
      {/* Single persistent Video component - always in same tree position */}
      <Video
        ref={videoRef}
        testID="global-video-player"
        source={{ uri: state.streamUrl }}
        style={styles.video}
        resizeMode={RESIZE_MODES[state.resizeModeIdx]}
        shouldPlay
        useNativeControls={false}
        onPlaybackStatusUpdate={handlePlaybackStatus}
      />

      {/* ====== CHANNEL TRANSITION OVERLAY ====== */}
      {state.isTransitioning && (showInline || isFS) && (
        <Animated.View style={[styles.transitionOverlay, { opacity: transitionOpacity }]}>
          <View style={styles.transitionContent}>
            {state.channelIcon ? (
              <Image source={{ uri: state.channelIcon }} style={styles.transitionIcon} resizeMode="contain" />
            ) : (
              <View style={styles.transitionIconPlaceholder}>
                <Ionicons name="tv" size={40} color="#fff" />
              </View>
            )}
            <Text style={styles.transitionName}>{state.channelName}</Text>
            {state.programTitle ? <Text style={styles.transitionProgram}>{state.programTitle}</Text> : null}
          </View>
        </Animated.View>
      )}

      {/* ====== INLINE CONTROLS ====== */}
      {showInline && !state.isTransitioning && (
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

      {/* ====== FULLSCREEN TUBI-STYLE CONTROLS ====== */}
      {isFS && (
        <TouchableWithoutFeedback onPress={() => { showControls ? (setShowControls(false), clearControlsTimer()) : resetControlsTimer(); }}>
          <View style={StyleSheet.absoluteFill}>
            {showControls && (
              <View style={styles.fsOverlay}>
                {/* TOP BAR */}
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

                {/* RIGHT SIDE: Channel logo + up/down arrows */}
                <View style={styles.fsRightSide} pointerEvents="box-none">
                  <TouchableOpacity style={styles.fsRightArrow}><Ionicons name="chevron-up" size={28} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
                  {state.channelIcon ? (
                    <Image source={{ uri: state.channelIcon }} style={styles.fsRightLogo} resizeMode="contain" />
                  ) : null}
                  <TouchableOpacity style={styles.fsRightArrow}><Ionicons name="chevron-down" size={28} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
                </View>

                {/* BOTTOM BAR: Tubi-style */}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']} style={styles.fsBottomBar}>
                  {/* Channel name + program + LIVE badge */}
                  <View style={styles.fsBottomInfo}>
                    <Text style={styles.fsChannelName} numberOfLines={1}>{state.channelName}</Text>
                    {state.programTitle ? <Text style={styles.fsProgramTitle} numberOfLines={1}>{state.programTitle}</Text> : null}
                    <View style={styles.fsLiveBadge}>
                      <Ionicons name="flash" size={10} color="#fff" />
                      <Text style={styles.fsLiveText}>LIVE</Text>
                    </View>
                  </View>
                  {/* Bottom icons row */}
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
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inlineContainer: { width: '100%', aspectRatio: 16 / 9, maxHeight: 240, backgroundColor: '#000', position: 'relative' },
  fullscreenContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 99999, elevation: 99999 },
  hiddenContainer: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  video: { width: '100%', height: '100%' },

  /* Transition overlay */
  transitionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  transitionContent: { alignItems: 'center', gap: 10 },
  transitionIcon: { width: 72, height: 72, borderRadius: 14 },
  transitionIconPlaceholder: { width: 72, height: 72, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  transitionName: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  transitionProgram: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },

  /* Inline overlay */
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

  /* Fullscreen overlay container */
  fsOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },

  /* FS Top bar */
  fsTopBar: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 8, paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  fsBackBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  fsTopIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },

  /* FS Right side channel navigation */
  fsRightSide: { position: 'absolute', right: 16, top: '30%', alignItems: 'center', gap: 12 },
  fsRightArrow: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  fsRightLogo: { width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)' },

  /* FS Bottom bar - Tubi style */
  fsBottomBar: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 12, paddingTop: 40 },
  fsBottomInfo: { marginBottom: 12 },
  fsChannelName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  fsProgramTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500', marginTop: 3 },
  fsLiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E50914', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, gap: 4, alignSelf: 'flex-start', marginTop: 8 },
  fsLiveText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  /* FS Bottom icons row */
  fsBottomIcons: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  fsBottomIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  fsRatioLabel: { color: '#fff', fontSize: 12, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
});
