export interface XtreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface Channel {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface Movie {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

export interface Series {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface UserInfo {
  username: string;
  password: string;
  message: string;
  auth: number;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: string[];
}

export interface ServerInfo {
  url: string;
  port: string;
  https_port: string;
  server_protocol: string;
  rtmp_port: string;
  timezone: string;
  timestamp_now: number;
  time_now: string;
}

export interface AuthResponse {
  user_info: UserInfo;
  server_info: ServerInfo;
}

export interface EPGProgram {
  id: string;
  epg_id: string;
  title: string;
  lang: string;
  start: string;
  end: string;
  description: string;
  channel_id: string;
  start_timestamp: number;
  stop_timestamp: number;
  now_playing?: number;
  has_archive?: number;
}

class XtreamService {
  private baseUrl: string = '';
  private username: string = '';
  private password: string = '';

  setCredentials(credentials: XtreamCredentials) {
    this.baseUrl = credentials.serverUrl.replace(/\/$/, '');
    this.username = credentials.username;
    this.password = credentials.password;
  }

  private getApiUrl(): string {
    return `${this.baseUrl}/player_api.php`;
  }

  async authenticate(): Promise<AuthResponse> {
    const url = `${this.getApiUrl()}?username=${this.username}&password=${this.password}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Authentication failed');
    }
    const data = await response.json();
    if (data.user_info?.auth === 0) {
      throw new Error('Invalid credentials');
    }
    return data;
  }

  async getLiveCategories(): Promise<Category[]> {
    const url = `${this.getApiUrl()}?username=${this.username}&password=${this.password}&action=get_live_categories`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch live categories');
    }
    return response.json();
  }

  async getMovieCategories(): Promise<Category[]> {
    const url = `${this.getApiUrl()}?username=${this.username}&password=${this.password}&action=get_vod_categories`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch movie categories');
    }
    return response.json();
  }

  async getSeriesCategories(): Promise<Category[]> {
    const url = `${this.getApiUrl()}?username=${this.username}&password=${this.password}&action=get_series_categories`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch series categories');
    }
    return response.json();
  }

  async getLiveStreams(categoryId?: string): Promise<Channel[]> {
    let url = `${this.getApiUrl()}?username=${this.username}&password=${this.password}&action=get_live_streams`;
    if (categoryId) {
      url += `&category_id=${categoryId}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch live streams');
    }
    return response.json();
  }

  async getMovies(categoryId?: string): Promise<Movie[]> {
    let url = `${this.getApiUrl()}?username=${this.username}&password=${this.password}&action=get_vod_streams`;
    if (categoryId) {
      url += `&category_id=${categoryId}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch movies');
    }
    return response.json();
  }

  async getSeries(categoryId?: string): Promise<Series[]> {
    let url = `${this.getApiUrl()}?username=${this.username}&password=${this.password}&action=get_series`;
    if (categoryId) {
      url += `&category_id=${categoryId}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch series');
    }
    return response.json();
  }

  getLiveStreamUrl(channel: Channel): string {
    let streamUrl: string;

    if (channel.direct_source) {
      const directUrl = channel.direct_source.trim();
      if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) {
        streamUrl = directUrl;
      } else {
        streamUrl = `${this.baseUrl}${directUrl.startsWith('/') ? '' : '/'}${directUrl}`;
      }
    } else {
      streamUrl = `${this.baseUrl}/live/${this.username}/${this.password}/${channel.stream_id}.m3u8`;
    }

    // Web browsers need CORS proxy - native apps like TiviMate don't have CORS restrictions
    let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
      supabaseUrl = supabaseUrl.replace(/^http:\/\//i, 'https://');
    }
    const proxyUrl = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}`;

    return proxyUrl;
  }

  getMovieStreamUrl(streamId: number, extension: string): string {
    return `${this.baseUrl}/movie/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  getSeriesStreamUrl(streamId: number, extension: string): string {
    return `${this.baseUrl}/series/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  private decodeBase64(str: string): string {
    try {
      return atob(str);
    } catch (e) {
      return str;
    }
  }

  async getShortEPG(streamId: number, limit: number = 4): Promise<{ epg_listings: EPGProgram[] }> {
    const url = `${this.getApiUrl()}?username=${this.username}&password=${this.password}&action=get_short_epg&stream_id=${streamId}&limit=${limit}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { epg_listings: [] };
      }
      const data = await response.json();

      if (data.epg_listings && Array.isArray(data.epg_listings)) {
        data.epg_listings = data.epg_listings.map((program: EPGProgram) => ({
          ...program,
          title: this.decodeBase64(program.title),
          description: program.description ? this.decodeBase64(program.description) : program.description,
        }));
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch EPG:', error);
      return { epg_listings: [] };
    }
  }

  async getSimpleDataTable(streamId: number): Promise<{ epg_listings: EPGProgram[] }> {
    const url = `${this.getApiUrl()}?username=${this.username}&password=${this.password}&action=get_simple_data_table&stream_id=${streamId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { epg_listings: [] };
      }
      const data = await response.json();

      if (data.epg_listings && Array.isArray(data.epg_listings)) {
        data.epg_listings = data.epg_listings.map((program: EPGProgram) => ({
          ...program,
          title: this.decodeBase64(program.title),
          description: program.description ? this.decodeBase64(program.description) : program.description,
        }));
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch EPG data:', error);
      return { epg_listings: [] };
    }
  }

  getCurrentProgram(epgListings: EPGProgram[]): EPGProgram | null {
    if (!epgListings || epgListings.length === 0) return null;

    const now = Date.now() / 1000;
    const currentProgram = epgListings.find(
      (program) => program.start_timestamp <= now && program.stop_timestamp >= now
    );

    return currentProgram || null;
  }

  getNextProgram(epgListings: EPGProgram[]): EPGProgram | null {
    if (!epgListings || epgListings.length === 0) return null;

    const now = Date.now() / 1000;
    const nextProgram = epgListings.find(
      (program) => program.start_timestamp > now
    );

    return nextProgram || null;
  }

  formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
}

export const xtreamService = new XtreamService();
