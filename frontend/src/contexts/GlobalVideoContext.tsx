import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

interface VideoState {
  streamUrl: string | null;
  channelName: string;
  channelIcon: string;
  programTitle: string;
  isFullscreen: boolean;
  isPlaying: boolean;
  resizeModeIdx: number;
}

interface VideoContextType {
  videoRef: React.RefObject<Video>;
  state: VideoState;
  playStream: (url: string, name: string, icon: string, programTitle?: string) => void;
  stopStream: () => void;
  setFullscreen: (fs: boolean) => void;
  togglePlay: () => void;
  cycleResizeMode: () => void;
  setIsPlaying: (playing: boolean) => void;
  setProgramTitle: (title: string) => void;
}

const VideoContext = createContext<VideoContextType | null>(null);

export const useGlobalVideo = () => {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useGlobalVideo must be used within GlobalVideoProvider');
  return ctx;
};

export const GlobalVideoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const videoRef = useRef<Video>(null);
  const [state, setState] = useState<VideoState>({
    streamUrl: null,
    channelName: '',
    channelIcon: '',
    programTitle: '',
    isFullscreen: false,
    isPlaying: false,
    resizeModeIdx: 0,
  });

  const playStream = useCallback((url: string, name: string, icon: string, programTitle: string = '') => {
    setState(prev => ({
      ...prev,
      streamUrl: url,
      channelName: name,
      channelIcon: icon,
      programTitle,
      isPlaying: true,
    }));
  }, []);

  const stopStream = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pauseAsync().catch(() => {});
    }
    setState(prev => ({
      ...prev,
      streamUrl: null,
      channelName: '',
      channelIcon: '',
      programTitle: '',
      isFullscreen: false,
      isPlaying: false,
    }));
  }, []);

  const setFullscreen = useCallback((fs: boolean) => {
    setState(prev => ({ ...prev, isFullscreen: fs }));
  }, []);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    if (state.isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  }, [state.isPlaying]);

  const cycleResizeMode = useCallback(() => {
    setState(prev => ({ ...prev, resizeModeIdx: (prev.resizeModeIdx + 1) % 3 }));
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setState(prev => ({ ...prev, isPlaying: playing }));
  }, []);

  const setProgramTitle = useCallback((title: string) => {
    setState(prev => ({ ...prev, programTitle: title }));
  }, []);

  return (
    <VideoContext.Provider value={{
      videoRef,
      state,
      playStream,
      stopStream,
      setFullscreen,
      togglePlay,
      cycleResizeMode,
      setIsPlaying,
      setProgramTitle,
    }}>
      {children}
    </VideoContext.Provider>
  );
};
