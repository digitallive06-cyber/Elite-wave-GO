import { useState, useEffect } from 'react';
import { useIPTV } from '../contexts/IPTVContext';
import type { Category, Movie } from '../services/xtream';
import type { PlayingContent } from './MainApp';
import { Search, Play, Star } from 'lucide-react';

interface MoviesProps {
  onPlay: (content: PlayingContent) => void;
}

export function Movies({ onPlay }: MoviesProps) {
  const { getMovieCategories, getMovies, getMovieStreamUrl } = useIPTV();
  const [categories, setCategories] = useState<Category[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await getMovieCategories();
      setCategories(cats);
      if (cats.length > 0) {
        loadMovies(cats[0].category_id);
        setSelectedCategory(cats[0].category_id);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMovies = async (categoryId: string) => {
    setLoading(true);
    try {
      const movieList = await getMovies(categoryId);
      setMovies(movieList);
    } catch (error) {
      console.error('Error loading movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    loadMovies(categoryId);
    setSearchQuery('');
  };

  const handlePlay = (movie: Movie) => {
    onPlay({
      type: 'movie',
      url: getMovieStreamUrl(movie.stream_id, movie.container_extension),
      title: movie.name,
    });
  };

  const filteredMovies = movies.filter((movie) =>
    movie.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-950">
      <div className="w-64 bg-slate-900/50 border-r border-slate-800 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Categories</h3>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.category_id}
                onClick={() => handleCategoryChange(category.category_id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all font-medium ${
                  selectedCategory === category.category_id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {category.category_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b border-slate-800/50">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies..."
              className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <div className="text-slate-400">Loading movies...</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              {filteredMovies.map((movie) => (
                <div
                  key={movie.stream_id}
                  className="group relative bg-slate-900/50 backdrop-blur-sm rounded-xl overflow-hidden hover:ring-2 hover:ring-blue-500 hover:shadow-xl hover:shadow-blue-500/20 transition-all cursor-pointer"
                  onClick={() => handlePlay(movie)}
                >
                  <div className="aspect-[2/3] bg-slate-800 flex items-center justify-center relative overflow-hidden">
                    {movie.stream_icon ? (
                      <img
                        src={movie.stream_icon}
                        alt={movie.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="text-slate-600">
                        <Play className="w-10 h-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/0 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-blue-600 p-3 rounded-full transform scale-0 group-hover:scale-100 transition-transform">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    {movie.rating_5based > 0 && (
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-white font-semibold">{movie.rating_5based}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                      {movie.name}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
