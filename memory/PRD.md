# Elite Wave IPTV App - Product Requirements Document

## Overview
Elite Wave is a full-stack IPTV mobile application built with Expo (React Native) and FastAPI. It connects to Xtream Codes API servers to provide live TV, VOD, TV Series, Catch-Up, and EPG content with video playback.

## Architecture
- **Frontend**: Expo (React Native) with expo-router, expo-video for playback
- **Backend**: FastAPI (Python) proxy to Xtream Codes API + stream URL resolver
- **Database**: MongoDB for user history and favorites
- **IPTV Server**: Xtream Codes API at `https://elitewavenetwork.xyz:443`

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

### Stream URL Resolution
- Backend resolves stream URLs following HTTP redirects for load-balanced streams
- Generates proper Xtream Codes URL format: /live/user/pass/id.m3u8
- Handles both main server and LB transparently

### Login Screen
- Elite Wave logo + username/password with show/hide toggle
- Session persistence with AsyncStorage

### Home Screen
- Hero player (last watched channel with play button)
- Recently Watched Live Channels
- Last Added Movies with "See All"
- Last Added Series with "See All"

### Tab Navigation (5 tabs)
1. **HOME** - Hero + Recent + New Content
2. **LIVE** - 1831+ channels with EPG, categories, search → plays in player
3. **VOD** - Movies with categories, posters → plays in player
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

### Live TV Screen
- Inline hero player (16:9, max 240px height) when channel selected
- Full TV guide below player with EPG data per channel
- Category horizontal scroll filter
- Tap fullscreen button → navigates to player.tsx in landscape

## Changelog
- 2025: Initial IPTV app built (login, home, live, vod, series, catchup, player)
- 2026-02: EPG batch endpoint fixed (route ordering + timestamp parsing), landscape lock added

## Next Steps
- Series episode drill-down and playback
- Full EPG timeline view
- Channel favorites on player screen
- Catch-up playback integration
- VOD search and filtering
