# Elite Wave IPTV - Product Requirements Document

## Original Problem Statement
Build an IPTV mobile application for Android (APK) using the Xtream Codes API, connecting to DNS `https://elitewavenetwork.xyz:443`.

## Core Requirements
- **API**: Xtream Codes API via backend proxy
- **Content**: Live Channels, VOD, TV Series, Catch-up, EPG with channel logos
- **Login**: Username/password with Elite Wave logo
- **Favorites**: Mark channels, dedicated sections
- **Live TV**: Inline hero preview → seamless fullscreen on rotation
- **Player**: Screen ratio adjustments (FIT/FILL/STRETCH), Tubi-style UI
- **Multiview**: 4-channel grid view
- **Home**: Locked to portrait

## Architecture
- **Frontend**: Expo (React Native) with file-based routing
- **Backend**: FastAPI proxy for Xtream Codes API + MongoDB
- **Video**: Global singleton pattern - single persistent `<Video>` component at app root via `GlobalVideoContext` + `GlobalVideoPlayer`
- **Build**: EAS Build targeting Expo SDK 54, Android APK

## What's Been Implemented
### Feb 27, 2026
- **Global Video Player Architecture** (COMPLETE)
  - `GlobalVideoContext.tsx`: Full state management (streamUrl, fallbackUrl, channelName, channelIcon, programTitle, streamId, categoryId, isFullscreen, isPlaying, resizeModeIdx, isTransitioning)
  - `GlobalVideoPlayer.tsx`: Single persistent Video component with Tubi-style UI, gradient overlays, channel transition overlay, inline + fullscreen modes
  - `_layout.tsx`: Root layout positions player above Stack, hides navigation during fullscreen
  - `live.tsx`: Complete rewrite - no local video, uses global context
- **Portrait Rotation Exit** - Unlocks orientation after entering fullscreen so rotating to portrait exits fullscreen
- **Tubi-Style Player UI** - Gradient overlays, large center play/pause, LIVE badge, multiview/resize/fav/exit controls
- **Channel Change Overlay** - Shows channel icon + name with 50% transparent background during transitions
- **LB Stream Support** - `expo-build-properties` with `usesCleartextTraffic: true`, improved backend redirect resolution, fallback URL system
- **Splash Screen Removed** - Direct to login page
- **App Icon** - Uses Elite Wave logo
- **EAS Build** - APK built and downloadable

### Previous Sessions
- Login screen with Elite Wave logo
- Backend proxy for Xtream Codes API
- Live TV with categories, EPG, search, favorites
- Home, VOD, Series, Catch-Up tab scaffolding
- Watch history tracking

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High)
- Multiview screen implementation (4-channel grid)
- VOD/Series content screens (flesh out)
- Test LB stream playback on device

### P2 (Medium)
- Settings screen
- Global search feature
- Catch-up TV functionality
- Channel changing in fullscreen without exiting

### P3 (Low)
- Offline favorites caching
- Picture-in-picture mode
- Parental controls
