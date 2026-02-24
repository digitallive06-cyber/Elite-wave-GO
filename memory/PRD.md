# Elite Wave IPTV App - Product Requirements Document

## Overview
Elite Wave is a full-stack IPTV mobile application built with Expo (React Native) and FastAPI. It connects to Xtream Codes API servers to provide live TV, VOD, TV Series, Catch-Up, and EPG content.

## Architecture
- **Frontend**: Expo (React Native) with expo-router file-based navigation
- **Backend**: FastAPI (Python) acting as a proxy to Xtream Codes API
- **Database**: MongoDB for user history and favorites
- **IPTV Server**: Xtream Codes API at `https://elitewavenetwork.xyz:443`

## Features Implemented

### Login Screen
- Elite Wave logo prominently displayed
- Username input field
- Password input with show/hide toggle (hidden by default)
- Form validation (empty fields check)
- Error handling for invalid credentials
- Session persistence with AsyncStorage

### Tab Navigation (5 tabs)
1. **HOME** - Hero player area (last watched channel), recently watched, favorites, Now on TV
2. **LIVE** - Live TV channels with categories, search, EPG info, channel logos
3. **VOD** - Video on demand with categories, search, movie poster grid
4. **SERIES** - TV Series with categories, search, series poster grid
5. **CATCH-UP** - Channels with DVR/catch-up enabled

### Settings
- Dark/Light theme toggle with persistence
- Account information (username, status, expiry, connections)
- App version info
- Logout functionality

### Theme System
- Dark mode (default): Dark navy background with cyan/blue accents
- Light mode: Clean white/gray with blue accents
- Theme persists across sessions via AsyncStorage

### Backend API Endpoints
- `POST /api/auth/login` - Authenticate against Xtream Codes
- `GET /api/live/categories` - Get live TV categories
- `GET /api/live/streams` - Get live streams (with optional category filter)
- `GET /api/vod/categories` - Get VOD categories
- `GET /api/vod/streams` - Get VOD streams
- `GET /api/series/categories` - Get series categories
- `GET /api/series` - Get series list
- `GET /api/series/info/{series_id}` - Get series details
- `GET /api/catchup/streams` - Get catch-up enabled streams
- `GET /api/epg/{stream_id}` - Get EPG data
- `POST /api/user/history` - Save watch history
- `GET /api/user/history` - Get watch history
- `POST /api/user/favorites` - Toggle favorites
- `GET /api/user/favorites` - Get favorites

## Tech Stack
- Expo SDK 54, React Native 0.81, expo-router 6
- FastAPI 0.110, Motor (MongoDB async), httpx
- AsyncStorage for client-side persistence
- Ionicons for iconography

## Next Steps
- Video playback integration (expo-av or react-native-video)
- EPG timeline view
- Stream URL generation and player
- Picture-in-Picture mode
- Favorites management on detail screens
- Series season/episode drill-down UI
