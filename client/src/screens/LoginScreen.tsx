// client/src/screens/LoginScreen.tsx
// Purpose: Real signup/login screen backed by server sessions.

import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookOpen, LogIn, Sparkles, UserPlus } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL } from '../config';
import * as api from '../services/api';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn, signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.authConfig()
      .then(config => setInviteRequired(config.inviteRequired))
      .catch(() => setInviteRequired(false));
  }, []);

  const submit = async () => {
    const cleanDisplayName = displayName.trim();
    const cleanPassword = password.trim();
    if (!cleanDisplayName || !cleanPassword) {
      Alert.alert('Profile needed', 'Enter your display name and password.');
      return;
    }
    const cleanInviteCode = inviteCode.trim();
    if (mode === 'signup' && inviteRequired && !cleanInviteCode) {
      Alert.alert('Invite needed', 'Enter your pre-alpha invite code to create an account.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') await signIn(cleanDisplayName, cleanPassword);
      else await signUp(cleanDisplayName, cleanPassword, cleanInviteCode);
    } catch (error) {
      Alert.alert('Authentication failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <ScreenShell scroll centered>
      <ScreenHeader
        eyebrow="Welcome To"
        title="Golf 9"
        subtitle={isLogin ? 'Step back into your table, clubs, ranked climb, and rewards.' : 'Create your player profile and start building progress.'}
        right={<StatusBadge label="LIVE" tone="gold" />}
      />

      <PremiumPanel tone="felt">
        <View style={styles.heroIcon}>
          <Sparkles size={28} color={ui.palette.gold} strokeWidth={2.4} />
        </View>
        <Text style={styles.panelTitle}>{isLogin ? 'Sign In' : 'Create Profile'}</Text>
        <Text style={styles.panelMeta}>{isLogin ? 'Use your saved player credentials.' : 'Choose a display name players will see.'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor={ui.text.muted}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textContentType="username"
          autoComplete="username"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={ui.text.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textContentType={isLogin ? 'password' : 'newPassword'}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
        />
        {!isLogin && inviteRequired ? (
          <TextInput
            style={styles.input}
            placeholder="Pre-alpha invite code"
            placeholderTextColor={ui.text.muted}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
          />
        ) : null}

        <ActionButton
          label={loading ? 'Working...' : isLogin ? 'Log In' : 'Sign Up'}
          Icon={isLogin ? LogIn : UserPlus}
          disabled={loading}
          onPress={submit}
        />
      </PremiumPanel>

      <View style={styles.quickActions}>
        <Pressable style={styles.secondaryAction} onPress={() => setMode(isLogin ? 'signup' : 'login')}>
          {isLogin ? <UserPlus size={18} color={ui.palette.gold} /> : <LogIn size={18} color={ui.palette.gold} />}
          <Text style={styles.secondaryText}>{isLogin ? 'Create Account' : 'Log In Instead'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate('Rules')}>
          <BookOpen size={18} color={ui.palette.sky} />
          <Text style={styles.secondaryText}>Rules</Text>
        </Pressable>
      </View>

      {__DEV__ ? <Text style={styles.devServer}>Server: {SERVER_URL}</Text> : null}
    </ScreenShell>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: ui.palette.feltLight,
    borderWidth: 1,
    borderColor: ui.border.gold,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  panelTitle: { color: ui.text.primary, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  panelMeta: { color: ui.text.secondary, fontSize: 13, fontWeight: '800', textAlign: 'center', marginTop: 5, marginBottom: 16 },
  input: {
    width: '100%',
    minHeight: 52,
    borderWidth: 1,
    borderColor: ui.border.soft,
    borderRadius: ui.radius.md,
    color: ui.text.primary,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: ui.surface.base,
    fontSize: 15,
    fontWeight: '800',
  },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: ui.radius.md,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
  },
  secondaryText: { color: ui.text.primary, fontWeight: '900', fontSize: 13 },
  devServer: { color: ui.text.muted, fontSize: 11, marginTop: 18, textAlign: 'center', fontWeight: '700' },
});
