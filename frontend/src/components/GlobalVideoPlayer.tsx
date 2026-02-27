import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  BackHandler, useWindowDimensions, Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useGlobalVideo } from '../contexts/GlobalVideoContext';
import { useFavorites } from '../contexts/FavoritesContext';

const RESIZE_MODES = [ResizeMode.CONTAIN, ResizeMode.COVER, ResizeMode.STRETCH];
const RESIZE_LABELS = ['FIT', 'FILL', 'STRETCH'];

export const GlobalVideoPlayer: React.FC = () => {
  const {
    videoRef, state, stopStream, setFullscreen,
    togglePlay, cycleResizeMode, setIsPlaying,
  } = useGlobalVideo();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [showControls, setShowControls] = useState(true);
  const isFullscreenRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    isFullscreenRef.current = state.isFullscreen;
  }, [state.isFullscreen]);

  // Auto-hide fullscreen controls after 5s
  useEffect(() => {
    if (!state.isFullscreen || !showControls) return;
    const timer = setTimeout(() => setShowControls(false), 5000);
    return () => clearTimeout(timer);
  }, [state.isFullscreen, showControls]);

  // Show controls when entering fullscreen
  useEffect(() => {
    if (state.isFullscreen) setShowControls(true);
  }, [state.isFullscreen]);

  // Orientation lock + navigation bar visibility
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (!state.streamUrl) {
      // No stream: lock portrait
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      return;
    }

    if (state.isFullscreen) {
      // Fullscreen: lock landscape, hide nav bar
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      }
    } else {
      // Inline: go portrait then unlock for free rotation
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .then(() => {
          setTimeout(() => {
            if (!isFullscreenRef.current) {
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

  // Orientation change listener: auto-enter/exit fullscreen on rotation
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

  // Nothing to render when no stream
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
        onPlaybackStatusUpdate={(status: any) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
          }
        }}
      />

      {/* ====== INLINE OVERLAY ====== */}
      {!isFS && (
        <View style={styles.inlineOverlay} pointerEvents="box-none">
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
        </View>
      )}

      {/* ====== FULLSCREEN OVERLAY ====== */}
      {isFS && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowControls(prev => !prev)}
        >
          {showControls && (
            <View style={styles.fsOverlay} pointerEvents="box-none">
              {/* Top bar */}
              <View style={styles.fsTopBar}>
                <TouchableOpacity testID="fs-back-btn" style={styles.fsTopBtn} onPress={() => setFullscreen(false)}>
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.fsChannelName} numberOfLines={1}>{state.channelName}</Text>
                <TouchableOpacity testID="fs-ratio-btn" style={styles.fsRatioBtn} onPress={cycleResizeMode}>
                  <Text style={styles.fsRatioBtnText}>{RESIZE_LABELS[state.resizeModeIdx]}</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="fs-fav-btn" style={[styles.fsTopBtn, { marginLeft: 8 }]} onPress={handleFavToggle}>
                  <Ionicons
                    name={state.streamId && isFavorite(state.streamId) ? 'star' : 'star-outline'}
                    size={22}
                    color="#FFD700"
                  />
                </TouchableOpacity>
              </View>
              {/* Bottom bar */}
              <View style={styles.fsBottomBar}>
                {state.programTitle ? (
                  <Text style={styles.fsProgramName} numberOfLines={1}>{state.programTitle}</Text>
                ) : null}
                <View style={styles.fsControlsRow}>
                  <TouchableOpacity testID="fs-play-btn" style={styles.fsCtrlBtn} onPress={togglePlay}>
                    <Ionicons name={state.isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity testID="fs-exit-btn" style={styles.fsCtrlBtn} onPress={() => setFullscreen(false)}>
                    <Ionicons name="contract" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  /* Inline (not fullscreen) container */
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

  /* ===== Inline overlay ===== */
  inlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  inlineInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  inlineIcon: { width: 32, height: 32, borderRadius: 6 },
  inlineInfoText: { flex: 1 },
  inlineChannelName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  inlineProgramName: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  inlineLiveBadge: { backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 },
  inlineLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  inlineControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    paddingRight: 8,
    gap: 6,
  },
  inlineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ===== Fullscreen overlay ===== */
  fsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  fsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  fsTopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fsChannelName: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  fsRatioBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  fsRatioBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  fsBottomBar: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  fsProgramName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 12,
  },
  fsControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  fsCtrlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
