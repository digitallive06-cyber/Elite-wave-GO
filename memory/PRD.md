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
- Fullscreen landscape player with bottom-only controls overlay
- Transparent top bar with back button, channel name, and screen ratio control
- Channel switching with black screen + logo flash animation
- Screen Ratio Control: cycle FIT/FILL/STRETCH modes
- Favorite star button in bottom controls
- Channel up/down arrows for in-category switching
- EPG info (current + next) in bottom overlay with progress bar

### Multiview (NEW)
- 2x2 grid layout in forced landscape mode
- Pre-fills slot 0 with the current channel from player
- Empty slots show "+" icon to add a channel
- Tap "+" → Category picker modal → Channel picker → plays in that slot
- Long-press any slot → opens channel picker to replace it
- Audio routing: only the tapped/active slot produces sound (volume=1, others=0)
- Cyan border + volume icon on active slot, mute icon on inactive slots
- Back button returns to previous screen

### Orientation Handling
- **Home/VOD/Series/Catch-Up tabs**: Locked to portrait (via tabs `_layout.tsx`)
- **Live TV tab**: Unlocks orientation when a channel is playing inline; rotation to landscape triggers fullscreen player
- **Player screen**: Forced landscape with hidden status bar
- **Multiview screen**: Forced landscape

### Favorites System
- Context-based: FavoritesContext with AsyncStorage for device-local persistence
- Backend sync: POST /api/user/favorites (toggle add/remove), GET /api/user/favorites
- Player integration: Star icon in bottom controls bar
- Home screen: Dedicated "Favorites" section with horizontal channel cards
- Live TV screen: Favorites row above channel list when favorites exist

### Live TV Screen
- Inline hero player (16:9) when channel selected
- Favorites section at top of channel list
- Full TV guide below player with EPG data per channel
- Category horizontal scroll filter
- Auto-fullscreen on landscape rotation (ScreenOrientation listener)

### Home Screen
- Hero player (last watched channel)
- Favorites Section with star icon
- Recently Watched Live Channels
- Last Added Movies and Series

### EPG
- Base64 decoded titles/descriptions
- Batch EPG endpoint with rate-limiting protection
- Current + next program display with progress bars

### Login Screen
- Elite Wave logo + username/password with show/hide toggle
- Session persistence with AsyncStorage

### Tab Navigation (5 tabs)
1. HOME - Hero + Favorites + Recent + New Content
2. LIVE - Channels with EPG, categories, search, favorites
3. VOD - Movies with categories, posters
4. SERIES - TV Series with categories
5. CATCH-UP - DVR-enabled channels

## Changelog
- 2025: Initial IPTV app built (login, home, live, vod, series, catchup, player)
- 2026-02: EPG batch endpoint fixed, landscape lock added
- 2026-02: Player UI improvements (transparent top bar, channel switch animation, screen ratio control)
- 2026-02: Favorites system (context + AsyncStorage + backend API + Home & Live screens)
- 2026-02: Removed duplicate top TV guide overlay from fullscreen player
- 2026-02: Portrait lock for all tab screens (home, vod, series, catchup)
- 2026-02: Fixed live screen rotation → now unlocks orientation when channel playing, triggers fullscreen on landscape
- 2026-02: **Multiview feature** - 2x2 grid with 4 simultaneous channels, category/channel picker, audio routing

## Next Steps (P0/P1/P2)

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
