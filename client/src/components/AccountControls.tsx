import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Link, LogOut, ShieldAlert, Trash2 } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import type { AuthProviderKey } from '../services/api';
import { isProviderConfigured } from '../services/socialAuth';
import { ui } from '../ui/theme';

type AccountControlsProps = {
  onSessionEnd?: () => void;
};

type BusyAction = 'logout' | 'password' | AuthProviderKey | `link-${AuthProviderKey}` | null;

export function AccountControls({ onSessionEnd }: AccountControlsProps) {
  const { user, signOut, deleteAccount, linkSocialProvider } = useAuth();
  const [busy, setBusy] = useState<BusyAction>(null);
  const [deleteExpanded, setDeleteExpanded] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const linkProvider = async (provider: AuthProviderKey) => {
    if (busy) return;
    setBusy(`link-${provider}`);
    try {
      await linkSocialProvider(provider);
      Alert.alert('Account linked', `${provider === 'google' ? 'Google' : 'Facebook'} can now sign in to this Nine Below profile.`);
    } catch (error) {
      Alert.alert('Link failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const logOut = async () => {
    if (busy) return;
    setBusy('logout');
    onSessionEnd?.();
    await signOut();
  };

  const removeAccount = async (method: 'password' | AuthProviderKey) => {
    if (busy || deleteConfirmation !== 'DELETE') return;
    if (method === 'password' && !deletePassword) {
      setDeleteError('Enter your current password.');
      return;
    }
    setBusy(method);
    setDeleteError('');
    try {
      await deleteAccount(method, method === 'password' ? deletePassword : undefined);
      onSessionEnd?.();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Account deletion could not be completed.');
      setBusy(null);
    }
  };

  const toggleDelete = () => {
    if (busy) return;
    setDeleteExpanded(value => !value);
    setDeleteConfirmation('');
    setDeletePassword('');
    setDeleteError('');
  };

  return (
    <View style={styles.root}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>Linked accounts</Text>
        <Text style={styles.sectionMeta}>Connect Google or Facebook to use the same player profile.</Text>
      </View>

      <ProviderRow
        provider="google"
        linked={!!user?.authProviders?.google}
        enabled={isProviderConfigured('google')}
        busy={busy === 'link-google'}
        disabled={!!busy}
        onPress={() => linkProvider('google')}
      />
      <ProviderRow
        provider="facebook"
        linked={!!user?.authProviders?.facebook}
        enabled={isProviderConfigured('facebook')}
        busy={busy === 'link-facebook'}
        disabled={!!busy}
        onPress={() => linkProvider('facebook')}
      />

      <Pressable
        accessibilityRole="button"
        disabled={!!busy}
        style={({ pressed }) => [styles.accountAction, pressed && styles.pressed, !!busy && styles.disabled]}
        onPress={logOut}
      >
        <View style={styles.actionIcon}>
          <LogOut size={19} color={ui.text.secondary} strokeWidth={2.6} />
        </View>
        <Text style={styles.accountActionText}>{busy === 'logout' ? 'Logging Out...' : 'Log Out'}</Text>
      </Pressable>

      <View style={styles.dangerZone}>
        <View style={styles.dangerHeader}>
          <View style={styles.dangerIcon}>
            <ShieldAlert size={20} color={ui.feedback.danger} strokeWidth={2.6} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.dangerTitle}>Delete Account</Text>
            <Text style={styles.dangerCopy}>Permanently remove your Nine Below profile and sign-in access.</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!!busy}
          style={({ pressed }) => [styles.deleteToggle, pressed && styles.pressed, !!busy && styles.disabled]}
          onPress={toggleDelete}
        >
          <Trash2 size={18} color={ui.feedback.danger} strokeWidth={2.6} />
          <Text style={styles.deleteToggleText}>{deleteExpanded ? 'Cancel Account Deletion' : 'Delete My Account'}</Text>
        </Pressable>

        {deleteExpanded ? (
          <View style={styles.deleteForm}>
            <Text style={styles.deleteWarning}>
              Your profile, login methods, inventory, coins, club membership, and active social data will be removed.
              Match-integrity and safety records may be anonymized where retention is required.
            </Text>
            <Text style={styles.inputLabel}>Type DELETE to continue</Text>
            <TextInput
              accessibilityLabel="Type DELETE to confirm"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              maxLength={6}
              placeholder="DELETE"
              placeholderTextColor={ui.text.muted}
              style={styles.input}
              value={deleteConfirmation}
              onChangeText={value => {
                setDeleteConfirmation(value);
                setDeleteError('');
              }}
            />

            {user?.passwordSignIn ? (
              <>
                <Text style={styles.inputLabel}>Current password</Text>
                <TextInput
                  accessibilityLabel="Current password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  placeholder="Enter your password"
                  placeholderTextColor={ui.text.muted}
                  secureTextEntry
                  style={styles.input}
                  value={deletePassword}
                  onChangeText={value => {
                    setDeletePassword(value);
                    setDeleteError('');
                  }}
                />
                <DeleteButton
                  label="Delete With Password"
                  busy={busy === 'password'}
                  disabled={deleteConfirmation !== 'DELETE' || !deletePassword || !!busy}
                  onPress={() => removeAccount('password')}
                />
              </>
            ) : null}

            {user?.authProviders?.google && isProviderConfigured('google') ? (
              <DeleteButton
                label="Verify And Delete With Google"
                busy={busy === 'google'}
                disabled={deleteConfirmation !== 'DELETE' || !!busy}
                onPress={() => removeAccount('google')}
              />
            ) : null}

            {user?.authProviders?.facebook && isProviderConfigured('facebook') ? (
              <DeleteButton
                label="Verify And Delete With Facebook"
                busy={busy === 'facebook'}
                disabled={deleteConfirmation !== 'DELETE' || !!busy}
                onPress={() => removeAccount('facebook')}
              />
            ) : null}

            {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
            <Text style={styles.deleteFootnote}>Finish an active match before deleting your account.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ProviderRow({
  provider,
  linked,
  enabled,
  busy,
  disabled,
  onPress,
}: {
  provider: AuthProviderKey;
  linked: boolean;
  enabled: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const label = provider === 'google' ? 'Google' : 'Facebook';
  return (
    <View style={styles.providerRow}>
      <View style={[styles.providerMark, provider === 'google' ? styles.googleMark : styles.facebookMark]}>
        <Text style={[styles.providerMarkText, provider === 'facebook' && styles.facebookMarkText]}>
          {provider === 'google' ? 'G' : 'f'}
        </Text>
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.providerName}>{label}</Text>
        <Text style={styles.providerMeta}>
          {linked ? 'Linked to this profile.' : enabled ? 'Available to link.' : 'Not available in this build.'}
        </Text>
      </View>
      {linked ? (
        <View style={styles.linkedBadge}>
          <CheckCircle2 size={16} color={ui.palette.emerald} strokeWidth={2.6} />
          <Text style={styles.linkedBadgeText}>Linked</Text>
        </View>
      ) : enabled ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed, disabled && styles.disabled]}
          onPress={onPress}
        >
          <Link size={16} color={ui.text.inverse} strokeWidth={2.6} />
          <Text style={styles.linkButtonText}>{busy ? 'Linking...' : 'Link'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DeleteButton({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Trash2 size={17} color={ui.text.primary} strokeWidth={2.6} />
      <Text style={styles.deleteButtonText}>{busy ? 'Deleting Account...' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  sectionCopy: { marginBottom: 2 },
  sectionTitle: { color: ui.text.primary, fontSize: 15, fontWeight: '900' },
  sectionMeta: { color: ui.text.secondary, fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 3 },
  providerRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: 'rgba(26, 41, 67, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 9,
  },
  providerMark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  googleMark: { backgroundColor: '#F4F7FF' },
  facebookMark: { backgroundColor: '#1877F2' },
  providerMarkText: { color: ui.text.inverse, fontSize: 19, fontWeight: '900' },
  facebookMarkText: { color: ui.text.primary },
  rowCopy: { flex: 1, minWidth: 0 },
  providerName: { color: ui.text.primary, fontSize: 13, fontWeight: '900' },
  providerMeta: { color: ui.text.secondary, fontSize: 10, fontWeight: '700', marginTop: 2 },
  linkedBadge: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(82, 229, 167, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
  },
  linkedBadgeText: { color: ui.palette.emerald, fontSize: 11, fontWeight: '900' },
  linkButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: ui.palette.emerald,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  linkButtonText: { color: ui.text.inverse, fontSize: 11, fontWeight: '900' },
  accountAction: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: 'rgba(26, 41, 67, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ui.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountActionText: { color: ui.text.primary, fontSize: 13, fontWeight: '900' },
  dangerZone: { borderTopWidth: 1, borderTopColor: ui.border.soft, marginTop: 4, paddingTop: 12 },
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dangerIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 127, 134, 0.55)',
    backgroundColor: 'rgba(255, 127, 134, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: { color: ui.feedback.danger, fontSize: 14, fontWeight: '900' },
  dangerCopy: { color: ui.text.secondary, fontSize: 10, fontWeight: '700', lineHeight: 15, marginTop: 2 },
  deleteToggle: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.feedback.danger,
    backgroundColor: 'rgba(255, 127, 134, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  deleteToggleText: { color: ui.feedback.danger, fontSize: 12, fontWeight: '900' },
  deleteForm: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 127, 134, 0.28)',
    backgroundColor: 'rgba(255, 127, 134, 0.05)',
    padding: 11,
    marginTop: 9,
  },
  deleteWarning: { color: ui.text.secondary, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  inputLabel: { color: ui.text.primary, fontSize: 11, fontWeight: '900', marginTop: 11, marginBottom: 6 },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.strong,
    backgroundColor: ui.surface.base,
    color: ui.text.primary,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  deleteButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: ui.feedback.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  deleteButtonText: { color: ui.text.primary, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  deleteError: { color: ui.feedback.danger, fontSize: 11, fontWeight: '900', lineHeight: 16, marginTop: 9 },
  deleteFootnote: { color: ui.text.muted, fontSize: 10, fontWeight: '700', lineHeight: 15, marginTop: 9 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
});
