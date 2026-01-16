import { useState, useEffect } from 'react';
import { useIPTV } from '../contexts/IPTVContext';
import type { Channel } from '../services/xtream';
import type { PlayingContent } from './MainApp';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HomeProps {
  onPlay: (content: PlayingContent, channels: Channel[], channelIndex: number) => void;
}

export function Home({ onPlay }: HomeProps) {
  const { getLiveCategories, getLiveStreams, getLiveStreamUrl } = useIPTV();
  const [featuredChannels, setFeaturedChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    loadFeaturedChannels();
  }, []);

  const loadFeaturedChannels = async () => {
    try {
      const categories = await getLiveCategories();
      if (categories.length > 0) {
        const channels = await getLiveStreams(categories[0].category_id);
        setFeaturedChannels(channels.slice(0, 20));
      }
    } catch (error) {
      console.error('Error loading featured channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (channel: Channel, index: number) => {
    const streamUrl = getLiveStreamUrl(channel);
    console.log('Channel:', channel.name);
    console.log('Stream URL:', streamUrl);
    console.log('Direct Source:', channel.direct_source);
    onPlay({
      type: 'live',
      url: streamUrl,
      title: channel.name,
    }, featuredChannels, index);
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('featured-scroll');
    if (container) {
      const scrollAmount = 400;
      const newPosition = direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : Math.min(container.scrollWidth - container.clientWidth, scrollPosition + scrollAmount);

      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <div className="text-slate-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <div className="relative h-[60vh] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <div className="absolute inset-0">
          <img
            src="/1000006713.png"
            alt="Elite Wave GO"
            className="w-full h-full object-contain opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
        </div>

        <div className="relative h-full flex flex-col items-center justify-center px-8 text-center">
          <img
            src="/1000006713.png"
            alt="Elite Wave GO"
            className="w-64 h-64 object-contain mb-6"
          />
          <h1 className="text-5xl font-bold text-white mb-4">
            Welcome to Elite Wave GO
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl">
            Stream your favorite TV channels, movies, and series in stunning quality
          </p>
        </div>
      </div>

      <div className="px-8 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Featured TV Channels</h2>
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          id="featured-scroll"
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {featuredChannels.map((channel, index) => (
            <div
              key={channel.stream_id}
              onClick={() => handlePlay(channel, index)}
              className="flex-shrink-0 w-40 group cursor-pointer"
            >
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden hover:ring-2 hover:ring-pink-500 hover:shadow-xl hover:shadow-pink-500/20 transition-all">
                <div className="aspect-square bg-slate-900 flex items-center justify-center p-4">
                  {channel.stream_icon ? (
                    <img
                      src={channel.stream_icon}
                      alt={channel.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-slate-600 text-4xl font-bold">
                      {channel.num}
                    </div>
                  )}
                </div>
                <div className="p-3 text-center">
                  <h4 className="text-sm font-medium text-white truncate group-hover:text-pink-400 transition-colors">
                    {channel.name}
                  </h4>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
