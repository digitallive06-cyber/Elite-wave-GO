import { useState } from 'react';
import { useIPTV } from '../contexts/IPTVContext';
import { Sidebar } from './Sidebar';
import { Home } from './Home';
import { LiveTV } from './LiveTV';
import { Movies } from './Movies';
import { Series } from './Series';
import { VideoPlayer } from './VideoPlayer';
import { LogOut, User } from 'lucide-react';
import type { Channel } from '../services/xtream';

export type ViewType = 'home' | 'live' | 'movies' | 'series';

export interface PlayingContent {
  type: 'live' | 'movie' | 'series';
  url: string;
  title: string;
  description?: string;
}

export function MainApp() {
  const { profile, xtreamAuth, disconnectProfile, getLiveStreamUrl } = useIPTV();
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [playing, setPlaying] = useState<PlayingContent | null>(null);
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);
  const [currentChannelIndex, setCurrentChannelIndex] = useState(0);

  const handleDisconnect = () => {
    disconnectProfile();
  };

  const handlePlayLive = (content: PlayingContent, channels: Channel[], channelIndex: number) => {
    setPlaying(content);
    setLiveChannels(channels);
    setCurrentChannelIndex(channelIndex);
  };

  const handlePlayOther = (content: PlayingContent) => {
    setPlaying(content);
    setLiveChannels([]);
    setCurrentChannelIndex(0);
  };

  const handleChannelChange = (newIndex: number) => {
    if (liveChannels.length > 0 && liveChannels[newIndex]) {
      const newChannel = liveChannels[newIndex];
      const streamUrl = getLiveStreamUrl(newChannel);
      console.log('Changing channel to:', newChannel.name);
      console.log('Stream URL:', streamUrl);
      console.log('Direct Source:', newChannel.direct_source);
      setPlaying({
        type: 'live',
        url: streamUrl,
        title: newChannel.name,
      });
      setCurrentChannelIndex(newIndex);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />

      <div className="flex-1 flex flex-col">
        <header className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{profile?.profile_name}</h1>
              {xtreamAuth && (
                <p className="text-sm text-slate-400">
                  Expires: {new Date(parseInt(xtreamAuth.user_info.exp_date) * 1000).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-300 bg-slate-800/50 px-4 py-2 rounded-lg">
                <User className="w-5 h-5" />
                <span className="text-sm">{xtreamAuth?.user_info.username}</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          {playing ? (
            <VideoPlayer
              content={playing}
              onClose={() => setPlaying(null)}
              onHome={() => {
                setPlaying(null);
                setCurrentView('home');
              }}
              channels={liveChannels}
              currentChannelIndex={currentChannelIndex}
              onChannelChange={handleChannelChange}
            />
          ) : (
            <>
              {currentView === 'home' && <Home onPlay={handlePlayLive} />}
              {currentView === 'live' && <LiveTV onPlay={handlePlayLive} />}
              {currentView === 'movies' && <Movies onPlay={handlePlayOther} />}
              {currentView === 'series' && <Series onPlay={handlePlayOther} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
