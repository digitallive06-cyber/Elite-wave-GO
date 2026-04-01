# Elite Wave IPTV - Product Requirements Document

## Original Problem Statement
Build an IPTV mobile application for Android (APK) using the Xtream Codes API, connecting to DNS `https://elitewavenetwork.xyz:443`.

## Core Requirements
- **API**: Xtream Codes API via backend proxy
- **Content**: Live Channels, VOD, TV Series, Catch-up, EPG with channel logos
- **Sports**: Live scores, game details, player stats via ESPN API (NFL, NBA, MLB, NHL, MLS)
- **Login**: Username/password with Elite Wave logo
- **Multiview**: 2/3/4-channel grid view with layout picker
- **Update System**: Backend version check + user notification + (planned) OTA updates

## Architecture
- **Frontend**: Expo SDK 54 (React Native), file-based routing, v1.1.0
- **Backend**: FastAPI proxy (Xtream Codes + ESPN API) + MongoDB
- **Hosting**: Railway (backend) + EAS Build (APK)
- **Video**: Global singleton Video component at app root

## What's Been Implemented

### Apr 2, 2026 - Session 5
- **Sports Section on Home**: Apple Sports-style design under hero player
  - 5 leagues: NFL, NBA, MLB, NHL, MLS
  - Live game cards with scores, team logos, status
  - "View All" for full game list per league
- **Sports Detail Screen**: Scoreboard, team stats, player stats
- **Sports View All Screen**: Full game list with league tabs
- **Backend ESPN API proxy**: scoreboard + summary endpoints
- **Multiview layout picker**: 2/3/4 screen selection
- **3-screen layout fix**: Explicit nesting layout
- **Live TV scroll bounce fix**: nestedScrollEnabled
- **Network retry logic**: All API calls retry 3x with backoff
- **DNS hidden**: Removed from all API responses
- **Update notification system**: Version check + prompt
- **Login auto-retry**: Retries up to 7 times on network failures
- **Railway deployment**: Dockerfile + requirements-railway.txt

### Previous Sessions
- Global Video Player, Tubi-style fullscreen controls
- Multiview (4 simultaneous streams)
- Home screen hero card, auto-play, continue watching
- Live TV categories/EPG/search/favorites/guide
- Backend proxy for Xtream Codes API
- Login, watch history, favorites sync

## Key Files
- `frontend/src/components/SportsSection.tsx` - Sports widget on Home screen
- `frontend/app/sports-detail.tsx` - Game detail screen
- `frontend/app/sports-all.tsx` - Full game list screen
- `frontend/app/multiview.tsx` - Multiview with layout picker
- `frontend/src/components/GlobalVideoPlayer.tsx` - Video player
- `frontend/src/utils/api.ts` - API layer with retry logic
- `frontend/src/utils/useUpdateChecker.ts` - Update checker
- `backend/server.py` - FastAPI backend
- `Dockerfile` - Railway deployment
- `railway.json` - Railway config

## Prioritized Backlog

### P0 (Next)
- EAS OTA Update setup (silent + forced)
- Test sports section on device

### P1 (High)
- Fullscreen player UI: bigger buttons, EPG overlay
- VOD/Catch-Up category icon alignment

### P2 (Medium)
- Global search feature
- Play Store signing + submission

### P3 (Low)
- PiP mode
- Offline favorites
- Parental controls
