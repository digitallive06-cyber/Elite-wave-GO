# Elite Wave IPTV App - Product Requirements Document

## Overview
Elite Wave is a full-stack IPTV mobile application built with Expo (React Native) and FastAPI. It connects to Xtream Codes API servers to provide live TV, VOD, TV Series, Catch-Up, and EPG content with video playback.

## Architecture
- **Frontend**: Expo (React Native) with expo-router, expo-video for playback
- **Backend**: FastAPI (Python) proxy to Xtream Codes API + stream URL resolver
- **Database**: MongoDB for user history and favorites
- **IPTV Server**: Xtream Codes API at `https://elitewavenetwork.xyz:443`
- **Local Storage**: AsyncStorage for device-local favorites persistence

## Features Implemented

### Video Player (expo-video)
- Uses expo-video with useVideoPlayer and VideoView
- Resolves stream URLs via backend (handles LB redirects)
- Primary: .m3u8 (HLS) format for better LB compatibility
- Fallback: .ts format when m3u8 fails
- Back button, play/pause, LIVE badge, fullscreen, PiP support
- EPG info panel showing current program
- Retry with fallback URL on failure
- Supports live, movie, and series stream types
- **Screen Ratio Control**: Cycle through FIT/FILL/STRETCH modes via top bar button
- **Transparent Top Bar**: Slim, semi-transparent control bar in fullscreen
- **Channel Switch Animation**: Black screen with next channel logo on switch
- **Favorite Star Button**: Toggle favorites directly from player

### Stream URL Resolution
- Backend resolves stream URLs following HTTP redirects for load-balanced streams
- Generates proper Xtream Codes URL format: /live/user/pass/id.m3u8
- Handles both main server and LB transparently

### Login Screen
- Elite Wave logo + username/password with show/hide toggle
- Session persistence with AsyncStorage

### Home Screen
- Hero player (last watched channel with play button)
- **Favorites Section**: Horizontal scroll of favorited channels with star icon
- Recently Watched Live Channels
- Last Added Movies with "See All"
- Last Added Series with "See All"

### Tab Navigation (5 tabs)
1. **HOME** - Hero + Favorites + Recent + New Content
2. **LIVE** - 1831+ channels with EPG, categories, search, favorites section
3. **VOD** - Movies with categories, posters
4. **SERIES** - TV Series with categories
5. **CATCH-UP** - DVR-enabled channels

### EPG
- Base64 decoded titles/descriptions
- Current + next program on live channels
- Batch EPG endpoint (/api/epg/batch) with rate-limiting protection (150ms delays)
- Reliable timestamp parsing using start_timestamp/stop_timestamp (Unix epoch)
- Progress bar showing current program progress in channel list

### Player (Tubi-style)
- Full-screen landscape mode (expo-screen-orientation locks on entry, unlocks on back)
- Channel up/down arrows for in-category switching
- Channel logo flash animation on channel change
- TV guide overlay (3 seconds) on channel switch
- EPG progress bar and current/next program display
- Screen ratio adjustment (contain/cover/fill)

### Live TV Screen
- Inline hero player (16:9, max 240px height) when channel selected
- **Favorites section** at top of channel list (horizontal scroll with star badges)
- Full TV guide below player with EPG data per channel
- Category horizontal scroll filter
- Tap fullscreen button → navigates to player.tsx in landscape
- Auto-fullscreen on landscape rotation (ScreenOrientation listener)

### Favorites System
- **Context-based**: FavoritesContext with AsyncStorage for device-local persistence
- **Backend sync**: POST /api/user/favorites (toggle add/remove), GET /api/user/favorites
- **Player integration**: Star icon in bottom controls bar
- **Home screen**: Dedicated "Favorites" section with horizontal channel cards
- **Live TV screen**: Favorites row above channel list when favorites exist

## Changelog
- 2025: Initial IPTV app built (login, home, live, vod, series, catchup, player)
- 2026-02: EPG batch endpoint fixed (route ordering + timestamp parsing), landscape lock added
- 2026-02: Player UI improvements (transparent top bar, channel switch animation, screen ratio control)
- 2026-02: Favorites system implemented (context + AsyncStorage + backend API + UI on Home & Live screens)
- 2026-02: Fixed missing ScreenOrientation import in live.tsx

## Next Steps (P0/P1/P2)

### P0 - Critical
- (none currently)

### P1 - High Priority
- Series episode drill-down and playback
- VOD detail page with info/description
- Catch-up playback integration

### P2 - Nice to Have
- Full EPG timeline view
- VOD/Series search and filtering
- Settings screen (theme switching)
- Global search feature
- Cross-device favorites sync (backend already supports it)
