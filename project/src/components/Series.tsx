import { useState, useEffect } from 'react';
import { useIPTV } from '../contexts/IPTVContext';
import type { Category, Series as SeriesType } from '../services/xtream';
import { Search, Star } from 'lucide-react';

interface SeriesProps {
  onPlay: (content: any) => void;
}

export function Series({ onPlay }: SeriesProps) {
  const { getSeriesCategories, getSeries } = useIPTV();
  const [categories, setCategories] = useState<Category[]>([]);
  const [series, setSeries] = useState<SeriesType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await getSeriesCategories();
      setCategories(cats);
      if (cats.length > 0) {
        loadSeries(cats[0].category_id);
        setSelectedCategory(cats[0].category_id);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSeries = async (categoryId: string) => {
    setLoading(true);
    try {
      const seriesList = await getSeries(categoryId);
      setSeries(seriesList);
    } catch (error) {
      console.error('Error loading series:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    loadSeries(categoryId);
    setSearchQuery('');
  };

  const filteredSeries = series.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-64 bg-slate-900 border-r border-slate-800 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">CATEGORIES</h3>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.category_id}
                onClick={() => handleCategoryChange(category.category_id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedCategory === category.category_id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {category.category_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search series..."
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-white">Loading series...</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredSeries.map((s) => (
                <div
                  key={s.series_id}
                  className="group relative bg-slate-800/50 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
                >
                  <div className="aspect-[2/3] bg-slate-900 flex items-center justify-center relative">
                    {s.cover ? (
                      <img
                        src={s.cover}
                        alt={s.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="text-slate-600 text-center p-4">
                        <p className="text-sm">{s.name}</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-sm text-center px-4">Coming Soon</p>
                    </div>
                    {s.rating_5based > 0 && (
                      <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-white">{s.rating_5based}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-medium text-white truncate">{s.name}</h4>
                    {s.genre && (
                      <p className="text-xs text-slate-400 truncate mt-1">{s.genre}</p>
                    )}
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
