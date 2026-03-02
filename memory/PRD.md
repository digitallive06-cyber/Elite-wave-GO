# Elite Wave IPTV - Product Requirements Document

## Original Problem Statement
Build an IPTV mobile application for Android (APK) using the Xtream Codes API, connecting to DNS `https://elitewavenetwork.xyz:443`.

## Core Requirements
- **API**: Xtream Codes API via backend proxy
- **Content**: Live Channels, VOD, TV Series, Catch-up, EPG with channel logos
- **Login**: Username/password with Elite Wave logo
- **Favorites**: Mark channels, dedicated sections
- **Live TV**: Inline hero preview, seamless fullscreen, portrait exits fullscreen
- **Player**: Tubi-style UI with gradient overlays, channel up/down arrows, LIVE badge
- **Screen Ratio**: FIT/FILL/STRETCH toggle
- **Multiview**: 2/3/4-channel grid view with layout picker
- **Home**: Locked to portrait, player hidden when navigating away
- **Update System**: Backend-driven version check + user notification

## Architecture
- **Frontend**: Expo SDK 54 (React Native), file-based routing, v1.1.0
- **Backend**: FastAPI proxy for Xtream Codes API + MongoDB
- **Video**: Global singleton pattern - single persistent Video component at app root
- **Build**: EAS Build, Android APK (preview + production profiles)

## What's Been Implemented

### Mar 2, 2026 - Session 5 (Current)
- **Multiview layout picker**: 2, 3, or 4 screen layout selection with visual previews
- **3-screen layout fix**: Explicit nesting (large left + 2 stacked right)
- **Live TV scroll bounce fix**: nestedScrollEnabled on horizontal FlatLists in guide
- **Network retry logic**: All API calls retry 3x with backoff on failures
- **DNS hidden**: Removed from health endpoint, only in backend/.env
- **Update notification system**: 
  - Backend: GET/POST /api/app/version endpoints
  - Frontend: useUpdateChecker hook checks on startup, shows alert with Play Store + APK download options
- **App version bumped to 1.1.0**

### Previous Sessions
- Global Video Player architecture (singleton pattern)
- Tubi-style fullscreen player with controls
- Multiview feature (4 simultaneous streams using imperative loadAsync)
- Home screen hero card, auto-play, continue watching
- Live TV categories/EPG/search/favorites/guide
- Backend proxy for all Xtream Codes API endpoints
- Login, watch history, favorites sync
- Orientation handling (portrait/landscape)
- Channel change overlay with fade animation

## Key Files
- `frontend/app/multiview.tsx` - Multiview with layout picker (2/3/4 screens)
- `frontend/src/components/GlobalVideoPlayer.tsx` - Singleton video player
- `frontend/app/(tabs)/live.tsx` - Live TV with guide view
- `frontend/app/(tabs)/home.tsx` - Home screen + update checker
- `frontend/src/utils/api.ts` - API layer with retry logic
- `frontend/src/utils/useUpdateChecker.ts` - Update notification hook
- `backend/server.py` - FastAPI backend + version endpoints

## How to Push Updates to Users
```bash
curl -X POST "BACKEND_URL/api/app/version?version=1.2.0&update_url=https://yourserver.com/app.apk&play_store_url=https://play.google.com/store/apps/details?id=com.elitewave.iptv&force_update=false&message=New features available!"
```

## Prioritized Backlog

### P1 (High)
- Fullscreen player UI: bigger channel buttons, transparent EPG overlay
- VOD/Catch-Up category icon alignment
- EPG settings logic implementation

### P2 (Medium)
- EAS OTA silent updates for JS-only changes
- Global search feature
- Play Store signing + submission

### P3 (Low)
- PiP mode
- Offline favorites
- Parental controls
