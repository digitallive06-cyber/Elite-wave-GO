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
- Error handling for invalid credentials (401 responses)
- Session persistence with AsyncStorage (localStorage fallback on web)

### Home Screen (Redesigned)
- Hero player area showing last watched channel with play button
- Recently Watched Live Channels - horizontal scroll of channel cards with logos
- Last Added Movies with "See All >" button - horizontal scroll of movie posters
- Last Added Series with "See All >" button - horizontal scroll of series posters

### Tab Navigation (5 tabs)
1. **HOME** - Hero player + Recently Watched + Last Added Movies + Last Added Series
2. **LIVE** - 1831+ channels with categories, search, decoded EPG (current + next)
3. **VOD** - Movies with categories, search, poster grid
4. **SERIES** - TV Series with categories, search, series grid
5. **CATCH-UP** - DVR/catch-up enabled channels

### EPG (Electronic Program Guide)
- Base64 decoded titles and descriptions from Xtream Codes API
- Shows current program with green indicator on Live TV channels
- Shows next upcoming program in italics
- Time ranges displayed

### Settings
- Dark/Light theme toggle with persistence
- Account information display
- Logout functionality

### Bottom Tab Bar
- Uses SafeAreaInsets to avoid phone nav bar overlap
- Adaptive bottom padding based on device
- Edge-to-edge Android support with transparent navigation bar

## Next Steps
- Video playback integration (streaming)
- EPG timeline view with full schedule
- Picture-in-Picture mode
- Series season/episode drill-down UI
