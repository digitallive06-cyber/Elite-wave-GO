import { createContext, useContext, useState, useEffect } from 'react';
import { xtreamService, Category, Channel, Movie, Series, AuthResponse, EPGProgram } from '../services/xtream';

interface Profile {
  id: string;
  server_url: string;
  username: string;
  password: string;
  profile_name: string;
}

interface IPTVContextType {
  profile: Profile | null;
  profiles: Profile[];
  xtreamAuth: AuthResponse | null;
  loading: boolean;
  saveProfile: (profileData: Omit<Profile, 'id'>) => Promise<void>;
  loadProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => void;
  disconnectProfile: () => void;
  getLiveCategories: () => Promise<Category[]>;
  getMovieCategories: () => Promise<Category[]>;
  getSeriesCategories: () => Promise<Category[]>;
  getLiveStreams: (categoryId?: string) => Promise<Channel[]>;
  getMovies: (categoryId?: string) => Promise<Movie[]>;
  getSeries: (categoryId?: string) => Promise<Series[]>;
  getLiveStreamUrl: (channel: Channel) => string;
  getMovieStreamUrl: (streamId: number, extension: string) => string;
  getShortEPG: (streamId: number, limit?: number) => Promise<{ epg_listings: EPGProgram[] }>;
  getCurrentProgram: (epgListings: EPGProgram[]) => EPGProgram | null;
  formatTime: (timestamp: number) => string;
}

const IPTVContext = createContext<IPTVContextType | undefined>(undefined);

const STORAGE_KEY = 'iptv_profiles';

export function IPTVProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [xtreamAuth, setXtreamAuth] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setProfiles(data);
      } catch (error) {
        console.error('Error loading profiles:', error);
      }
    }
  }, []);

  const saveProfilesToStorage = (updatedProfiles: Profile[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfiles));
    setProfiles(updatedProfiles);
  };

  const saveProfile = async (profileData: Omit<Profile, 'id'>) => {
    setLoading(true);
    try {
      xtreamService.setCredentials({
        serverUrl: profileData.server_url,
        username: profileData.username,
        password: profileData.password,
      });

      const auth = await xtreamService.authenticate();

      const newProfile: Profile = {
        id: Date.now().toString(),
        ...profileData,
      };

      const updatedProfiles = [...profiles, newProfile];
      saveProfilesToStorage(updatedProfiles);

      setProfile(newProfile);
      setXtreamAuth(auth);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (profileId: string) => {
    setLoading(true);
    try {
      const found = profiles.find(p => p.id === profileId);
      if (!found) throw new Error('Profile not found');

      xtreamService.setCredentials({
        serverUrl: found.server_url,
        username: found.username,
        password: found.password,
      });

      const auth = await xtreamService.authenticate();

      setProfile(found);
      setXtreamAuth(auth);
    } finally {
      setLoading(false);
    }
  };

  const deleteProfile = (profileId: string) => {
    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    saveProfilesToStorage(updatedProfiles);

    if (profile?.id === profileId) {
      setProfile(null);
      setXtreamAuth(null);
    }
  };

  const disconnectProfile = () => {
    setProfile(null);
    setXtreamAuth(null);
  };

  const getLiveCategories = () => xtreamService.getLiveCategories();
  const getMovieCategories = () => xtreamService.getMovieCategories();
  const getSeriesCategories = () => xtreamService.getSeriesCategories();
  const getLiveStreams = (categoryId?: string) => xtreamService.getLiveStreams(categoryId);
  const getMovies = (categoryId?: string) => xtreamService.getMovies(categoryId);
  const getSeries = (categoryId?: string) => xtreamService.getSeries(categoryId);
  const getLiveStreamUrl = (channel: Channel) => xtreamService.getLiveStreamUrl(channel);
  const getMovieStreamUrl = (streamId: number, extension: string) =>
    xtreamService.getMovieStreamUrl(streamId, extension);
  const getShortEPG = (streamId: number, limit?: number) => xtreamService.getShortEPG(streamId, limit);
  const getCurrentProgram = (epgListings: EPGProgram[]) => xtreamService.getCurrentProgram(epgListings);
  const formatTime = (timestamp: number) => xtreamService.formatTime(timestamp);

  return (
    <IPTVContext.Provider
      value={{
        profile,
        profiles,
        xtreamAuth,
        loading,
        saveProfile,
        loadProfile,
        deleteProfile,
        disconnectProfile,
        getLiveCategories,
        getMovieCategories,
        getSeriesCategories,
        getLiveStreams,
        getMovies,
        getSeries,
        getLiveStreamUrl,
        getMovieStreamUrl,
        getShortEPG,
        getCurrentProgram,
        formatTime,
      }}
    >
      {children}
    </IPTVContext.Provider>
  );
}

export function useIPTV() {
  const context = useContext(IPTVContext);
  if (context === undefined) {
    throw new Error('useIPTV must be used within an IPTVProvider');
  }
  return context;
}
