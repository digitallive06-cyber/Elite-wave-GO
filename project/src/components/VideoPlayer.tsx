import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { PlayingContent } from './MainApp';
import { Home, Menu, ArrowLeft, List } from 'lucide-react';
import type { Channel } from '../services/xtream';

interface VideoPlayerProps {
  content: PlayingContent;
  onClose: () => void;
  onHome?: () => void;
  channels?: Channel[];
  currentChannelIndex?: number;
  onChannelChange?: (index: number) => void;
}

export function VideoPlayer({ content, onClose, onHome, channels = [], currentChannelIndex = 0, onChannelChange }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const loadingTimeoutRef = useRef<number>();
  const [showControls, setShowControls] = useState(true);
  const [showMiniGuide, setShowMiniGuide] = useState(false);
  const [showFullGuide, setShowFullGuide] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hideControlsTimeoutRef = useRef<number>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);

    console.log('Attempting to play stream:', content.url);

    const loadingTimeout = window.setTimeout(() => {
      if (isLoading) {
        console.error('Stream loading timeout');
        setError('Stream is taking too long to load. Please try another channel.');
        setIsLoading(false);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      }
    }, 15000);

    loadingTimeoutRef.current = loadingTimeout;

    const initializePlayer = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          maxBufferSize: 60 * 1000 * 1000,
          maxFragLookUpTolerance: 0.25,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 6,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 10,
          xhrSetup: (xhr: XMLHttpRequest) => {
            xhr.withCredentials = false;
          },
        });

        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_LOADING, () => {
          console.log('Loading manifest...');
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log('Manifest parsed successfully', data);
          clearTimeout(loadingTimeoutRef.current);
          setIsLoading(false);
          video.play().catch((error) => {
            console.error('Error playing video:', error);
            setError('Failed to start playback. Please try again.');
          });
        });

        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          console.log('Level loaded:', data);
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          console.log('Fragment loaded');
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data.type, data.details, data);

          if (data.fatal) {
            clearTimeout(loadingTimeoutRef.current);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Network error - attempting recovery');
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
                  setError('Cannot connect to stream. Please check your connection or try another channel.');
                  setIsLoading(false);
                } else {
                  hls.startLoad();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Media error - attempting recovery');
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal error - cannot recover');
                setError('Failed to load stream. Please try another channel.');
                setIsLoading(false);
                break;
            }
          }
        });

        hls.loadSource(content.url);
        hls.attachMedia(video);

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('Using native HLS support');
        video.src = content.url;

        video.addEventListener('loadstart', () => {
          console.log('Video load started');
        });

        video.addEventListener('loadedmetadata', () => {
          console.log('Metadata loaded');
          clearTimeout(loadingTimeoutRef.current);
          setIsLoading(false);
          video.play().catch((error) => {
            console.error('Error playing video:', error);
            setError('Failed to start playback. Please try again.');
          });
        });

        video.addEventListener('error', (e) => {
          console.error('Video error:', e);
          clearTimeout(loadingTimeoutRef.current);
          setError('Failed to load stream. Please try another channel.');
          setIsLoading(false);
        });

        video.addEventListener('stalled', () => {
          console.warn('Video stalled');
        });

      } else {
        setError('HLS not supported in this browser');
        setIsLoading(false);
      }
    };

    initializePlayer();

    return () => {
      clearTimeout(loadingTimeoutRef.current);
      if (hlsRef.current) {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [content.url]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = window.setTimeout(() => {
      if (!showMiniGuide && !showFullGuide) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleChannelSelect = (index: number) => {
    if (onChannelChange) {
      onChannelChange(index);
      setShowMiniGuide(false);
      setShowFullGuide(false);
    }
  };

  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  const currentChannel = channels.length > 0 ? channels[currentChannelIndex] : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !showMiniGuide && !showFullGuide && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls={false}
        autoPlay
        playsInline
      />

      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-20">
          {currentChannel?.stream_icon ? (
            <img src={currentChannel.stream_icon} alt="Channel" className="w-48 h-48 object-contain mb-8" onError={(e) => {
              e.currentTarget.style.display = 'none';
            }} />
          ) : (
            <img src="/1000006713.png" alt="Elite Wave GO" className="w-64 h-64 object-contain mb-8" />
          )}
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-white text-xl mt-4">{content.title}</p>
          <p className="text-slate-400 text-sm mt-2">Loading stream...</p>
          <button
            onClick={onClose}
            className="mt-8 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-20">
          <div className="text-red-400 text-xl mb-2 text-center px-4">{error}</div>
          <div className="text-slate-400 text-sm mb-8 text-center px-4">
            Check browser console (F12) for more details
          </div>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      )}

      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/80 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute top-0 left-0 right-0 p-6 flex items-start justify-between pointer-events-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            {currentChannel?.stream_icon && (
              <img
                src={currentChannel.stream_icon}
                alt={content.title}
                className="w-12 h-12 object-contain rounded bg-black/50 p-1"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">{content.title}</h2>
              {content.description && (
                <p className="text-slate-300 text-sm">{content.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onHome && (
              <button
                onClick={onHome}
                className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-lg transition-colors"
              >
                <Home className="w-6 h-6" />
              </button>
            )}
            <button
              onClick={() => setShowFullGuide(!showFullGuide)}
              className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-lg transition-colors"
            >
              <List className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-auto">
          <div className="flex items-center justify-center">
            {content.type === 'live' && channels.length > 0 && (
              <button
                onClick={() => setShowMiniGuide(!showMiniGuide)}
                className="bg-black/50 hover:bg-black/70 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
              >
                <Menu className="w-5 h-5" />
                <span>TV Guide</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showMiniGuide && content.type === 'live' && channels.length > 0 && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-8 max-w-5xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border border-pink-500/20">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-white">Now Playing</h3>
              <button
                onClick={() => setShowMiniGuide(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto flex-1">
              {channels.slice(0, 20).map((channel, index) => (
                <button
                  key={channel.stream_id}
                  onClick={() => handleChannelSelect(index)}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl transition-all ${
                    index === currentChannelIndex
                      ? 'bg-gradient-to-br from-pink-600 to-purple-600 text-white ring-2 ring-pink-400 shadow-lg shadow-pink-500/50'
                      : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-300'
                  }`}
                >
                  {channel.stream_icon ? (
                    <img
                      src={channel.stream_icon}
                      alt={channel.name}
                      className="w-16 h-16 object-contain rounded bg-slate-900/50 p-2"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 bg-slate-900 rounded flex items-center justify-center">
                      <span className="text-lg font-bold">{channel.num}</span>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="font-semibold text-sm truncate w-full">{channel.name}</p>
                    <p className="text-xs opacity-70">Channel {channel.num}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showFullGuide && content.type === 'live' && channels.length > 0 && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-8 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-pink-500/20">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-white">Full TV Guide</h3>
              <button
                onClick={() => setShowFullGuide(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2">
              {channels.map((channel, index) => (
                <button
                  key={channel.stream_id}
                  onClick={() => handleChannelSelect(index)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                    index === currentChannelIndex
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white ring-2 ring-pink-400 shadow-lg shadow-pink-500/30'
                      : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-300'
                  }`}
                >
                  {channel.stream_icon ? (
                    <img
                      src={channel.stream_icon}
                      alt={channel.name}
                      className="w-14 h-14 object-contain rounded bg-slate-900/50 p-2"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-14 h-14 bg-slate-900 rounded flex items-center justify-center">
                      <span className="text-sm font-bold">{channel.num}</span>
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-lg">{channel.name}</p>
                    <p className="text-sm opacity-70">Channel {channel.num}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
