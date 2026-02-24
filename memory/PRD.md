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

### Settings
- Dark/Light theme toggle
- Account info, logout

## Next Steps
- Series episode drill-down and playback
- Full EPG timeline view
- Channel favorites on player screen
- Catch-up playback integration
