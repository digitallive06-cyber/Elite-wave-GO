import { Home, Tv, Film, Monitor } from 'lucide-react';
import type { ViewType } from './MainApp';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const menuItems = [
    { id: 'home' as ViewType, label: 'Home', icon: Home },
    { id: 'live' as ViewType, label: 'Live TV', icon: Tv },
    { id: 'movies' as ViewType, label: 'Movies', icon: Film },
    { id: 'series' as ViewType, label: 'Series', icon: Monitor },
  ];

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <img src="/1000006713.png" alt="Elite Wave GO" className="w-12 h-12 object-contain" />
          <div>
            <h2 className="text-lg font-bold text-white">Elite Wave GO</h2>
            <p className="text-xs text-slate-400">Premium</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/50'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Version 1.0.0</p>
        </div>
      </div>
    </div>
  );
}
