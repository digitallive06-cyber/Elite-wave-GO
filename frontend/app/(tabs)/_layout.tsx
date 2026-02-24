import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Ensure bottom tab bar sits above the phone's navigation bar
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
          tabBarTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Live',
          tabBarIcon: ({ color }) => (
            <Ionicons name="tv" size={22} color={color} />
          ),
          tabBarTestID: 'tab-live',
        }}
      />
      <Tabs.Screen
        name="vod"
        options={{
          title: 'VOD',
          tabBarIcon: ({ color }) => (
            <Ionicons name="film" size={22} color={color} />
          ),
          tabBarTestID: 'tab-vod',
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: 'Series',
          tabBarIcon: ({ color }) => (
            <Ionicons name="albums" size={22} color={color} />
          ),
          tabBarTestID: 'tab-series',
        }}
      />
      <Tabs.Screen
        name="catchup"
        options={{
          title: 'Catch-Up',
          tabBarIcon: ({ color }) => (
            <Ionicons name="time" size={22} color={color} />
          ),
          tabBarTestID: 'tab-catchup',
        }}
      />
    </Tabs>
  );
}
