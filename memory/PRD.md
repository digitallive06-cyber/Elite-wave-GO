# Elite Wave IPTV - Product Requirements Document

## Original Problem Statement
Build an IPTV mobile application for Android (APK) using the Xtream Codes API, connecting to DNS `https://elitewavenetwork.xyz:443`.

## Core Requirements
- **API**: Xtream Codes API via backend proxy
- **Content**: Live Channels, VOD, TV Series, Catch-up, EPG with channel logos
- **Login**: Username/password with Elite Wave logo, NO splash screen
- **Favorites**: Mark channels, dedicated sections
- **Live TV**: Inline hero preview, seamless fullscreen on landscape rotation, portrait rotation exits fullscreen
- **Player**: Tubi-style UI with gradient overlays, large center controls, channel up/down arrows, LIVE badge
- **Screen Ratio**: FIT/FILL/STRETCH toggle
- **Multiview**: 4-channel grid view (accessible from fullscreen controls)
- **Channel Transition**: Show channel icon with 50% transparent background on change
- **Home**: Locked to portrait, player hidden when navigating away from Live tab

## Architecture
- **Frontend**: Expo SDK 54 (React Native) with file-based routing
- **Backend**: FastAPI proxy for Xtream Codes API + MongoDB
- **Video**: Global singleton pattern - single persistent `<Video>` component at app root
- **Build**: EAS Build, Android APK

## What's Been Implemented

### Feb 27, 2026 - Session 3 (Current)
**P0 Bug Fixes - UI Regressions:**
- Fixed Home screen hero card: Redesigned as large image-based card with `LinearGradient` overlay, LIVE badge, channel name/category, blue play button
- Fixed Live TV navigation: Added `showGuide` local state - always shows channel list first, TV guide only after channel selection
- Added "Back to channels" button in TV guide header

**P1 Fixes:**
- Auto-play hero channel muted on Home screen load
- Fixed channel up/down by populating `streamList` from Home screen
- Home inline player has rounded corners and margins (`homeInlineContainer` style)

**New Feature:**
- "Continue Watching" mini-player banner on Home screen - floating bar showing last watched channel with resume button

### Previous Sessions
- Global Video Player architecture (GlobalVideoContext + GlobalVideoPlayer singleton)
- Complete Tubi-style player redesign with fullscreen controls
- Backend proxy for Xtream Codes API
- Login, Live TV categories/EPG/search/favorites
- Watch history tracking, favorites sync
- Portrait rotation exits fullscreen, landscape enters fullscreen
- Channel change overlay with fade animation
- LB/raw IP support (usesCleartextTraffic)

## APK Build History
- Build 8ccb5220 (Feb 27 Session 3): All regression fixes + continue watching banner
- Build 311f12ee: SDK 54, bug fixes + Tubi-style player
- Build 19216709: SDK 54, initial global player + features

## Key Files
- `frontend/app/(tabs)/home.tsx` - Home screen with hero card, auto-play, continue watching banner
- `frontend/app/(tabs)/live.tsx` - Live TV with channel list + TV guide views
- `frontend/src/components/GlobalVideoPlayer.tsx` - Singleton video player
- `frontend/src/contexts/GlobalVideoContext.tsx` - Player state management
- `frontend/src/contexts/FavoritesContext.tsx` - Favorites management
- `backend/server.py` - FastAPI backend proxy

## Prioritized Backlog

### P1 (High)
- Multiview screen implementation (4-channel grid)
- VOD/Series content screens
- Load Balancer stream playback verification

### P2 (Medium)
- Settings screen
- Global search
- Catch-up TV
- EPG data display improvements ("what's on now/next")

### P3 (Low)
- PiP mode
- Offline favorites
- Parental controls
