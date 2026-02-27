import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { FavoritesProvider } from '../src/contexts/FavoritesContext';
import { GlobalVideoProvider, useGlobalVideo } from '../src/contexts/GlobalVideoContext';
import { GlobalVideoPlayer } from '../src/components/GlobalVideoPlayer';

function RootLayoutInner() {
  const { mode } = useTheme();
  const { state } = useGlobalVideo();

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} hidden={state.isFullscreen} />
      {/* Global video player: inline preview above tabs, or fullscreen overlay */}
      <GlobalVideoPlayer />
      {/* Main navigation - hidden when fullscreen */}
      <View style={state.isFullscreen ? { flex: 0, height: 0, overflow: 'hidden' } : { flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="player" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="multiview" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FavoritesProvider>
          <GlobalVideoProvider>
            <RootLayoutInner />
          </GlobalVideoProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
