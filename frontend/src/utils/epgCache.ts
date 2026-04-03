// Shared EPG cache - preloaded on app startup, used by Live TV screen
import { api } from './api';

type EpgEntry = { current: any; next: any; progress: number };
let epgCache: { [key: number]: EpgEntry } = {};
let preloadDone = false;
let preloadInProgress = false;

export function getEpgCache(): { [key: number]: EpgEntry } {
  return epgCache;
}

export function isEpgPreloaded(): boolean {
  return preloadDone;
}

export function mergeEpgData(newData: { [key: number]: EpgEntry }) {
  epgCache = { ...epgCache, ...newData };
}

function parseEpgBatch(batchData: any): { [key: number]: EpgEntry } {
  const epgMap: { [key: number]: EpgEntry } = {};
  const now = Math.floor(Date.now() / 1000);
  const getTs = (e: any, field: 'start' | 'end') => {
    if (field === 'start') return parseInt(e.start_timestamp) || Math.floor(new Date(e.start + ' UTC').getTime() / 1000);
    return parseInt(e.stop_timestamp) || Math.floor(new Date(e.end + ' UTC').getTime() / 1000);
  };
  for (const [sid, data] of Object.entries(batchData) as any) {
    const listings = data?.epg_listings || [];
    if (listings.length > 0) {
      const current = listings.find((e: any) => {
        const start = getTs(e, 'start');
        const end = getTs(e, 'end');
        return now >= start && now <= end;
      });
      const next = listings.find((e: any) => getTs(e, 'start') > now);
      let progress = 0;
      if (current) {
        const start = getTs(current, 'start');
        const end = getTs(current, 'end');
        progress = Math.min(Math.max((now - start) / (end - start), 0), 1);
      }
      epgMap[parseInt(sid)] = { current, next, progress };
    }
  }
  return epgMap;
}

// Preload EPG for ALL channels with guide data - called once at app startup
export async function preloadAllEpg(username: string, password: string) {
  if (preloadInProgress || preloadDone) return;
  preloadInProgress = true;
  try {
    const allStreams = await api.getLiveStreams(username, password);
    if (!Array.isArray(allStreams)) return;
    const withEpg = allStreams.filter((s: any) => s.epg_channel_id);
    const BATCH_SIZE = 30;
    for (let i = 0; i < withEpg.length; i += BATCH_SIZE) {
      const batch = withEpg.slice(i, i + BATCH_SIZE);
      const ids = batch.map((s: any) => s.stream_id);
      try {
        const batchData = await api.getBatchEpg(username, password, ids);
        const parsed = parseEpgBatch(batchData);
        epgCache = { ...epgCache, ...parsed };
      } catch (e) {
        console.error('EPG preload batch error:', e);
      }
    }
    preloadDone = true;
  } catch (e) {
    console.error('EPG preload error:', e);
  } finally {
    preloadInProgress = false;
  }
}
