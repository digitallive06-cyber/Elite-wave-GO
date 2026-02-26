import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions, BackHandler } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useGlobalVideo } from '../contexts/GlobalVideoContext';
import { useFavorites } from '../contexts/FavoritesContext';

const RESIZE_MODES = [ResizeMode.CONTAIN, ResizeMode.COVER, ResizeMode.STRETCH];
const RESIZE_LABELS = ['FIT', 'FILL', 'STRETCH'];

export const GlobalVideoPlayer: React.FC = () => {
  const { videoRef, state, stopStream, setFullscreen, togglePlay, cycleResizeMode, setIsPlaying } = useGlobalVideo();
  const { width: screenW, height: screenH } = Dimensions.get('window');
  
  // Handle fullscreen orientation
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    if (state.isFullscreen) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    }
  }, [state.isFullscreen]);

  // Handle back button in fullscreen
  useEffect(() => {
    if (!state.isFullscreen) return;
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false);
      return true;
    });
    
    return () => backHandler.remove();
  }, [state.isFullscreen, setFullscreen]);

  // Orientation change listener
  useEffect(() => {
    if (Platform.OS === 'web' || !state.streamUrl) return;
    
    ScreenOrientation.unlockAsync().catch(() => {});
    
    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const o = event.orientationInfo.orientation;
      if (
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      ) {
        setFullscreen(true);
      } else if (
        o === ScreenOrientation.Orientation.PORTRAIT_UP ||
        o === ScreenOrientation.Orientation.PORTRAIT_DOWN
      ) {
        setFullscreen(false);
      }
    });
    
    return () => ScreenOrientation.removeOrientationChangeListener(subscription);
  }, [state.streamUrl, setFullscreen]);

  // Don't render if no stream
  if (!state.streamUrl) return null;

  // Only render fullscreen overlay when in fullscreen mode
  if (!state.isFullscreen) return null;

  return (
    <View style={[styles.fullscreenContainer, { width: screenW, height: screenH }]}>
      <Video
        ref={videoRef}
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
      
      {/* Fullscreen Controls Overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBtn} onPress={() => setFullscreen(false)}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.channelName} numberOfLines={1}>{state.channelName}</Text>
          <TouchableOpacity style={styles.ratioBtn} onPress={cycleResizeMode}>
            <Text style={styles.ratioBtnText}>{RESIZE_LABELS[state.resizeModeIdx]}</Text>
          </TouchableOpacity>
        </View>
        
        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          {state.programTitle ? (
            <Text style={styles.programTitle} numberOfLines={1}>{state.programTitle}</Text>
          ) : null}
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={togglePlay}>
              <Ionicons name={state.isPlaying ? 'pause' : 'play'} size={36} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => setFullscreen(false)}>
              <Ionicons name="contract" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelName: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 16,
  },
  ratioBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  ratioBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  programTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  ctrlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
