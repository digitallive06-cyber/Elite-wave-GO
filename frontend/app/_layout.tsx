import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { FavoritesProvider } from '../src/contexts/FavoritesContext';
import { GlobalVideoProvider } from '../src/contexts/GlobalVideoContext';
import { GlobalVideoPlayer } from '../src/components/GlobalVideoPlayer';

function RootLayoutInner() {
  const { mode } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="multiview" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <GlobalVideoPlayer />
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
