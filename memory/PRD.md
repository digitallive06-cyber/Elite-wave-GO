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

### Feb 27, 2026 - Session 2
**Bug Fixes:**
- Fixed transition overlay stuck (was never fading out) - used useRef for state tracking + 3s timeout fallback
- Fixed fullscreen controls not reappearing on touch - replaced TouchableOpacity with TouchableWithoutFeedback + explicit View child
- Fixed player stuck on Home/other tabs - uses usePathname() to only show inline on Live tab; hidden but mounted on other tabs
- Fixed LB stream resolution - backend now tries GET after HEAD (LB only redirects GET with 302)
- Fixed dependency versions for Expo SDK 54 compatibility

**Tubi-Style Player Redesign:**
- Top: back arrow, resize icon, fullscreen exit icon
- Right side: up/down channel arrows + channel logo
- Bottom-left: channel name (bold), program title, LIVE badge (red with lightning icon)
- Bottom icons: favorite star, ratio label (FIT/FILL/STRETCH), multiview grid

### Feb 27, 2026 - Session 1
- Global Video Player architecture (GlobalVideoContext + GlobalVideoPlayer)
- Complete live.tsx rewrite removing all local video logic
- Portrait rotation exits fullscreen
- Channel change overlay with fade animation
- LB/raw IP support (usesCleartextTraffic)
- Splash screen removed, app icon updated
- Backend improved redirect resolution with fallback URLs

### Previous Sessions
- Login, backend proxy, Live TV categories/EPG/search/favorites
- Home, VOD, Series, Catch-Up tab scaffolding
- Watch history tracking

## APK Build History
- Build 311f12ee: SDK 54, all bug fixes + Tubi-style player
- Build 19216709: SDK 54, initial global player + features
- Build bcb45e92: SDK 54, cancelled (pre-features)

## Prioritized Backlog

### P1 (High)
- Multiview screen implementation (4-channel grid)
- Channel up/down navigation (wire the arrows to change channels)
- VOD/Series content screens

### P2 (Medium)
- Settings screen
- Global search
- Catch-up TV
- Channel changing in fullscreen without exiting

### P3 (Low)
- PiP mode
- Offline favorites
- Parental controls
