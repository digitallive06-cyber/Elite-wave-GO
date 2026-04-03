const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://elite-wave-go-production.up.railway.app';

// Retry wrapper for fetch - retries up to 3 times on network failures
async function fetchWithRetry(url: string, options?: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error('Network request failed');
}

export const api = {
  login: async (username: string, password: string) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  getLiveCategories: async (username: string, password: string) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/live/categories?username=${username}&password=${password}`);
    if (!res.ok) throw new Error('Failed to load live categories');
    return res.json();
  },

  getLiveStreams: async (username: string, password: string, categoryId?: string) => {
    let url = `${BACKEND_URL}/api/live/streams?username=${username}&password=${password}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error('Failed to load live streams');
    return res.json();
  },

  getVodCategories: async (username: string, password: string) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/vod/categories?username=${username}&password=${password}`);
    if (!res.ok) throw new Error('Failed to load VOD categories');
    return res.json();
  },

  getVodStreams: async (username: string, password: string, categoryId?: string) => {
    let url = `${BACKEND_URL}/api/vod/streams?username=${username}&password=${password}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error('Failed to load VOD streams');
    return res.json();
  },

  getSeriesCategories: async (username: string, password: string) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/series/categories?username=${username}&password=${password}`);
    if (!res.ok) throw new Error('Failed to load series categories');
    return res.json();
  },

  getSeries: async (username: string, password: string, categoryId?: string) => {
    let url = `${BACKEND_URL}/api/series?username=${username}&password=${password}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error('Failed to load series');
    return res.json();
  },

  getSeriesInfo: async (username: string, password: string, seriesId: number) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/series/info/${seriesId}?username=${username}&password=${password}`);
    if (!res.ok) throw new Error('Failed to load series info');
    return res.json();
  },

  getCatchupCategories: async (username: string, password: string) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/catchup/categories?username=${username}&password=${password}`);
    if (!res.ok) throw new Error('Failed to load catchup categories');
    return res.json();
  },

  getCatchupStreams: async (username: string, password: string, categoryId?: string) => {
    let url = `${BACKEND_URL}/api/catchup/streams?username=${username}&password=${password}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error('Failed to load catchup streams');
    return res.json();
  },

  getRecentVod: async (username: string, password: string, limit: number = 20) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/vod/recent?username=${username}&password=${password}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to load recent movies');
    return res.json();
  },

  getRecentSeries: async (username: string, password: string, limit: number = 20) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/series/recent?username=${username}&password=${password}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to load recent series');
    return res.json();
  },

  getBatchEpg: async (username: string, password: string, streamIds: number[]) => {
    const ids = streamIds.join(',');
    const res = await fetchWithRetry(`${BACKEND_URL}/api/epg/batch?username=${username}&password=${password}&stream_ids=${ids}`);
    if (!res.ok) return {};
    return res.json();
  },

  getEpg: async (username: string, password: string, streamId: number) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/epg/${streamId}?username=${username}&password=${password}`);
    if (!res.ok) throw new Error('Failed to load EPG');
    return res.json();
  },

  getFullEpg: async (username: string, password: string, streamId: number) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/epg/full/${streamId}?username=${username}&password=${password}`);
    if (!res.ok) return { epg_listings: [] };
    return res.json();
  },

  getStreamUrl: async (username: string, password: string, streamId: number, streamType: string = 'live', containerExtension: string = 'ts') => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/stream/url?username=${username}&password=${password}&stream_id=${streamId}&stream_type=${streamType}&container_extension=${containerExtension}`);
    if (!res.ok) throw new Error('Failed to get stream URL');
    return res.json();
  },

  addHistory: async (item: any) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/user/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.json();
  },

  getHistory: async (username: string) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/user/history?username=${username}`);
    if (!res.ok) throw new Error('Failed to load history');
    return res.json();
  },

  clearHistory: async (username: string) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/user/history?username=${username}`, { method: 'DELETE' });
    return res.json();
  },

  toggleFavorite: async (item: any) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/user/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.json();
  },

  getFavorites: async (username: string) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/user/favorites?username=${username}`);
    if (!res.ok) throw new Error('Failed to load favorites');
    return res.json();
  },
};
