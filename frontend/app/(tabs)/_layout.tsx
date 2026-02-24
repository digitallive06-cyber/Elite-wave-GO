import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { View, StyleSheet, Platform } from 'react-native';

export default function TabsLayout() {
  const { colors, mode } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
          tabBarTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Live',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="tv" size={22} color={color} />
          ),
          tabBarTestID: 'tab-live',
        }}
      />
      <Tabs.Screen
        name="vod"
        options={{
          title: 'VOD',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="film" size={22} color={color} />
          ),
          tabBarTestID: 'tab-vod',
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: 'Series',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums" size={22} color={color} />
          ),
          tabBarTestID: 'tab-series',
        }}
      />
      <Tabs.Screen
        name="catchup"
        options={{
          title: 'Catch-Up',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={22} color={color} />
          ),
          tabBarTestID: 'tab-catchup',
        }}
      />
    </Tabs>
  );
}
