import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Image, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';

const EPG_MODE_KEY = 'epg_update_mode';
const EPG_LAST_UPDATE_KEY = 'epg_last_update';

export default function SettingsScreen() {
  const { colors, mode, toggleTheme } = useTheme();
  const { username, userInfo, logout } = useAuth();
  const router = useRouter();
  const [epgMode, setEpgMode] = useState<'startup' | 'daily'>('daily');
  const [epgLastUpdate, setEpgLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(EPG_MODE_KEY);
      if (stored === 'startup' || stored === 'daily') setEpgMode(stored);
      const lastUp = await AsyncStorage.getItem(EPG_LAST_UPDATE_KEY);
      setEpgLastUpdate(lastUp);
    })();
  }, []);

  const changeEpgMode = async (newMode: 'startup' | 'daily') => {
    setEpgMode(newMode);
    await AsyncStorage.setItem(EPG_MODE_KEY, newMode);
  };

  const forceEpgUpdate = async () => {
    const now = new Date().toISOString();
    await AsyncStorage.setItem(EPG_LAST_UPDATE_KEY, now);
    setEpgLastUpdate(now);
    Alert.alert('EPG Updated', 'The EPG data has been force refreshed. New guide data will load when you visit Live TV.');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const expDate = userInfo?.exp_date
    ? new Date(parseInt(userInfo.exp_date) * 1000).toLocaleDateString()
    : 'N/A';

  const createdDate = userInfo?.created_at
    ? new Date(parseInt(userInfo.created_at) * 1000).toLocaleDateString()
    : 'N/A';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="settings-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require('../assets/images/elite-wave-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Account Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Username</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{username}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status</Text>
            <Text style={[styles.infoValue, { color: colors.success }]}>
              {userInfo?.status === 'Active' ? 'Active' : userInfo?.status || 'N/A'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Expires</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{expDate}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Created</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{createdDate}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="link-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Connections</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
              {userInfo?.active_cons || '0'} / {userInfo?.max_connections || 'N/A'}
            </Text>
          </View>
        </View>

        {/* Appearance */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE</Text>
          <View style={styles.infoRow}>
            <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textPrimary, flex: 1 }]}>Dark Mode</Text>
            <Switch
              testID="theme-toggle-switch"
              value={mode === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={mode === 'dark' ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* EPG Settings */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>EPG (TV GUIDE)</Text>
          <Text style={[styles.epgDesc, { color: colors.textSecondary }]}>Choose when the EPG data auto-updates</Text>
          <TouchableOpacity
            testID="epg-startup-btn"
            style={[styles.radioRow, epgMode === 'startup' && { backgroundColor: colors.primary + '15' }]}
            onPress={() => changeEpgMode('startup')}
          >
            <Ionicons name={epgMode === 'startup' ? 'radio-button-on' : 'radio-button-off'} size={20} color={epgMode === 'startup' ? colors.primary : colors.textSecondary} />
            <View style={styles.radioTextWrap}>
              <Text style={[styles.radioLabel, { color: colors.textPrimary }]}>At Startup</Text>
              <Text style={[styles.radioSub, { color: colors.textSecondary }]}>Update EPG every time the app starts</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            testID="epg-daily-btn"
            style={[styles.radioRow, epgMode === 'daily' && { backgroundColor: colors.primary + '15' }]}
            onPress={() => changeEpgMode('daily')}
          >
            <Ionicons name={epgMode === 'daily' ? 'radio-button-on' : 'radio-button-off'} size={20} color={epgMode === 'daily' ? colors.primary : colors.textSecondary} />
            <View style={styles.radioTextWrap}>
              <Text style={[styles.radioLabel, { color: colors.textPrimary }]}>Once a Day</Text>
              <Text style={[styles.radioSub, { color: colors.textSecondary }]}>Update EPG once every 24 hours</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            testID="epg-force-btn"
            style={[styles.forceUpdateBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
            onPress={forceEpgUpdate}
          >
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={[styles.forceUpdateText, { color: colors.primary }]}>Force Update</Text>
          </TouchableOpacity>
          {epgLastUpdate && (
            <Text style={[styles.epgLastUpdate, { color: colors.textSecondary }]}>
              Last updated: {new Date(epgLastUpdate).toLocaleString()}
            </Text>
          )}
        </View>

        {/* About */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ABOUT</Text>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Version</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>1.0.0</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          testID="logout-btn"
          style={[styles.logoutBtn, { backgroundColor: colors.error + '15', borderColor: colors.error + '30' }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  logo: { width: 160, height: 80 },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  infoLabel: { flex: 1, fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 4 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
  },
  logoutText: { fontSize: 16, fontWeight: '600' },
});
