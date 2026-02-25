# Elite Wave IPTV App - Product Requirements Document

## Overview
Elite Wave is a full-stack IPTV mobile application built with Expo (React Native) and FastAPI. It connects to Xtream Codes API servers to provide live TV, VOD, TV Series, Catch-Up, and EPG content with video playback.

## Architecture
- **Frontend**: Expo (React Native) with expo-router, expo-av for playback
- **Backend**: FastAPI (Python) proxy to Xtream Codes API + stream URL resolver
- **Database**: MongoDB for user history and favorites
- **IPTV Server**: Xtream Codes API at `https://elitewavenetwork.xyz:443`
- **Local Storage**: AsyncStorage for device-local favorites persistence

## Key Architecture Decision: Inline Fullscreen with expo-av
The live screen's fullscreen player is handled WITHIN `live.tsx` using a **single persistent `<Video />` component from expo-av**. This means:
- **No navigation** to player.tsx for live TV fullscreen
- **Same video component** continues playing — no stream restart, no double audio
- **Style-based fullscreen**: Container style toggles between `previewContainer` and `fullscreenContainer`
- **Bidirectional rotation**: landscape → fullscreen, portrait → exit fullscreen
- **Tab bar hidden/shown** programmatically via `navigation.getParent().setOptions({ tabBarStyle })`
- **player.tsx** is only used when navigating from the Home screen (separate player instance)

## Features Implemented

### Video Player Architecture (Updated Feb 2025)
- **Live TV fullscreen**: Single expo-av `<Video />` component in `live.tsx` with style-based fullscreen toggle
- **Screen ratio control**: FIT/FILL/STRETCH toggle button using `ResizeMode.CONTAIN/COVER/STRETCH`
- **Home screen player**: Separate `player.tsx` screen with its own player instance
- **Multiview**: `multiview.tsx` with 4 independent VideoView instances, audio from active slot only

### Orientation Handling
- **Home/VOD/Series/Catch-Up tabs**: Locked to portrait (tabs `_layout.tsx`)
- **Live TV tab**: Unlocks when channel playing; orientation listener triggers fullscreen on landscape
- **Fullscreen in live**: Locks LANDSCAPE, hides status bar + navigation bar + tab bar
- **Exit fullscreen**: Locks PORTRAIT_UP, restores all bars
- **Player screen (from Home)**: Forces LANDSCAPE on mount, auto-exits on portrait rotation
- **Multiview screen**: Forces LANDSCAPE

### Multiview (2x2 Grid)
- Pre-fills slot 0 with current channel
- Empty slots show "+" to add channels
- Tap "+" → Category picker → Channel picker
- Long-press any slot to change its channel
- Audio from active (tapped) slot only — others muted (volume=0)
- Cyan border + volume icon on active slot

### Favorites System
- FavoritesContext with AsyncStorage (device-local)
- Star icon in fullscreen controls + Home/Live screen sections
- Backend API for potential cross-device sync

### EPG
- Batch EPG endpoint with rate-limiting protection
- Current + next program with progress bars
- Full channel EPG guide below inline player

### Player Controls (Fullscreen)
- Top bar: back button, channel name, FIT/FILL/STRETCH toggle button
- Bottom: play/pause, multiview grid button
- EPG info: program title display
- Android back button exits fullscreen

## Changelog
- 2025: Initial IPTV app (login, home, live, vod, series, catchup, player)
- 2025-02: EPG batch endpoint, landscape lock, player UI improvements
- 2025-02: Favorites system (context + AsyncStorage + backend API + UI)
- 2025-02: Removed duplicate top TV guide overlay from player
- 2025-02: Portrait lock for all tab screens
- 2025-02: **Major refactor**: Fullscreen in live screen now handled INLINE (same player, no navigation)
- 2025-02: Bidirectional orientation listener (landscape→fullscreen, portrait→exit)
- 2025-02: Multiview with audio routing (pause previous player before entering)
- 2025-02: Android BackHandler for fullscreen exit
- **2025-02-25**: **CRITICAL FIX** - Migrated from expo-video to expo-av for reliable fullscreen
  - Single persistent `<Video />` component with style-based fullscreen toggle
  - Added useWindowDimensions for dynamic fullscreen dimensions
  - Added tab bar hide/show via navigation.getParent().setOptions()
  - Added screen ratio control (FIT/FILL/STRETCH) with toggle button

## Next Steps

### P1 - High Priority
- Test fullscreen on physical Android device to verify seamless behavior
- Series episode drill-down and playback
- VOD detail page with info/description

### P2 - Nice to Have
- Catch-up playback integration
- Full EPG timeline view
- VOD/Series search and filtering
- Settings screen (theme switching)
- Global search feature
- Cross-device favorites sync
