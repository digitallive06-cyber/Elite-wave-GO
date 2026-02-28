import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal, Alert,
  FlatList, ActivityIndicator, Platform, useWindowDimensions, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { api } from '../src/utils/api';

interface SlotData {
  streamId: number;
  streamName: string;
  streamIcon: string;
  streamUrl: string;
  fallbackUrl: string;
  categoryId: string;
}

export default function MultiviewScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const router = useRouter();
  const { width: ww, height: wh } = useWindowDimensions();
  const isLandscape = ww > wh;

  const params = useLocalSearchParams<{
    streamId: string; streamName: string; streamIcon: string;
    categoryId: string; directUrl: string;
  }>();

  // 4 slots - slot 0 is pre-filled with current channel
  const [slots, setSlots] = useState<(SlotData | null)[]>([
    {
      streamId: parseInt(params.streamId || '0'),
      streamName: params.streamName || '',
      streamIcon: params.streamIcon || '',
      streamUrl: params.directUrl || '',
      fallbackUrl: '',
      categoryId: params.categoryId || '',
    },
    null, null, null,
  ]);
  const [activeSlot, setActiveSlot] = useState(0);

  // Channel picker modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(0);
  const [pickerStep, setPickerStep] = useState<'category' | 'channel'>('category');
  const [categories, setCategories] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Orientation: lock landscape
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

  // Show tutorial popup on first entry
  const tutorialShown = useRef(false);
  useEffect(() => {
    if (!tutorialShown.current) {
      tutorialShown.current = true;
      setTimeout(() => {
        Alert.alert(
          'Multiview Controls',
          'Tap a channel to listen to its audio.\n\nLong press a channel (or the + button) to change the channel in that slot.',
          [{ text: 'OK', style: 'default' }]
        );
      }, 600);
    }
  }, []);

  // Resolve stream URL for a slot - returns both primary and fallback URLs
  const resolveSlotUrl = useCallback(async (streamId: number): Promise<{ url: string; fallbackUrl: string }> => {
    try {
      const data = await api.getStreamUrl(username, password, streamId, 'live', 'ts');
      return {
        url: data.url || data.ts_url || '',
        fallbackUrl: data.ts_url || data.fallback_url || '',
      };
    } catch { return { url: '', fallbackUrl: '' }; }
  }, [username, password]);

  // Open category picker for a slot
  const openPicker = async (slotIndex: number) => {
    setPickerSlot(slotIndex);
    setPickerStep('category');
    setPickerVisible(true);
    setPickerLoading(true);
    try {
      const data = await api.getLiveCategories(username, password);
      setCategories(Array.isArray(data) ? data : []);
    } catch { setCategories([]); }
    finally { setPickerLoading(false); }
  };

  // Select a category -> load channels
  const selectCategory = async (catId: string) => {
    setPickerStep('channel');
    setPickerLoading(true);
    try {
      const data = await api.getLiveStreams(username, password, catId);
      setChannels(Array.isArray(data) ? data : []);
    } catch { setChannels([]); }
    finally { setPickerLoading(false); }
  };

  // Select a channel -> fill the slot
  const selectChannel = async (channel: any) => {
    setPickerVisible(false);
    const urls = await resolveSlotUrl(channel.stream_id);
    setSlots(prev => {
      const next = [...prev];
      next[pickerSlot] = {
        streamId: channel.stream_id,
        streamName: channel.name || '',
        streamIcon: channel.stream_icon || '',
        streamUrl: urls.url,
        fallbackUrl: urls.fallbackUrl,
        categoryId: channel.category_id || '',
      };
      return next;
    });
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.unlockAsync().catch(() => {});
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    }
    router.back();
  };

  // Calculate grid dimensions
  const cellW = (isLandscape ? ww : ww) / 2;
  const cellH = (isLandscape ? wh : wh) / 2;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Back button */}
      <TouchableOpacity testID="multiview-back-btn" style={styles.backBtn} onPress={handleBack}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* 2x2 Grid */}
      <View style={styles.grid}>
        {[0, 1, 2, 3].map(i => (
          <MultiviewCell
            key={i}
            index={i}
            slot={slots[i]}
            isActive={activeSlot === i}
            width={cellW}
            height={cellH}
            onTap={() => setActiveSlot(i)}
            onLongPress={() => openPicker(i)}
            onAddPress={() => openPicker(i)}
          />
        ))}
      </View>

      {/* Channel Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                if (pickerStep === 'channel') { setPickerStep('category'); return; }
                setPickerVisible(false);
              }}>
                <Ionicons name={pickerStep === 'channel' ? 'chevron-back' : 'close'} size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {pickerStep === 'category' ? 'Select Category' : 'Select Channel'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {pickerLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : pickerStep === 'category' ? (
              <FlatList
                data={categories}
                keyExtractor={(item, idx) => `cat-${item.category_id || idx}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                    onPress={() => selectCategory(item.category_id)}
                  >
                    <Text style={[styles.pickerRowText, { color: colors.textPrimary }]}>{item.category_name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No categories</Text>
                }
              />
            ) : (
              <FlatList
                data={channels}
                keyExtractor={(item, idx) => `ch-${item.stream_id || idx}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                    onPress={() => selectChannel(item)}
                  >
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.pickerIcon} resizeMode="contain" />
                    ) : (
                      <View style={[styles.pickerIconPlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
                        <Ionicons name="tv-outline" size={16} color={colors.textSecondary} />
                      </View>
                    )}
                    <Text style={[styles.pickerRowText, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No channels</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Individual cell component - each has its own video player using expo-av
function MultiviewCell({
  index, slot, isActive, width, height, onTap, onLongPress, onAddPress,
}: {
  index: number; slot: SlotData | null; isActive: boolean;
  width: number; height: number;
  onTap: () => void; onLongPress: () => void; onAddPress: () => void;
}) {
  const videoRef = useRef<Video>(null);
  const loadedUrlRef = useRef<string>('');

  // Load video imperatively when slot URL changes (mirrors GlobalVideoPlayer pattern)
  useEffect(() => {
    if (!slot?.streamUrl) {
      loadedUrlRef.current = '';
      return;
    }
    if (loadedUrlRef.current === slot.streamUrl) return; // Already loaded this URL

    const loadVideo = async () => {
      const ref = videoRef.current;
      if (!ref) return;
      try {
        await ref.unloadAsync().catch(() => {});
      } catch {}
      // Try primary URL first
      try {
        await ref.loadAsync(
          { uri: slot.streamUrl, overrideFileExtensionAndroid: 'ts' },
          { shouldPlay: true, volume: isActive ? 1 : 0, isMuted: !isActive }
        );
        loadedUrlRef.current = slot.streamUrl;
        return;
      } catch {}
      // Try fallback URL
      if (slot.fallbackUrl && slot.fallbackUrl !== slot.streamUrl) {
        try {
          await ref.loadAsync(
            { uri: slot.fallbackUrl, overrideFileExtensionAndroid: 'ts' },
            { shouldPlay: true, volume: isActive ? 1 : 0, isMuted: !isActive }
          );
          loadedUrlRef.current = slot.streamUrl;
        } catch {}
      }
    };
    loadVideo();

    return () => {
      videoRef.current?.unloadAsync().catch(() => {});
      loadedUrlRef.current = '';
    };
  }, [slot?.streamUrl]);

  // Update volume when active state changes
  useEffect(() => {
    if (videoRef.current && slot?.streamUrl) {
      videoRef.current.setVolumeAsync(isActive ? 1 : 0).catch(() => {});
      videoRef.current.setIsMutedAsync(!isActive).catch(() => {});
    }
  }, [isActive, slot?.streamUrl]);

  if (!slot) {
    // Empty slot - show "+" button
    return (
      <TouchableOpacity
        testID={`multiview-add-${index}`}
        style={[styles.cell, { width, height }, styles.emptyCell]}
        onPress={onAddPress}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={48} color="rgba(255,255,255,0.3)" />
        <Text style={styles.addText}>Add Channel</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.cell, { width, height }]}>
      <Video
        ref={videoRef}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
      />
      {/* Full-area touch target on top of video */}
      <Pressable
        testID={`multiview-cell-${index}`}
        style={StyleSheet.absoluteFill}
        onPress={onTap}
        onLongPress={onLongPress}
        delayLongPress={500}
      />
      {/* Channel name overlay - pointer events none so touches pass to Pressable */}
      <View style={styles.cellOverlay} pointerEvents="none">
        {slot.streamIcon ? (
          <Image source={{ uri: slot.streamIcon }} style={styles.cellIcon} resizeMode="contain" />
        ) : null}
        <Text style={styles.cellName} numberOfLines={1}>{slot.streamName}</Text>
      </View>
      {/* Active indicator */}
      {isActive && (
        <View style={styles.activeBorder} pointerEvents="none">
          <View style={styles.audioIcon}>
            <Ionicons name="volume-high" size={14} color="#fff" />
          </View>
        </View>
      )}
      {!isActive && (
        <View style={styles.mutedIcon} pointerEvents="none">
          <Ionicons name="volume-mute" size={12} color="rgba(255,255,255,0.5)" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backBtn: {
    position: 'absolute', top: 8, left: 8, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },

  cell: { overflow: 'hidden', position: 'relative' },
  emptyCell: {
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#111', borderWidth: 1, borderColor: '#222',
  },
  addText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 },
  activeCell: {},

  cellOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cellIcon: { width: 20, height: 20, borderRadius: 3 },
  cellName: { color: '#fff', fontSize: 11, fontWeight: '600', flex: 1 },

  activeBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 2, borderColor: '#00BFFF',
  },
  audioIcon: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,191,255,0.8)', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  mutedIcon: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
    paddingHorizontal: 4, paddingVertical: 2,
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalContent: {
    width: '90%', maxWidth: 500, maxHeight: '80%',
    borderRadius: 16, overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowText: { fontSize: 15 },
  pickerIcon: { width: 32, height: 24, borderRadius: 4 },
  pickerIconPlaceholder: {
    width: 32, height: 24, borderRadius: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
