# Elite Wave IPTV - Product Requirements Document

## Original Problem Statement
Build an IPTV mobile application for Android (APK) using the Xtream Codes API, connecting to DNS `https://elitewavenetwork.xyz:443`.

## Core Requirements
- **API**: Xtream Codes API via backend proxy
- **Content**: Live Channels, VOD, TV Series, Catch-up, EPG with channel logos
- **Login**: Username/password with Elite Wave logo
- **Multiview**: 2/3/4-channel grid view with layout picker
- **Update System**: Backend version check + user notification

## Architecture
- **Frontend**: Expo SDK 54 (React Native), file-based routing
- **Backend**: FastAPI proxy (Xtream Codes) + MongoDB
- **Hosting**: Railway (backend) + EAS Build (APK)
- **Video**: Global singleton Video component at app root

## What's Been Implemented

### Previous Sessions (Stable)
- Global Video Player, Tubi-style fullscreen controls, EPG overlay
- Multiview (2/3/4 simultaneous streams with layout picker)
- Home screen hero card, auto-play, continue watching
- Live TV categories/EPG/search/favorites/guide
- Backend proxy for Xtream Codes API
- Login, watch history, favorites sync
- Network retry logic (all API calls retry 3x with backoff)
- Login auto-retry (up to 7 times on network failures)
- Live TV scroll bounce fix (nestedScrollEnabled)
- In-app OTA update checker
- Railway deployment config (Dockerfile + requirements)

### Apr 2, 2026 - Session 6
- **Sports Section REMOVED**: User requested reverting all ESPN/sports code after it caused regressions
  - Removed ESPN API proxy endpoints from backend
  - Removed SportsSection component, sports-detail, sports-all screens
  - Removed sports API methods from api.ts

## Key Files
- `frontend/app/(tabs)/home.tsx` - Home screen with hero player
- `frontend/app/(tabs)/live.tsx` - Live TV with categories/guide
- `frontend/app/multiview.tsx` - Multiview with layout picker
- `frontend/src/components/GlobalVideoPlayer.tsx` - Video player
- `frontend/src/utils/api.ts` - API layer with retry logic
- `frontend/src/utils/useUpdateChecker.ts` - Update checker
- `backend/server.py` - FastAPI backend

## Prioritized Backlog

### P0 (Next)
- Build APK and verify app works (hero player, channels, VOD)
- Test fullscreen player channel up/down, EPG overlay

### P1 (High)
- Live TV guide scrolling issues (channels bounce back, date strip)
- "Back to channels" button in Live TV guide
- VOD/Catch-Up category icon alignment

### P2 (Medium)
- EPG settings logic implementation
- Global search feature
- Railway production deployment

### P3 (Low)
- PiP mode
- Offline favorites
- Parental controls
- Sports section (re-add when stable)
