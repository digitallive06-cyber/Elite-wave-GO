import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
  TouchableWithoutFeedback, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { colors } = useTheme();
  const { isLoggedIn, isLoading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.replace('/(tabs)/home');
    }
  }, [isLoggedIn, isLoading]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#0A0E1A' }]}>
        <ActivityIndicator size="large" color="#00BFFF" />
      </View>
    );
  }

  if (isLoggedIn) return null;

  const retryCountRef = useRef(0);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }
    setLoading(true);
    setError('');
    retryCountRef.current = 0;
    await attemptLogin();
  };

  const attemptLogin = async () => {
    try {
      const data = await api.login(username.trim(), password.trim());
      await login(username.trim(), password.trim(), data);
      setLoading(false);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      retryCountRef.current++;
      // Auto-retry up to 3 times on network failures
      if (retryCountRef.current < 4 && !e.message?.includes('credentials')) {
        setError(`Connecting to server... (attempt ${retryCountRef.current + 1})`);
        setTimeout(attemptLogin, 1500);
      } else {
        setError(e.message || 'Login failed. Check your credentials.');
        setLoading(false);
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: '#0A0E1A' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/elite-wave-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              testID="login-logo"
            />
          </View>

          {/* Input Fields */}
          <View style={styles.formContainer}>
            {/* Username */}
            <View style={[styles.inputWrapper, { backgroundColor: '#141929', borderColor: '#1E2540' }]}>
              <Ionicons name="person-outline" size={20} color="#7B8DB3" style={styles.inputIcon} />
              <TextInput
                testID="login-username-input"
                style={[styles.input, { color: '#F1F5F9' }]}
                placeholder="Username"
                placeholderTextColor="#7B8DB3"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={[styles.inputWrapper, { backgroundColor: '#141929', borderColor: '#1E2540' }]}>
              <Ionicons name="lock-closed-outline" size={20} color="#7B8DB3" style={styles.inputIcon} />
              <TextInput
                testID="login-password-input"
                style={[styles.input, { color: '#F1F5F9' }]}
                placeholder="Password"
                placeholderTextColor="#7B8DB3"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                testID="toggle-password-btn"
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color="#7B8DB3"
                />
              </TouchableOpacity>
            </View>

            {/* Error */}
            {error ? (
              <Text testID="login-error-text" style={styles.errorText}>{error}</Text>
            ) : null}

            {/* Login Button */}
            <TouchableOpacity
              testID="login-submit-btn"
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.loginBtnText}>SIGN IN</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footerText}>Powered by Elite Wave Network</Text>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 48,
    alignItems: 'center',
  },
  logo: {
    width: width * 0.65,
    height: width * 0.35,
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 54,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  loginBtn: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#00BFFF',
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  footerText: {
    marginTop: 48,
    color: '#7B8DB3',
    fontSize: 12,
  },
});
