import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

export function useUpdateChecker() {
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || Platform.OS === 'web') return;
    checked.current = true;

    const checkUpdate = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/app/version`);
        if (!res.ok) return;
        const data = await res.json();

        if (compareVersions(data.version, CURRENT_VERSION) > 0) {
          const buttons: any[] = [];

          if (data.play_store_url) {
            buttons.push({ text: 'Play Store', onPress: () => Linking.openURL(data.play_store_url) });
          }
          if (data.update_url) {
            buttons.push({ text: 'Download APK', onPress: () => Linking.openURL(data.update_url) });
          }
          if (!data.force_update) {
            buttons.push({ text: 'Later', style: 'cancel' });
          }

          Alert.alert(
            'Update Available',
            data.message || `Version ${data.version} is available. Please update for the best experience.`,
            buttons.length > 0 ? buttons : [{ text: 'OK' }],
            { cancelable: !data.force_update }
          );
        }
      } catch {}
    };

    // Delay check so it doesn't block app startup
    setTimeout(checkUpdate, 3000);
  }, []);
}
