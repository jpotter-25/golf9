// client/src/screens/LoginScreen.tsx
// Purpose: Real signup/login screen backed by server sessions.

import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookOpen, GraduationCap, LogIn, Sparkles, UserPlus } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL } from '../config';
import * as api from '../services/api';
import { isProviderConfigured } from '../services/socialAuth';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const PLAYER_NAME_RULES = 'Use 2-12 letters, numbers, dashes, or underscores.';
const PLAYER_NAME_PATTERN = /^[A-Za-z0-9_-]{2,12}$/;

function cleanSignupNameInput(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12);
}

function playerNameError(value: string) {
  if (!PLAYER_NAME_PATTERN.test(value)) return PLAYER_NAME_RULES;
  return null;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn, signUp, signInWithSocial, completeSocialSignUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [providers, setProviders] = useState<api.AuthProviderStatus>({ google: false, facebook: false });
  const [pendingSocial, setPendingSocial] = useState<(api.SocialProfileRequiredResponse & api.SocialAuthPayload) | null>(null);
  const [socialDisplayName, setSocialDisplayName] = useState('');
  const [socialInviteCode, setSocialInviteCode] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.authConfig()
      .then(config => {
        setInviteRequired(config.inviteRequired);
        setProviders(config.providers);
      })
      .catch(() => {
        setInviteRequired(false);
        setProviders({ google: false, facebook: false });
      });
  }, []);

  const submit = async () => {
    const cleanDisplayName = displayName.trim();
    const cleanPassword = password.trim();
    if (!cleanDisplayName || !cleanPassword) {
      Alert.alert('Profile needed', 'Enter your display name and password.');
      return;
    }
    if (mode === 'signup') {
      const nameError = playerNameError(cleanDisplayName);
      if (nameError) {
        Alert.alert('Name needs cleanup', nameError);
        return;
      }
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

  const startSocial = async (provider: api.AuthProviderKey) => {
    setLoading(true);
    try {
      const response = await signInWithSocial(provider);
      if ('requiresProfile' in response) {
        setPendingSocial(response);
        setSocialDisplayName(response.suggestedDisplayName);
        setSocialInviteCode('');
      }
    } catch (error) {
      Alert.alert(`${provider === 'google' ? 'Google' : 'Facebook'} login failed`, error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const finishSocialProfile = async () => {
    if (!pendingSocial) return;
    const cleanName = socialDisplayName.trim();
    const cleanInvite = socialInviteCode.trim();
    if (!cleanName) {
      Alert.alert('Profile needed', 'Choose your Nine Below display name.');
      return;
    }
    const nameError = playerNameError(cleanName);
    if (nameError) {
      Alert.alert('Name needs cleanup', nameError);
      return;
    }
    if (pendingSocial.inviteRequired && !cleanInvite) {
      Alert.alert('Invite needed', 'Enter your pre-alpha invite code to create this account.');
      return;
    }
    setLoading(true);
    try {
      await completeSocialSignUp(pendingSocial, cleanName, cleanInvite);
      setPendingSocial(null);
    } catch (error) {
      Alert.alert('Social signup failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';
  const googleEnabled = providers.google && isProviderConfigured('google');
  const facebookEnabled = providers.facebook && isProviderConfigured('facebook');
  const showSocial = googleEnabled || facebookEnabled;

  return (
    <ScreenShell scroll centered>
      <ScreenHeader
        eyebrow="Welcome To"
        title="Nine Below"
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
          onChangeText={text => setDisplayName(isLogin ? text : cleanSignupNameInput(text))}
          maxLength={isLogin ? 64 : 12}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textContentType="username"
          autoComplete="username"
        />
        {!isLogin ? <Text style={styles.inputHint}>{PLAYER_NAME_RULES}</Text> : null}
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

        {showSocial ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            {googleEnabled ? <SocialButton provider="google" disabled={loading} onPress={() => startSocial('google')} /> : null}
            {facebookEnabled ? <SocialButton provider="facebook" disabled={loading} onPress={() => startSocial('facebook')} /> : null}
          </>
        ) : null}
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
      <Pressable style={[styles.secondaryAction, styles.tutorialAction]} onPress={() => navigation.navigate('Tutorial')}>
        <GraduationCap size={18} color={ui.palette.emerald} />
        <Text style={styles.secondaryText}>Play Tutorial</Text>
      </Pressable>

      {__DEV__ ? <Text style={styles.devServer}>Server: {SERVER_URL}</Text> : null}

      <Modal animationType="fade" transparent visible={!!pendingSocial} onRequestClose={() => setPendingSocial(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Finish Profile</Text>
            <Text style={styles.modalMeta}>Choose the Nine Below name other players will see.</Text>
            <TextInput
              style={styles.input}
              placeholder="Display name"
              placeholderTextColor={ui.text.muted}
              value={socialDisplayName}
              onChangeText={text => setSocialDisplayName(cleanSignupNameInput(text))}
              maxLength={12}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            <Text style={styles.inputHint}>{PLAYER_NAME_RULES}</Text>
            {pendingSocial?.inviteRequired ? (
              <TextInput
                style={styles.input}
                placeholder="Pre-alpha invite code"
                placeholderTextColor={ui.text.muted}
                value={socialInviteCode}
                onChangeText={setSocialInviteCode}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
              />
            ) : null}
            <ActionButton label={loading ? 'Working...' : 'Create Account'} Icon={UserPlus} disabled={loading} onPress={finishSocialProfile} />
            <ActionButton label="Cancel" tone="ghost" disabled={loading} onPress={() => setPendingSocial(null)} style={styles.cancelButton} />
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
};

export default LoginScreen;

function SocialButton({ provider, disabled, onPress }: { provider: api.AuthProviderKey; disabled: boolean; onPress: () => void }) {
  const isGoogle = provider === 'google';
  return (
    <Pressable style={[styles.socialButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <View style={[styles.socialMark, isGoogle ? styles.googleMark : styles.facebookMark]}>
        <Text style={[styles.socialMarkText, !isGoogle && styles.facebookMarkText]}>{isGoogle ? 'G' : 'f'}</Text>
      </View>
      <Text style={styles.socialButtonText}>Continue with {isGoogle ? 'Google' : 'Facebook'}</Text>
    </Pressable>
  );
}

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
  inputHint: { color: ui.text.muted, fontSize: 11, fontWeight: '800', marginTop: -6, marginBottom: 12, lineHeight: 15 },
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
  tutorialAction: { flex: 0, width: '100%', marginTop: 10 },
  devServer: { color: ui.text.muted, fontSize: 11, marginTop: 18, textAlign: 'center', fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: ui.border.soft },
  dividerText: { color: ui.text.muted, fontSize: 11, fontWeight: '900' },
  socialButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: ui.radius.md,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  socialMark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  googleMark: { backgroundColor: '#F4F7FF' },
  facebookMark: { backgroundColor: '#1877F2' },
  socialMarkText: { color: ui.text.inverse, fontSize: 17, fontWeight: '900' },
  facebookMarkText: { color: ui.text.primary },
  socialButtonText: { color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(3, 6, 18, 0.74)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: ui.radius.lg, borderWidth: 1, borderColor: ui.border.gold, backgroundColor: ui.surface.panel, padding: 18 },
  modalTitle: { color: ui.text.primary, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  modalMeta: { color: ui.text.secondary, fontSize: 13, fontWeight: '800', lineHeight: 18, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  cancelButton: { marginTop: 10 },
});
