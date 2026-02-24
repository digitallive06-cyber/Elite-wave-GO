import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, RefreshControl, Platform, Animated, BackHandler,
  useWindowDimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useFavorites } from '../../src/contexts/FavoritesContext';
import { api } from '../../src/utils/api';

const ASPECT_MODES = ['contain', 'cover', 'fill'] as const;
type ContentFit = typeof ASPECT_MODES[number];

const getDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function LiveScreen() {
  const { colors } = useTheme();
  const { username, password } = useAuth();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const PLAYER_HEIGHT = Platform.OS === 'web' ? 240 : Math.min(windowW * 9 / 16, 240);

  // Refs for active channel/stream (used in callbacks to avoid stale closures)
  const activeChannelRef = useRef<any>(null);
  const streamUrlRef = useRef<string | null>(null);

  const [categories, setCategories] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [epgData, setEpgData] = useState<{ [key: number]: any }>({});

  // Inline player state
  const [activeChannel, setActiveChannel] = useState<any>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerEpg, setPlayerEpg] = useState<{ current: any; next: any } | null>(null);
  const [playerProgress, setPlayerProgress] = useState(0);

  // Fullscreen state - uses native VideoView.enterFullscreen()
  const videoViewRef = useRef<any>(null);
  const isFullscreenRef = useRef(false);

  // Full TV guide state
  const [channelFullEpg, setChannelFullEpg] = useState<any[]>([]);
  const [epgLoading, setEpgLoading] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState(getDateStr(new Date()));

  // Date options for guide
  const dateOptions = useMemo(() => {
    const today = new Date();
    const options = [];
    for (let i = -1; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      options.push({
        label: i === 0 ? 'Today' : i === -1 ? 'Yesterday'
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        value: getDateStr(d),
        isToday: i === 0,
      });
    }
    return options;
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.getLiveCategories(username, password);
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [username, password]);

  const loadStreams = useCallback(async (catId?: string) => {
    setLoadingStreams(true);
    try {
      const data = await api.getLiveStreams(username, password, catId);
      const arr = Array.isArray(data) ? data : [];
      setStreams(arr);
      setFilteredStreams(arr);
      loadEpgBatch(arr.filter(s => s.epg_channel_id).slice(0, 20));
    } catch (e) { console.error(e); }
    finally { setLoadingStreams(false); setRefreshing(false); }
  }, [username, password]);

  const loadEpgBatch = async (streamList: any[]) => {
    const ids = streamList.filter(s => s.epg_channel_id).map(s => s.stream_id);
    if (ids.length === 0) return;
    try {
      const batchData = await api.getBatchEpg(username, password, ids);
      const epgMap: { [key: number]: any } = {};
      const now = Math.floor(Date.now() / 1000);
      const getTs = (e: any, field: 'start' | 'end') => {
        if (field === 'start') return parseInt(e.start_timestamp) || Math.floor(new Date(e.start + ' UTC').getTime() / 1000);
        return parseInt(e.stop_timestamp) || Math.floor(new Date(e.end + ' UTC').getTime() / 1000);
      };
      for (const [sid, data] of Object.entries(batchData) as any) {
        const listings = data?.epg_listings || [];
        if (listings.length > 0) {
          const current = listings.find((e: any) => {
            const start = getTs(e, 'start');
            const end = getTs(e, 'end');
            return now >= start && now <= end;
          });
          const next = listings.find((e: any) => getTs(e, 'start') > now);
          let progress = 0;
          if (current) {
            const start = getTs(current, 'start');
            const end = getTs(current, 'end');
            progress = Math.min(Math.max((now - start) / (end - start), 0), 1);
          }
          epgMap[parseInt(sid)] = { current, next, progress };
        }
      }
      setEpgData(prev => ({ ...prev, ...epgMap }));
    } catch (e) { console.error('Batch EPG error:', e); }
  };

  // Load full TV guide EPG for selected channel
  const loadFullEpg = async (streamId: number) => {
    setEpgLoading(true);
    setChannelFullEpg([]);
    try {
      const data = await api.getFullEpg(username, password, streamId);
      const listings = (data?.epg_listings || []).filter((e: any) => e.start_timestamp);
      listings.sort((a: any, b: any) => parseInt(a.start_timestamp) - parseInt(b.start_timestamp));
      setChannelFullEpg(listings);
    } catch (e) { console.error('Full EPG error:', e); }
    finally { setEpgLoading(false); }
  };

  useEffect(() => {
    Promise.all([loadCategories(), loadStreams()]).then(() => setLoading(false));
  }, [loadCategories, loadStreams]);

  useEffect(() => {
    if (search.trim()) {
      setFilteredStreams(streams.filter(s =>
        s.name?.toLowerCase().includes(search.toLowerCase())
      ));
    } else {
      setFilteredStreams(streams);
    }
  }, [search, streams]);

  const selectCategory = (catId: string | null) => {
    setSelectedCategory(catId);
    setSearch('');
    setEpgData({});
    loadStreams(catId || undefined);
  };

  // Play channel inline (hero preview) + load full guide
  const playChannelInline = async (item: any) => {
    setActiveChannel(item);
    setPlayerLoading(true);
    setPlayerEpg(null);
    setSelectedDateStr(getDateStr(new Date()));
    try {
      const data = await api.getStreamUrl(username, password, item.stream_id, 'live', 'ts');
      setStreamUrl(data.url);
      const cat = categories.find(c => c.category_id === item.category_id);
      api.addHistory({
        username,
        stream_id: item.stream_id,
        stream_name: item.name,
        stream_icon: item.stream_icon || '',
        stream_type: 'live',
        category_name: cat?.category_name || '',
      }).catch(() => {});
      // Load short EPG for inline player overlay
      const epg = await api.getEpg(username, password, item.stream_id).catch(() => null);
      if (epg?.epg_listings?.length > 0) {
        const now = Math.floor(Date.now() / 1000);
        const getTs = (e: any, field: 'start' | 'end') => {
          if (field === 'start') return parseInt(e.start_timestamp) || Math.floor(new Date(e.start + ' UTC').getTime() / 1000);
          return parseInt(e.stop_timestamp) || Math.floor(new Date(e.end + ' UTC').getTime() / 1000);
        };
        const current = epg.epg_listings.find((e: any) => now >= getTs(e, 'start') && now <= getTs(e, 'end'));
        const next = epg.epg_listings.find((e: any) => getTs(e, 'start') > now);
        setPlayerEpg({ current: current || null, next: next || null });
        if (current) {
          const start = getTs(current, 'start');
          const end = getTs(current, 'end');
          setPlayerProgress(Math.min(Math.max((now - start) / (end - start), 0), 1));
        }
      }
    } catch (e) { console.error(e); }
    finally { setPlayerLoading(false); }
    // Load full TV guide in background
    loadFullEpg(item.stream_id);
  };

  // Guard refs to prevent double navigation
  const orientationSubRef = useRef<any>(null);

  // Native fullscreen via VideoView ref - this is how Lux Player and other IPTV apps do it
  const goFullscreen = useCallback(() => {
    if (!activeChannel || !videoViewRef.current || isFullscreenRef.current) return;
    videoViewRef.current.enterFullscreen();
  }, [activeChannel]);

  // Navigate to multiview
  const openMultiview = useCallback(() => {
    try { inlinePlayer.pause(); } catch {}
    exitFullscreen();
    setTimeout(() => {
      router.push({
        pathname: '/multiview',
        params: {
          streamId: String(activeChannel?.stream_id || ''),
          streamName: activeChannel?.name || '',
          streamIcon: activeChannel?.stream_icon || '',
          categoryId: selectedCategory || activeChannel?.category_id || '',
          directUrl: streamUrl || '',
        },
      });
    }, 100);
  }, [activeChannel, streamUrl, selectedCategory, router, exitFullscreen, inlinePlayer]);

  // Auto-fullscreen on landscape rotation (bidirectional)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!activeChannel) {
      // No channel playing - lock portrait and remove listener
      if (orientationSubRef.current) {
        ScreenOrientation.removeOrientationChangeListener(orientationSubRef.current);
        orientationSubRef.current = null;
      }
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      return;
    }
    // Remove any existing listener before adding new one
    if (orientationSubRef.current) {
      ScreenOrientation.removeOrientationChangeListener(orientationSubRef.current);
      orientationSubRef.current = null;
    }
    // CRITICAL: Must await unlock before registering listener
    let cancelled = false;
    const setup = async () => {
      try {
        await ScreenOrientation.unlockAsync();
      } catch {}
      if (cancelled) return;
      const sub = ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
        const o = orientationInfo.orientation;
        if (o === ScreenOrientation.Orientation.LANDSCAPE_LEFT || o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT) {
          if (!isFullscreenRef.current) enterFullscreen();
        } else if (o === ScreenOrientation.Orientation.PORTRAIT_UP || o === ScreenOrientation.Orientation.PORTRAIT_DOWN) {
          if (isFullscreenRef.current) exitFullscreen();
        }
      });
      orientationSubRef.current = sub;
    };
    setup();
    return () => {
      cancelled = true;
      if (orientationSubRef.current) {
        ScreenOrientation.removeOrientationChangeListener(orientationSubRef.current);
        orientationSubRef.current = null;
      }
    };
  }, [activeChannel, enterFullscreen, exitFullscreen]);

  // Android back button handler for fullscreen
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFullscreenRef.current) {
        exitFullscreen();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [exitFullscreen]);

  // Video player for inline preview
  const inlinePlayer = useVideoPlayer(streamUrl || '', (p) => {
    if (streamUrl) p.play();
  });

  const { isPlaying } = useEvent(inlinePlayer, 'playingChange', { isPlaying: inlinePlayer.playing });

  // Pause inline player when screen loses focus; resume on focus gain
  useFocusEffect(
    useCallback(() => {
      // Returning to live screen - resume player if channel active
      if (activeChannel && streamUrl) {
        try { inlinePlayer.play(); } catch {}
      }
      // Ensure portrait lock if not in fullscreen
      if (Platform.OS !== 'web' && !isFullscreenRef.current) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
      return () => {
        // Leaving live screen - pause player and lock portrait
        try { inlinePlayer.pause(); } catch {}
        if (Platform.OS !== 'web') {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        }
      };
    }, [inlinePlayer, activeChannel, streamUrl])
  );

  // Filtered programs for TV guide
  const filteredPrograms = useMemo(() => {
    if (!channelFullEpg.length) return [];
    return channelFullEpg.filter((item: any) => {
      const ts = parseInt(item.start_timestamp);
      if (!ts) return false;
      const d = new Date(ts * 1000);
      return getDateStr(d) === selectedDateStr;
    });
  }, [channelFullEpg, selectedDateStr]);

  const formatTime12h = (timestamp: string | number) => {
    const ts = parseInt(String(timestamp));
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const renderChannel = ({ item, index }: { item: any; index: number }) => {
    const epg = epgData[item.stream_id];
    const isActive = activeChannel?.stream_id === item.stream_id;
    return (
      <TouchableOpacity
        testID={`live-channel-${index}`}
        style={[
          styles.channelRow,
          { backgroundColor: isActive ? colors.primary + '15' : colors.surface, borderColor: isActive ? colors.primary : colors.border },
        ]}
        activeOpacity={0.7}
        onPress={() => playChannelInline(item)}
      >
        <View style={[styles.channelLogo, { backgroundColor: colors.surfaceHighlight }]}>
          {item.stream_icon ? (
            <Image source={{ uri: item.stream_icon }} style={styles.channelLogoImg} resizeMode="contain" />
          ) : (
            <Ionicons name="tv-outline" size={20} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.channelInfo}>
          <Text style={[styles.channelNum, { color: colors.primary }]}>{item.num || index + 1}</Text>
          <View style={styles.channelTextWrap}>
            <Text style={[styles.channelName, { color: isActive ? colors.primary : colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
            {epg?.current?.title ? (
              <View style={styles.epgCurrentRow}>
                <View style={[styles.epgLiveDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.epgCurrentText, { color: colors.textSecondary }]} numberOfLines={1}>{epg.current.title}</Text>
              </View>
            ) : null}
            {epg?.current ? (
              <View style={[styles.epgProgressBar, { backgroundColor: colors.border }]}>
                <View style={[styles.epgProgressFill, { width: `${(epg.progress || 0) * 100}%`, backgroundColor: colors.primary }]} />
              </View>
            ) : null}
            {epg?.next?.title ? (
              <View style={styles.epgNextRow}>
                <Text style={[styles.epgNextLabel, { color: colors.textSecondary }]}>Next: </Text>
                <Text style={[styles.epgNextText, { color: colors.textSecondary }]} numberOfLines={1}>{epg.next.title}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {isActive ? (
          <View style={[styles.nowPlayingBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="radio" size={12} color="#fff" />
          </View>
        ) : (
          <Ionicons name="play-circle" size={28} color={colors.primary} style={{ marginLeft: 8 }} />
        )}
      </TouchableOpacity>
    );
  };

  // Render a program row in the TV guide
  const renderProgram = ({ item }: { item: any }) => {
    const now = Math.floor(Date.now() / 1000);
    const startTs = parseInt(item.start_timestamp);
    const endTs = parseInt(item.stop_timestamp);
    const isLive = now >= startTs && now <= endTs;
    const isPast = endTs < now;
    const progress = isLive ? Math.min(Math.max((now - startTs) / (endTs - startTs), 0), 1) : 0;
    return (
      <View style={[
        styles.programRow,
        isLive ? { backgroundColor: colors.surface } : { backgroundColor: 'transparent' },
        isPast ? { opacity: 0.5 } : {},
      ]}>
        <Text style={[styles.programTime, { color: isLive ? colors.primary : colors.textSecondary }]}>
          {formatTime12h(startTs)}
        </Text>
        <View style={styles.programInfo}>
          <View style={styles.programTitleRow}>
            <Text style={[styles.programTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title || 'Unknown Program'}
            </Text>
            {isLive && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>Live</Text>
              </View>
            )}
          </View>
          {item.description ? (
            <Text style={[styles.programDesc, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          {isLive && (
            <View style={[styles.programProgress, { backgroundColor: colors.border }]}>
              <View style={[styles.programProgressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
            </View>
          )}
        </View>
      </View>
    );
  };

  // TV Guide header (channel selector + date picker)
  const renderGuideHeader = () => (
    <View>
      {/* Channel selector */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filteredStreams}
        keyExtractor={(item, i) => `sel-${item.stream_id || i}`}
        contentContainerStyle={styles.channelSelectorList}
        renderItem={({ item }) => {
          const isActive = activeChannel?.stream_id === item.stream_id;
          return (
            <TouchableOpacity
              style={[
                styles.channelSelectorCard,
                { backgroundColor: colors.surface, borderColor: isActive ? colors.primary : colors.border },
                isActive && styles.channelSelectorCardActive,
              ]}
              onPress={() => playChannelInline(item)}
              activeOpacity={0.7}
            >
              {item.stream_icon ? (
                <Image source={{ uri: item.stream_icon }} style={styles.channelSelectorImg} resizeMode="contain" />
              ) : (
                <Ionicons name="tv" size={22} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          );
        }}
      />
      {/* Date picker */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={dateOptions}
        keyExtractor={item => item.value}
        contentContainerStyle={styles.dateSelectorList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.dateChip,
              { backgroundColor: selectedDateStr === item.value ? colors.primary : colors.surface, borderColor: selectedDateStr === item.value ? colors.primary : colors.border },
            ]}
            onPress={() => setSelectedDateStr(item.value)}
          >
            <Text style={[
              styles.dateChipText,
              { color: selectedDateStr === item.value ? '#fff' : (item.isToday ? colors.primary : colors.textSecondary), fontWeight: item.isToday ? '700' : '400' },
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
      {/* Guide section header */}
      <View style={[styles.guideSectionHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.guideSectionTitle, { color: colors.textPrimary }]}>TV Schedule</Text>
        {epgLoading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  // Compute favorite data for current channel
  const favData = activeChannel ? {
    stream_id: activeChannel.stream_id,
    name: activeChannel.name,
    stream_icon: activeChannel.stream_icon || '',
    category_id: activeChannel.category_id || '',
  } : null;
  const starred = activeChannel ? isFavorite(activeChannel.stream_id) : false;

  // ==================== RENDER ====================
  return (
    <View style={{ flex: 1 }}>
      {/* FULLSCREEN MODAL - renders above EVERYTHING including tab bar */}
      <Modal
        visible={isFullscreen}
        animationType="none"
        supportedOrientations={['landscape']}
        statusBarTranslucent
        onRequestClose={exitFullscreen}
      >
        <View style={styles.fsContainer}>
          <StatusBar hidden />
          <TouchableOpacity
            activeOpacity={1}
            onPress={toggleFsControls}
            style={StyleSheet.absoluteFill}
          >
            <VideoView
              testID="fs-video-player"
              style={StyleSheet.absoluteFill}
              player={inlinePlayer}
              contentFit={fsAspectMode}
              nativeControls={false}
            />
          </TouchableOpacity>

          {showFsControls && (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fsControlsOpacity }]} pointerEvents="box-none">
              {/* Top bar */}
              <View style={styles.fsTopBar}>
                <TouchableOpacity testID="fs-back-btn" style={styles.fsTopBtn} onPress={exitFullscreen}>
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.fsChannelName} numberOfLines={1}>{activeChannel?.name}</Text>
                <TouchableOpacity
                  testID="fs-aspect-btn"
                  style={styles.fsAspectBtn}
                  onPress={() => {
                    const idx = ASPECT_MODES.indexOf(fsAspectMode);
                    setFsAspectMode(ASPECT_MODES[(idx + 1) % ASPECT_MODES.length]);
                    startFsControlsTimer();
                  }}
                >
                  <Text style={styles.fsAspectText}>{fsAspectMode.toUpperCase()}</Text>
                </TouchableOpacity>
              </View>

              {/* Side channel arrows */}
              <View style={styles.fsSideControls}>
                <TouchableOpacity testID="fs-prev-btn" style={styles.fsSideBtn} onPress={() => switchChannel('prev')}>
                  <Ionicons name="chevron-up" size={28} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity testID="fs-next-btn" style={styles.fsSideBtn} onPress={() => switchChannel('next')}>
                  <Ionicons name="chevron-down" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Bottom overlay */}
              <View style={styles.fsBottomOverlay}>
                <View style={styles.fsInfoSection}>
                  <Text style={styles.fsInfoChannel} numberOfLines={1}>{activeChannel?.name}</Text>
                  {playerEpg?.current?.title ? (
                    <Text style={styles.fsInfoProgram} numberOfLines={1}>{playerEpg.current.title}</Text>
                  ) : null}
                  <View style={styles.fsLiveRow}>
                    <View style={styles.fsLiveBadge}><Text style={styles.fsLiveText}>LIVE</Text></View>
                  </View>
                  {playerEpg?.current && (
                    <View style={styles.fsProgressBar}>
                      <View style={[styles.fsProgressFill, { width: `${playerProgress * 100}%` }]} />
                    </View>
                  )}
                </View>

                {/* Bottom controls row */}
                <View style={styles.fsControlsRow}>
                  <TouchableOpacity testID="fs-fav-btn" style={styles.fsCtrlBtn} onPress={() => {
                    if (favData) toggleFavorite(favData);
                    startFsControlsTimer();
                  }}>
                    <Ionicons name={starred ? 'star' : 'star-outline'} size={22} color={starred ? '#FFD700' : '#fff'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fsCtrlBtn}><Ionicons name="information-circle-outline" size={22} color="#fff" /></TouchableOpacity>
                  <View style={styles.fsCenterControls}>
                    <TouchableOpacity testID="fs-skip-back" style={styles.fsCenterBtn} onPress={() => switchChannel('prev')}>
                      <Ionicons name="play-skip-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity testID="fs-play-btn" style={styles.fsPlayBtn} onPress={() => {
                      if (inlinePlayer.playing) inlinePlayer.pause(); else inlinePlayer.play();
                      startFsControlsTimer();
                    }}>
                      <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity testID="fs-skip-fwd" style={styles.fsCenterBtn} onPress={() => switchChannel('next')}>
                      <Ionicons name="play-skip-forward" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.fsCtrlBtn}><Ionicons name="share-outline" size={22} color="#fff" /></TouchableOpacity>
                  <TouchableOpacity testID="fs-multiview-btn" style={styles.fsCtrlBtn} onPress={openMultiview}>
                    <Ionicons name="grid-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </Modal>

      {/* NORMAL (PORTRAIT) MODE */}
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar style="light" />
      {/* Inline Hero Player (when a channel is active) */}
      {activeChannel && (
        <View style={styles.inlinePlayerSection}>
          <View style={styles.inlinePlayerWrap}>
            {playerLoading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color="#00BFFF" />
              </View>
            ) : (streamUrl && !isFullscreen) ? (
              <TouchableOpacity activeOpacity={0.95} onPress={goFullscreen} style={styles.inlineVideoTouch}>
                <VideoView
                  testID="inline-video-player"
                  style={styles.inlineVideo}
                  player={inlinePlayer}
                  contentFit="contain"
                  nativeControls={false}
                />
              </TouchableOpacity>
            ) : null}
            {/* Overlay info */}
            <View style={styles.inlineOverlay}>
              <View style={styles.inlineInfoRow}>
                {activeChannel.stream_icon ? (
                  <Image source={{ uri: activeChannel.stream_icon }} style={styles.inlineIcon} resizeMode="contain" />
                ) : null}
                <View style={styles.inlineInfoText}>
                  <Text style={styles.inlineChannelName} numberOfLines={1}>{activeChannel.name}</Text>
                  {playerEpg?.current?.title ? (
                    <Text style={styles.inlineProgramName} numberOfLines={1}>{playerEpg.current.title}</Text>
                  ) : null}
                </View>
                <View style={styles.inlineLiveBadge}>
                  <Text style={styles.inlineLiveText}>LIVE</Text>
                </View>
              </View>
              {playerEpg?.current && (
                <View style={styles.inlineProgress}>
                  <View style={styles.inlineProgressBar}>
                    <View style={[styles.inlineProgressFill, { width: `${playerProgress * 100}%` }]} />
                  </View>
                </View>
              )}
            </View>
            {/* Controls */}
            <View style={styles.inlineControls}>
              <TouchableOpacity testID="inline-close-btn" style={styles.inlineControlBtn} onPress={() => {
                try { inlinePlayer.pause(); } catch (e) {}
                setActiveChannel(null);
                setStreamUrl(null);
                setChannelFullEpg([]);
              }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="inline-play-btn" style={styles.inlineControlBtn} onPress={() => {
                if (inlinePlayer.playing) inlinePlayer.pause(); else inlinePlayer.play();
              }}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="inline-fullscreen-btn" style={styles.inlineControlBtn} onPress={goFullscreen}>
                <Ionicons name="expand" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* CHANNEL LIST MODE (no active channel) */}
      {!activeChannel && (
        <>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Live TV</Text>

          {/* Favorites Section */}
          {favorites.length > 0 && (
            <View style={styles.favSection}>
              <Text style={[styles.favSectionTitle, { color: colors.textPrimary }]}>Favorites</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={favorites}
                keyExtractor={(item) => `fav-${item.stream_id}`}
                contentContainerStyle={styles.favList}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    testID={`live-fav-${index}`}
                    style={[styles.favCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      const fullStream = streams.find(s => s.stream_id === item.stream_id) || {
                        stream_id: item.stream_id,
                        name: item.name,
                        stream_icon: item.stream_icon,
                        category_id: item.category_id,
                      };
                      playChannelInline(fullStream);
                    }}
                  >
                    {item.stream_icon ? (
                      <Image source={{ uri: item.stream_icon }} style={styles.favCardImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={20} color={colors.textSecondary} />
                    )}
                    <Text style={[styles.favCardName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                    <Ionicons name="star" size={12} color="#FFD700" style={styles.favStar} />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              testID="live-search-input"
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search channels..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.catSection}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ category_id: null, category_name: 'All' }, ...categories]}
              keyExtractor={(item, i) => `cat-${i}`}
              contentContainerStyle={styles.catList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`live-cat-${item.category_id || 'all'}`}
                  style={[
                    styles.catChip,
                    { backgroundColor: selectedCategory === item.category_id ? colors.primary : colors.surface, borderColor: selectedCategory === item.category_id ? colors.primary : colors.border },
                  ]}
                  onPress={() => selectCategory(item.category_id)}
                >
                  <Text style={[styles.catChipText, { color: selectedCategory === item.category_id ? '#fff' : colors.textPrimary }]}>
                    {item.category_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
          <View style={styles.guideHeader}>
            <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>{filteredStreams.length} channels</Text>
          </View>
        </>
      )}

      {/* TV GUIDE MODE (channel active) */}
      {activeChannel ? (
        loadingStreams ? (
          <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            data={filteredPrograms}
            keyExtractor={(item, i) => `prog-${i}-${item.start_timestamp}`}
            renderItem={renderProgram}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListHeaderComponent={renderGuideHeader}
            ListEmptyComponent={
              epgLoading ? null : (
                <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                  <Ionicons name="calendar-outline" size={36} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No schedule for this day</Text>
                </View>
              )
            }
          />
        )
      ) : (
        // CHANNEL LIST
        loadingStreams ? (
          <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            data={filteredStreams}
            keyExtractor={(item, i) => `stream-${item.stream_id || i}`}
            renderItem={renderChannel}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              setEpgData({});
              loadStreams(selectedCategory || undefined);
            }} tintColor={colors.primary} />}
            onEndReached={() => {
              const loaded = Object.keys(epgData).map(Number);
              const needEpg = filteredStreams.filter(s => s.epg_channel_id && !loaded.includes(s.stream_id));
              if (needEpg.length > 0) loadEpgBatch(needEpg.slice(0, 20));
            }}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                <Ionicons name="tv-outline" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No channels found</Text>
              </View>
            }
          />
        )
      )}
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },

  // Favorites section
  favSection: { marginBottom: 8 },
  favSectionTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 20, marginBottom: 10 },
  favList: { paddingHorizontal: 16, gap: 10 },
  favCard: {
    width: 88, borderRadius: 12, borderWidth: 1, padding: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  favCardImg: { width: 48, height: 36, marginBottom: 4 },
  favCardName: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  favStar: { position: 'absolute', top: 4, right: 4 },

  // Inline player
  inlinePlayerSection: { backgroundColor: '#000' },
  inlinePlayerWrap: { width: '100%', aspectRatio: 16 / 9, maxHeight: 240, position: 'relative' },
  inlineLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  inlineVideoTouch: { flex: 1 },
  inlineVideo: { width: '100%', height: '100%' },
  inlineOverlay: { position: 'absolute', bottom: 36, left: 12, right: 12 },
  inlineInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineIcon: { width: 32, height: 32, borderRadius: 6 },
  inlineInfoText: { flex: 1 },
  inlineChannelName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  inlineProgramName: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  inlineLiveBadge: { backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 },
  inlineLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  inlineProgress: { marginTop: 6 },
  inlineProgressBar: { height: 2, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1 },
  inlineProgressFill: { height: '100%', backgroundColor: '#00BFFF', borderRadius: 1 },
  inlineControls: { position: 'absolute', bottom: 6, right: 8, flexDirection: 'row', gap: 4 },
  inlineControlBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Channel list
  searchBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingHorizontal: 14,
    height: 44, borderRadius: 12, borderWidth: 1, marginBottom: 8, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  catSection: { height: 44, marginBottom: 4 },
  catList: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, height: 36, justifyContent: 'center' },
  catChipText: { fontSize: 13, fontWeight: '600' },
  guideHeader: { paddingHorizontal: 20, paddingVertical: 6 },
  guideTitle: { fontSize: 14, fontWeight: '700' },
  channelRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 12,
    borderRadius: 12, marginBottom: 6, borderWidth: 1,
  },
  channelLogo: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  channelLogoImg: { width: 40, height: 40 },
  channelInfo: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', marginLeft: 12 },
  channelNum: { fontSize: 14, fontWeight: '700', marginRight: 8, marginTop: 2, minWidth: 22 },
  channelTextWrap: { flex: 1 },
  channelName: { fontSize: 14, fontWeight: '700' },
  epgCurrentRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  epgLiveDot: { width: 6, height: 6, borderRadius: 3 },
  epgCurrentText: { fontSize: 12, flex: 1 },
  epgProgressBar: { height: 3, borderRadius: 2, marginTop: 4, marginBottom: 4 },
  epgProgressFill: { height: '100%', borderRadius: 2 },
  epgNextRow: { flexDirection: 'row', alignItems: 'center' },
  epgNextLabel: { fontSize: 11, fontWeight: '600' },
  epgNextText: { fontSize: 11, fontStyle: 'italic', flex: 1 },
  nowPlayingBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  emptyState: { margin: 16, padding: 40, borderRadius: 12, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14 },

  // Channel selector (guide mode)
  channelSelectorList: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  channelSelectorCard: {
    width: 72, height: 56, borderRadius: 12, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  channelSelectorCardActive: { borderWidth: 2.5 },
  channelSelectorImg: { width: 56, height: 40 },

  // Date picker
  dateSelectorList: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  dateChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, height: 34, justifyContent: 'center',
  },
  dateChipText: { fontSize: 13 },

  // Guide section header
  guideSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1,
  },
  guideSectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Program rows
  programRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
    alignItems: 'flex-start', gap: 14,
  },
  programTime: { fontSize: 13, fontWeight: '600', minWidth: 68, paddingTop: 2 },
  programInfo: { flex: 1 },
  programTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  programTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  programDesc: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  programProgress: { height: 3, borderRadius: 2, marginTop: 8 },
  programProgressFill: { height: '100%', borderRadius: 2 },
  liveBadge: {
    backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // ==================== FULLSCREEN STYLES ====================
  fsContainer: { flex: 1, backgroundColor: '#000' },
  fsTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10,
  },
  fsTopBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  fsChannelName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700', marginHorizontal: 8 },
  fsAspectBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 6,
  },
  fsAspectText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  fsSideControls: {
    position: 'absolute', right: 12, top: '30%', gap: 24, zIndex: 10,
  },
  fsSideBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },

  fsBottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  fsInfoSection: { marginBottom: 8 },
  fsInfoChannel: { color: '#fff', fontSize: 16, fontWeight: '800' },
  fsInfoProgram: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  fsLiveRow: { flexDirection: 'row', marginTop: 4, gap: 8, alignItems: 'center' },
  fsLiveBadge: { backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 },
  fsLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  fsProgressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 6 },
  fsProgressFill: { height: '100%', backgroundColor: '#00BFFF', borderRadius: 2 },

  fsControlsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  fsCtrlBtn: { padding: 8 },
  fsCenterControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  fsCenterBtn: { padding: 6 },
  fsPlayBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
});
