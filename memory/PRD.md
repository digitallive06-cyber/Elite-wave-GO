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
- **Multiview**: 2/3/4-channel grid view with layout picker (accessible from fullscreen controls)
- **Channel Transition**: Show channel icon with 50% transparent background on change
- **Home**: Locked to portrait, player hidden when navigating away from Live tab

## Architecture
- **Frontend**: Expo SDK 54 (React Native) with file-based routing
- **Backend**: FastAPI proxy for Xtream Codes API + MongoDB
- **Video**: Global singleton pattern - single persistent `<Video>` component at app root
- **Build**: EAS Build, Android APK

## What's Been Implemented

### Feb 28, 2026 - Session 5 (Current)
**Multiview Layout Picker (ONLY multiview.tsx changed):**
- Added layout picker screen with visual previews of 2, 3, and 4 screen layouts
- 2-screen: side-by-side (half width each, full height)
- 3-screen: one large left + two stacked right
- 4-screen: 2x2 grid (original behavior)
- Grid icon button (top-right) to switch layouts anytime
- Tutorial popup delayed until after layout selection

### Feb 28, 2026 - Session 4
**Fullscreen Player UI Tweaks (ONLY GlobalVideoPlayer.tsx changed):**
- Channel up/down buttons: Increased touch target from 60x60 to 76x76px, added hitSlop (20px), bigger icons (32px)
- Bottom bar gradient: Made more transparent (0.45 opacity max)
- EPG "Now/Next" guide in fullscreen bottom bar

### Feb 27, 2026 - Session 3
**P0 Bug Fixes - UI Regressions:**
- Fixed Home screen hero card with LinearGradient overlay, LIVE badge
- Fixed Live TV navigation: channel list first, TV guide after selection
- Added "Back to channels" button in TV guide header

**P1 Fixes:**
- Auto-play hero channel muted on Home screen load
- Fixed channel up/down by populating streamList from Home screen

**New Features:**
- "Continue Watching" mini-player banner on Home screen
- Multiview feature fully working (4 streams simultaneous)

### Previous Sessions
- Global Video Player architecture (GlobalVideoContext + GlobalVideoPlayer singleton)
- Complete Tubi-style player redesign with fullscreen controls
- Backend proxy for Xtream Codes API
- Login, Live TV categories/EPG/search/favorites
- Watch history tracking, favorites sync
- Portrait rotation exits fullscreen, landscape enters fullscreen
- Channel change overlay with fade animation

## Key Files
- `frontend/app/multiview.tsx` - Multiview with layout picker (2/3/4 screens)
- `frontend/src/components/GlobalVideoPlayer.tsx` - Singleton video player with fullscreen UI
- `frontend/app/(tabs)/live.tsx` - Live TV with channel list + TV guide views
- `frontend/app/(tabs)/home.tsx` - Home screen with hero card, auto-play
- `frontend/src/contexts/GlobalVideoContext.tsx` - Player state management
- `backend/server.py` - FastAPI backend proxy

## Prioritized Backlog

### P0 (Critical - Next)
- Fix Live TV guide scrolling bugs (channel list bounces back to top)
- Fix EPG date pills not scrollable in guide view
- Fix "Back to channels" button in Live TV guide

### P1 (High)
- VOD/Catch-Up category icon alignment
- EPG settings logic implementation

### P2 (Medium)
- Global search feature
- VOD/Series content improvements

### P3 (Low)
- PiP mode
- Offline favorites
- Parental controls
