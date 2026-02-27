import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  BackHandler, useWindowDimensions, Image, Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useRouter } from 'expo-router';
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
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [showControls, setShowControls] = useState(true);
  const isFullscreenRef = useRef(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const prevStreamIdRef = useRef<number | null>(null);

  // Keep ref in sync
  useEffect(() => {
    isFullscreenRef.current = state.isFullscreen;
  }, [state.isFullscreen]);

  // Auto-hide controls in fullscreen
  const resetControlsTimer = () => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
  };

  useEffect(() => {
    if (state.isFullscreen) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    }
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, [state.isFullscreen]);

  // Channel transition animation
  useEffect(() => {
    if (state.isTransitioning && state.streamId !== prevStreamIdRef.current) {
      transitionOpacity.setValue(1);
      prevStreamIdRef.current = state.streamId;
    }
  }, [state.streamId, state.isTransitioning]);

  // Fade out transition overlay when stream starts playing
  useEffect(() => {
    if (!state.isTransitioning) {
      Animated.timing(transitionOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [state.isTransitioning]);

  // Orientation lock: fullscreen → landscape then unlock for portrait-to-exit
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (!state.streamUrl) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      return;
    }

    if (state.isFullscreen) {
      // Force landscape, then unlock so user can rotate back to portrait to exit
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
        .then(() => {
          setTimeout(() => {
            if (isFullscreenRef.current) {
              ScreenOrientation.unlockAsync().catch(() => {});
            }
          }, 500);
        })
        .catch(() => {});
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      }
    } else {
      // Exit fullscreen: go portrait then allow free rotation
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .then(() => {
          setTimeout(() => {
            if (!isFullscreenRef.current && state.streamUrl) {
              ScreenOrientation.unlockAsync().catch(() => {});
            }
          }, 300);
        })
        .catch(() => {});
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
    }
  }, [state.streamUrl, state.isFullscreen]);

  // Back button: exit fullscreen
  useEffect(() => {
    if (!state.isFullscreen) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false);
      return true;
    });
    return () => handler.remove();
  }, [state.isFullscreen, setFullscreen]);

  // Orientation listener: auto fullscreen on rotation
  useEffect(() => {
    if (Platform.OS === 'web' || !state.streamUrl) return;

    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const o = event.orientationInfo.orientation;
      const isLandscape =
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      const isPortrait =
        o === ScreenOrientation.Orientation.PORTRAIT_UP ||
        o === ScreenOrientation.Orientation.PORTRAIT_DOWN;

      if (isLandscape && !isFullscreenRef.current) {
        setFullscreen(true);
      } else if (isPortrait && isFullscreenRef.current) {
        setFullscreen(false);
      }
    });

    return () => ScreenOrientation.removeOrientationChangeListener(subscription);
  }, [state.streamUrl, setFullscreen]);

  if (!state.streamUrl) return null;

  const isFS = state.isFullscreen;

  const containerStyle = isFS
    ? [styles.fullscreenContainer, { width: screenW, height: screenH }]
    : styles.inlineContainer;

  const handleFavToggle = () => {
    if (!state.streamId) return;
    toggleFavorite({
      stream_id: state.streamId,
      name: state.channelName,
      stream_icon: state.channelIcon,
      category_id: state.categoryId,
    });
  };

  const handleMultiview = () => {
    setFullscreen(false);
    setTimeout(() => {
      router.push({
        pathname: '/multiview',
        params: {
          streamId: String(state.streamId || ''),
          streamName: state.channelName,
          streamIcon: state.channelIcon,
          categoryId: state.categoryId,
          directUrl: state.streamUrl || '',
        },
      });
    }, 100);
  };

  const handleControlsTap = () => {
    if (isFS) {
      if (showControls) {
        setShowControls(false);
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
      } else {
        resetControlsTimer();
      }
    }
  };

  const handlePlaybackStatus = (status: any) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      // End channel transition when video starts playing
      if (status.isPlaying && state.isTransitioning) {
        setTransitioning(false);
      }
    }
    // If there's an error and we have a fallback, try it
    if (status.error) {
      tryFallbackUrl();
    }
  };

  return (
    <View style={containerStyle}>
      {/* Single persistent Video component */}
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
      {state.isTransitioning && (
        <Animated.View style={[styles.transitionOverlay, { opacity: transitionOpacity }]}>
          <View style={styles.transitionContent}>
            {state.channelIcon ? (
              <Image source={{ uri: state.channelIcon }} style={styles.transitionIcon} resizeMode="contain" />
            ) : (
              <View style={styles.transitionIconPlaceholder}>
                <Ionicons name="tv" size={48} color="#fff" />
              </View>
            )}
            <Text style={styles.transitionName}>{state.channelName}</Text>
            {state.programTitle ? (
              <Text style={styles.transitionProgram}>{state.programTitle}</Text>
            ) : null}
          </View>
        </Animated.View>
      )}

      {/* ====== INLINE CONTROLS (Compact bar) ====== */}
      {!isFS && (
        <View style={styles.inlineOverlay} pointerEvents="box-none">
          <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={styles.inlineTopGrad}>
            <View style={styles.inlineInfoRow}>
              {state.channelIcon ? (
                <Image source={{ uri: state.channelIcon }} style={styles.inlineIcon} resizeMode="contain" />
              ) : null}
              <View style={styles.inlineInfoText}>
                <Text style={styles.inlineChannelName} numberOfLines={1}>{state.channelName}</Text>
                {state.programTitle ? (
                  <Text style={styles.inlineProgramName} numberOfLines={1}>{state.programTitle}</Text>
                ) : null}
              </View>
              <View style={styles.inlineLiveBadge}>
                <Text style={styles.inlineLiveText}>LIVE</Text>
              </View>
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
                <Ionicons
                  name={state.streamId && isFavorite(state.streamId) ? 'star' : 'star-outline'}
                  size={18}
                  color="#FFD700"
                />
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
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleControlsTap}
        >
          {showControls && (
            <View style={styles.fsOverlay} pointerEvents="box-none">
              {/* Top gradient bar */}
              <LinearGradient colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)', 'transparent']} style={styles.fsTopBar}>
                <TouchableOpacity testID="fs-back-btn" style={styles.fsBackBtn} onPress={() => setFullscreen(false)}>
                  <Ionicons name="chevron-back" size={26} color="#fff" />
                </TouchableOpacity>
                <View style={styles.fsTopInfo}>
                  {state.channelIcon ? (
                    <Image source={{ uri: state.channelIcon }} style={styles.fsTopIcon} resizeMode="contain" />
                  ) : null}
                  <View style={styles.fsTopTextWrap}>
                    <Text style={styles.fsChannelName} numberOfLines={1}>{state.channelName}</Text>
                    {state.programTitle ? (
                      <Text style={styles.fsProgramName} numberOfLines={1}>{state.programTitle}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.fsLiveBadge}>
                  <View style={styles.fsLiveDot} />
                  <Text style={styles.fsLiveText}>LIVE</Text>
                </View>
              </LinearGradient>

              {/* Center: Large play/pause */}
              <View style={styles.fsCenterRow} pointerEvents="box-none">
                <TouchableOpacity testID="fs-play-btn" style={styles.fsCenterBtn} onPress={() => { togglePlay(); resetControlsTimer(); }}>
                  <Ionicons name={state.isPlaying ? 'pause' : 'play'} size={44} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Bottom gradient bar */}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']} style={styles.fsBottomBar}>
                <View style={styles.fsBottomControls}>
                  <TouchableOpacity testID="fs-multiview-btn" style={styles.fsBottomBtn} onPress={() => { handleMultiview(); }}>
                    <Ionicons name="grid-outline" size={22} color="#fff" />
                    <Text style={styles.fsBottomLabel}>Multiview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="fs-ratio-btn" style={styles.fsBottomBtn} onPress={() => { cycleResizeMode(); resetControlsTimer(); }}>
                    <Ionicons name="resize-outline" size={22} color="#fff" />
                    <Text style={styles.fsBottomLabel}>{RESIZE_LABELS[state.resizeModeIdx]}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="fs-fav-btn" style={styles.fsBottomBtn} onPress={() => { handleFavToggle(); resetControlsTimer(); }}>
                    <Ionicons
                      name={state.streamId && isFavorite(state.streamId) ? 'star' : 'star-outline'}
                      size={22}
                      color="#FFD700"
                    />
                    <Text style={styles.fsBottomLabel}>Favorite</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="fs-exit-btn" style={styles.fsBottomBtn} onPress={() => setFullscreen(false)}>
                    <Ionicons name="contract-outline" size={22} color="#fff" />
                    <Text style={styles.fsBottomLabel}>Exit</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  /* Inline container */
  inlineContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 240,
    backgroundColor: '#000',
    position: 'relative',
  },
  /* Fullscreen container */
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 99999,
    elevation: 99999,
  },
  video: {
    width: '100%',
    height: '100%',
  },

  /* ===== Channel transition overlay ===== */
  transitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  transitionContent: {
    alignItems: 'center',
    gap: 12,
  },
  transitionIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  transitionIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transitionName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  transitionProgram: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
  },

  /* ===== Inline overlay (compact bar) ===== */
  inlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  inlineTopGrad: {
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  inlineInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineIcon: { width: 32, height: 32, borderRadius: 6 },
  inlineInfoText: { flex: 1 },
  inlineChannelName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  inlineProgramName: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  inlineLiveBadge: { backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 },
  inlineLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  inlineBottomGrad: {
    paddingBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 16,
  },
  inlineControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  inlineBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ===== Fullscreen Tubi-style overlay ===== */
  fsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  /* Top bar */
  fsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  fsBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fsTopInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    gap: 10,
  },
  fsTopIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  fsTopTextWrap: {
    flex: 1,
  },
  fsChannelName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  fsProgramName: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 2,
  },
  fsLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229,9,20,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    gap: 5,
  },
  fsLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  fsLiveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* Center play/pause */
  fsCenterRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsCenterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  /* Bottom bar */
  fsBottomBar: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    paddingTop: 24,
  },
  fsBottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  fsBottomBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 60,
  },
  fsBottomLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
});
