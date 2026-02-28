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

### Feb 27, 2026 - Session 4 (Current)
**Fullscreen Player UI Tweaks (ONLY GlobalVideoPlayer.tsx changed):**
- Channel up/down buttons: Increased touch target from 60x60 to 76x76px, added hitSlop (20px), bigger icons (32px)
- Bottom bar gradient: Made more transparent (0.45 opacity max)
- EPG "Now/Next" guide in fullscreen bottom bar (already coded in session 3, now with transparent overlay)

### Feb 27, 2026 - Session 3
**P0 Bug Fixes - UI Regressions:**
- Fixed Home screen hero card: Redesigned as large image-based card with LinearGradient overlay, LIVE badge, channel name/category, blue play button
- Fixed Live TV navigation: Added showGuide local state - always shows channel list first, TV guide only after channel selection
- Added "Back to channels" button in TV guide header

**P1 Fixes:**
- Auto-play hero channel muted on Home screen load
- Fixed channel up/down by populating streamList from Home screen
- Home inline player has rounded corners and margins

**New Feature:**
- "Continue Watching" mini-player banner on Home screen

**Multiview Feature (FIXED):**
- Rewrote MultiviewCell to use expo-av Video with imperative loadAsync
- 4 streams play simultaneously
- Tutorial popup, audio selection by tap, channel change by long press

### Previous Sessions
- Global Video Player architecture (GlobalVideoContext + GlobalVideoPlayer singleton)
- Complete Tubi-style player redesign with fullscreen controls
- Backend proxy for Xtream Codes API
- Login, Live TV categories/EPG/search/favorites
- Watch history tracking, favorites sync
- Portrait rotation exits fullscreen, landscape enters fullscreen
- Channel change overlay with fade animation
- LB/raw IP support (usesCleartextTraffic)

## Key Files
- `frontend/src/components/GlobalVideoPlayer.tsx` - Singleton video player with fullscreen UI
- `frontend/app/(tabs)/live.tsx` - Live TV with channel list + TV guide views
- `frontend/app/(tabs)/home.tsx` - Home screen with hero card, auto-play, continue watching banner
- `frontend/app/multiview.tsx` - 4-channel grid view
- `frontend/src/contexts/GlobalVideoContext.tsx` - Player state management
- `frontend/src/contexts/FavoritesContext.tsx` - Favorites management
- `backend/server.py` - FastAPI backend proxy

## Prioritized Backlog

### P0 (Critical - Next)
- Fix Live TV guide scrolling bugs (channel list bounces back to top)
- Fix EPG date pills not scrollable in guide view
- Fix "Back to channels" button in Live TV guide

### P1 (High)
- Channel down button verification in fullscreen
- VOD/Catch-Up category icon alignment
- EPG settings logic implementation

### P2 (Medium)
- Global search feature
- VOD/Series content improvements

### P3 (Low)
- PiP mode
- Offline favorites
- Parental controls
