import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Video, ResizeMode } from 'expo-av';

interface VideoState {
  streamUrl: string | null;
  fallbackUrl: string | null;
  channelName: string;
  channelIcon: string;
  programTitle: string;
  streamId: number | null;
  categoryId: string;
  isFullscreen: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  resizeModeIdx: number;
  isTransitioning: boolean;
}

interface VideoContextType {
  videoRef: React.RefObject<Video>;
  state: VideoState;
  playStream: (url: string, name: string, icon: string, programTitle: string, streamId: number, categoryId: string, fallbackUrl?: string) => void;
  stopStream: () => void;
  setFullscreen: (fs: boolean) => void;
  togglePlay: () => void;
  cycleResizeMode: () => void;
  setIsPlaying: (playing: boolean) => void;
  setProgramTitle: (title: string) => void;
  setTransitioning: (t: boolean) => void;
  tryFallbackUrl: () => void;
  setMuted: (m: boolean) => void;
  setStreamList: (list: any[]) => void;
  nextChannel: () => void;
  prevChannel: () => void;
  streamList: any[];
}

const VideoContext = createContext<VideoContextType | null>(null);

export const useGlobalVideo = () => {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useGlobalVideo must be used within GlobalVideoProvider');
  return ctx;
};

export const GlobalVideoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const videoRef = useRef<Video>(null);
  const [streamList, setStreamListState] = useState<any[]>([]);
  const [state, setState] = useState<VideoState>({
    streamUrl: null,
    fallbackUrl: null,
    channelName: '',
    channelIcon: '',
    programTitle: '',
    streamId: null,
    categoryId: '',
    isFullscreen: false,
    isPlaying: false,
    isMuted: false,
    resizeModeIdx: 0,
    isTransitioning: false,
  });

  // Auto-play when stream URL changes
  useEffect(() => {
    if (state.streamUrl && videoRef.current) {
      videoRef.current.playAsync().catch(() => {});
    }
  }, [state.streamUrl]);

  const playStream = useCallback((url: string, name: string, icon: string, programTitle: string = '', streamId: number = 0, categoryId: string = '', fallbackUrl?: string) => {
    setState(prev => ({
      ...prev,
      streamUrl: url,
      fallbackUrl: fallbackUrl || null,
      channelName: name,
      channelIcon: icon,
      programTitle,
      streamId,
      categoryId,
      isPlaying: true,
      isTransitioning: true,
    }));
  }, []);

  const stopStream = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pauseAsync().catch(() => {});
    }
    setState(prev => ({
      ...prev,
      streamUrl: null,
      fallbackUrl: null,
      channelName: '',
      channelIcon: '',
      programTitle: '',
      streamId: null,
      categoryId: '',
      isFullscreen: false,
      isPlaying: false,
      isMuted: false,
      isTransitioning: false,
    }));
  }, []);

  const setFullscreen = useCallback((fs: boolean) => {
    setState(prev => ({ ...prev, isFullscreen: fs }));
  }, []);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch {}
  }, []);

  const cycleResizeMode = useCallback(() => {
    setState(prev => ({ ...prev, resizeModeIdx: (prev.resizeModeIdx + 1) % 3 }));
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setState(prev => ({ ...prev, isPlaying: playing }));
  }, []);

  const setProgramTitle = useCallback((title: string) => {
    setState(prev => ({ ...prev, programTitle: title }));
  }, []);

  const setTransitioning = useCallback((t: boolean) => {
    setState(prev => ({ ...prev, isTransitioning: t }));
  }, []);

  const tryFallbackUrl = useCallback(() => {
    setState(prev => {
      if (prev.fallbackUrl && prev.fallbackUrl !== prev.streamUrl) {
        return { ...prev, streamUrl: prev.fallbackUrl, fallbackUrl: null, isTransitioning: true };
      }
      return prev;
    });
  }, []);

  const setMuted = useCallback((m: boolean) => {
    setState(prev => ({ ...prev, isMuted: m }));
    if (videoRef.current) {
      videoRef.current.setIsMutedAsync(m).catch(() => {});
    }
  }, []);

  const setStreamList = useCallback((list: any[]) => {
    setStreamListState(list);
  }, []);

  // Navigate to next/prev channel in the stream list
  const nextChannel = useCallback(() => {
    if (streamList.length === 0 || !state.streamId) return;
    const idx = streamList.findIndex((s: any) => s.stream_id === state.streamId);
    const nextIdx = idx >= 0 ? (idx + 1) % streamList.length : 0;
    const next = streamList[nextIdx];
    if (next) {
      // We set transition and name/icon immediately, URL will be fetched by the caller
      setState(prev => ({
        ...prev,
        streamId: next.stream_id,
        channelName: next.name || '',
        channelIcon: next.stream_icon || '',
        categoryId: next.category_id || '',
        programTitle: '',
        isTransitioning: true,
      }));
    }
  }, [streamList, state.streamId]);

  const prevChannel = useCallback(() => {
    if (streamList.length === 0 || !state.streamId) return;
    const idx = streamList.findIndex((s: any) => s.stream_id === state.streamId);
    const prevIdx = idx > 0 ? idx - 1 : streamList.length - 1;
    const prev = streamList[prevIdx];
    if (prev) {
      setState(p => ({
        ...p,
        streamId: prev.stream_id,
        channelName: prev.name || '',
        channelIcon: prev.stream_icon || '',
        categoryId: prev.category_id || '',
        programTitle: '',
        isTransitioning: true,
      }));
    }
  }, [streamList, state.streamId]);

  return (
    <VideoContext.Provider value={{
      videoRef, state, playStream, stopStream, setFullscreen,
      togglePlay, cycleResizeMode, setIsPlaying, setProgramTitle,
      setTransitioning, tryFallbackUrl, setMuted, setStreamList,
      nextChannel, prevChannel, streamList,
    }}>
      {children}
    </VideoContext.Provider>
  );
};
