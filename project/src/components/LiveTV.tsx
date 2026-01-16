import { useState, useEffect } from 'react';
import { useIPTV } from '../contexts/IPTVContext';
import type { Category, Channel, EPGProgram } from '../services/xtream';
import type { PlayingContent } from './MainApp';
import { Search, Clock } from 'lucide-react';

interface LiveTVProps {
  onPlay: (content: PlayingContent, channels: Channel[], channelIndex: number) => void;
}

export function LiveTV({ onPlay }: LiveTVProps) {
  const { getLiveCategories, getLiveStreams, getLiveStreamUrl, getShortEPG, getCurrentProgram, formatTime } = useIPTV();
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [epgData, setEpgData] = useState<Record<number, EPGProgram | null>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const cats = await getLiveCategories();
      setCategories(cats);

      if (cats.length > 0) {
        const firstCategoryChannels = await getLiveStreams(cats[0].category_id);
        setChannels(firstCategoryChannels);
        setAllChannels(firstCategoryChannels);
        loadEPGForChannels(firstCategoryChannels.slice(0, 20));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async (categoryId: string) => {
    setLoading(true);
    try {
      const streams = await getLiveStreams(categoryId);
      setChannels(streams);
      setAllChannels(streams);
      loadEPGForChannels(streams.slice(0, 20));
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEPGForChannels = async (channelsList: Channel[]) => {
    const epgPromises = channelsList.map(async (channel) => {
      try {
        const epg = await getShortEPG(channel.stream_id, 2);
        const currentProgram = getCurrentProgram(epg.epg_listings);
        return { streamId: channel.stream_id, program: currentProgram };
      } catch (error) {
        return { streamId: channel.stream_id, program: null };
      }
    });

    const results = await Promise.all(epgPromises);
    const newEpgData: Record<number, EPGProgram | null> = {};
    results.forEach(({ streamId, program }) => {
      newEpgData[streamId] = program;
    });
    setEpgData(prev => ({ ...prev, ...newEpgData }));
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    if (categoryId === 'all') {
      setChannels(allChannels);
    } else {
      loadChannels(categoryId);
    }
    setSearchQuery('');
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
    }, channels, index);
  };

  const filteredChannels = searchQuery
    ? channels.filter((channel) =>
        channel.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : channels;

  const featuredChannels = channels.slice(0, 6);

  if (loading && channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950">
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
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="bg-slate-800/50 hover:bg-slate-700/50 text-white p-2.5 rounded-lg transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {showSearch && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels..."
              className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              autoFocus
            />
          )}

          <div className="flex items-center gap-2 ml-auto text-slate-400">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <h2 className="text-xl font-bold text-white mb-4">Featured TV Channels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
          {featuredChannels.map((channel, index) => (
            <div
              key={channel.stream_id}
              onClick={() => handlePlay(channel, index)}
              className="group bg-slate-800/30 backdrop-blur-sm rounded-xl overflow-hidden hover:bg-slate-800/50 hover:ring-2 hover:ring-pink-500 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 p-3">
                {channel.stream_icon ? (
                  <img
                    src={channel.stream_icon}
                    alt={channel.name}
                    className="w-12 h-12 object-contain rounded bg-slate-900/50 p-1"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 bg-slate-900/50 rounded flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-400">{channel.num}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate group-hover:text-pink-400 transition-colors">
                    {channel.name}
                  </p>
                  {epgData[channel.stream_id] ? (
                    <>
                      <p className="text-xs text-slate-500 truncate">{epgData[channel.stream_id]!.title}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {formatTime(epgData[channel.stream_id]!.start_timestamp)} - {formatTime(epgData[channel.stream_id]!.stop_timestamp)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 truncate">Live TV</p>
                      <p className="text-xs text-slate-400 truncate">Loading guide...</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/30'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.category_id}
              onClick={() => handleCategoryChange(category.category_id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedCategory === category.category_id
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              {category.category_name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <div className="text-slate-400">Loading channels...</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredChannels.map((channel, index) => (
              <div
                key={channel.stream_id}
                onClick={() => handlePlay(channel, index)}
                className="group bg-slate-800/30 backdrop-blur-sm rounded-xl overflow-hidden hover:ring-2 hover:ring-pink-500 hover:shadow-xl hover:shadow-pink-500/20 transition-all cursor-pointer"
              >
                <div className="aspect-square bg-slate-900/50 flex items-center justify-center p-4">
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
                <div className="p-3">
                  <h4 className="text-sm font-semibold text-white truncate group-hover:text-pink-400 transition-colors">
                    {channel.name}
                  </h4>
                  {epgData[channel.stream_id] ? (
                    <>
                      <p className="text-xs text-slate-500 truncate">{epgData[channel.stream_id]!.title}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {formatTime(epgData[channel.stream_id]!.start_timestamp)} - {formatTime(epgData[channel.stream_id]!.stop_timestamp)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 truncate">Live TV</p>
                      <p className="text-xs text-slate-400 truncate">No guide info</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
