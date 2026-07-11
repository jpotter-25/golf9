// client/src/screens/InboxScreen.tsx
// Purpose: Player-facing system mailbox, reward claims, and feedback reports.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Gift, Mail, Send, Trash2 } from 'lucide-react-native';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import { useClubRealtime } from '../context/ClubRealtimeContext';
import * as api from '../services/api';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, SectionTitle, StatusBadge, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Inbox'>;

const FEEDBACK_CATEGORIES: Array<{ key: api.MailFeedbackCategory; label: string }> = [
  { key: 'bug', label: 'Bug' },
  { key: 'suggestion', label: 'Suggestion' },
  { key: 'account', label: 'Account' },
  { key: 'gameplay', label: 'Gameplay' },
  { key: 'other', label: 'Other' },
];

function rewardLabel(attachment: api.MailAttachment) {
  if (attachment.type === 'coins') return `${attachment.amount.toLocaleString()} coins`;
  if (attachment.type === 'cosmetic') return 'Cosmetic reward';
  return 'Reward';
}

function formatWhen(timestamp: number) {
  return timestamp ? new Date(timestamp).toLocaleDateString() : '';
}

export default function InboxScreen({ navigation }: Props) {
  const { token, refreshProfile } = useAuth();
  const { mailSummary: summary, updateMailSummary } = useClubRealtime();
  const [mail, setMail] = useState<api.MailEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<api.MailFeedbackCategory>('bug');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const loadMail = useCallback(async () => {
    if (!token) return;
    const response = await api.mailList(token);
    setMail(response.mail);
    updateMailSummary(response.summary);
  }, [token, updateMailSummary]);

  useFocusEffect(useCallback(() => {
    loadMail().catch(() => {
      setMail([]);
    });
  }, [loadMail]));

  const hasMail = mail.length > 0;
  const feedbackRemaining = useMemo(() => Math.max(0, 1000 - feedbackMessage.length), [feedbackMessage.length]);

  const claim = async (entry: api.MailEntry) => {
    if (!token || busyId) return;
    setBusyId(entry.mailId);
    try {
      const response = await api.claimMail(token, entry.mailId);
      setMail(current => current.map(item => item.mailId === entry.mailId ? response.mail : item));
      updateMailSummary(response.summary);
      await refreshProfile().catch(() => {});
      const rewards = response.rewards.map(rewardLabel).join(', ');
      Alert.alert(response.alreadyClaimed ? 'Already claimed' : 'Reward claimed', rewards || 'Reward claimed.');
    } catch (error) {
      Alert.alert('Claim failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const markRead = async (entry: api.MailEntry) => {
    if (!token || entry.read || busyId) return;
    setBusyId(entry.mailId);
    try {
      const response = await api.markMailRead(token, entry.mailId);
      setMail(current => current.map(item => item.mailId === entry.mailId ? response.mail : item));
      updateMailSummary(response.summary);
    } catch {
      await loadMail().catch(() => {});
    } finally {
      setBusyId(null);
    }
  };

  const removeMail = async (entry: api.MailEntry) => {
    if (!token || busyId) return;
    setBusyId(entry.mailId);
    try {
      const response = await api.deleteMail(token, entry.mailId);
      setMail(current => current.filter(item => item.mailId !== entry.mailId));
      updateMailSummary(response.summary);
    } catch (error) {
      Alert.alert('Delete failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const submitFeedback = async () => {
    if (!token || feedbackBusy) return;
    const message = feedbackMessage.trim();
    if (message.length < 6) {
      Alert.alert('Add a little more detail', 'Feedback needs at least 6 characters.');
      return;
    }
    setFeedbackBusy(true);
    try {
      const response = await api.submitMailboxFeedback(token, {
        category: feedbackCategory,
        subject: feedbackSubject.trim() || undefined,
        message,
      });
      setFeedbackSubject('');
      setFeedbackMessage('');
      Alert.alert('Feedback sent', `Ticket ${response.ticket.ticketId.slice(0, 8)} is in the support inbox.`);
    } catch (error) {
      Alert.alert('Feedback failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setFeedbackBusy(false);
    }
  };

  return (
    <ScreenShell scroll>
      <ScreenHeader
        eyebrow="Mailbox"
        title="Inbox"
        subtitle="System notices, rewards, and feedback."
        right={<StatusBadge label={`${summary?.unread ?? 0} unread`} tone={(summary?.unread ?? 0) ? 'gold' : 'muted'} />}
      />

      <View style={styles.summaryRow}>
        <StatusBadge label={`${summary?.total ?? 0} total`} tone="sky" />
        <StatusBadge label={`${summary?.claimable ?? 0} rewards`} tone={(summary?.claimable ?? 0) ? 'gold' : 'muted'} />
      </View>

      <SectionTitle title="System Mail" />
      {hasMail ? mail.map(entry => (
        <PremiumPanel key={entry.mailId} tone={entry.claimable ? 'gold' : 'panel'} style={styles.mailCard}>
          <Pressable onPress={() => markRead(entry)} style={styles.mailHeader}>
            <View style={styles.mailIcon}>
              {entry.claimable ? <Gift size={24} color={ui.palette.gold} strokeWidth={2.8} /> : <Mail size={24} color={ui.palette.sky} strokeWidth={2.8} />}
            </View>
            <View style={styles.mailTitleWrap}>
              <Text style={styles.mailTitle} numberOfLines={2}>{entry.title}</Text>
              <Text style={styles.mailMeta} numberOfLines={1}>
                {entry.createdByAdminName} - {formatWhen(entry.createdAt)}
              </Text>
            </View>
            {!entry.read ? <View style={styles.unreadDot} /> : null}
          </Pressable>
          <Text style={styles.mailBody}>{entry.body}</Text>
          {entry.attachments.length ? (
            <View style={styles.rewardRow}>
              {entry.attachments.map((attachment, index) => (
                <StatusBadge key={`${attachment.type}-${index}`} label={rewardLabel(attachment)} tone="gold" />
              ))}
            </View>
          ) : null}
          {entry.expiresAt ? <Text style={styles.expiry}>Expires {formatWhen(entry.expiresAt)}</Text> : null}
          <View style={styles.mailActions}>
            {entry.claimed ? (
              <StatusBadge label="Claimed" tone="emerald" />
            ) : entry.claimable ? (
              <ActionButton label={busyId === entry.mailId ? 'Claiming...' : 'Claim Reward'} Icon={CheckCircle2} tone="gold" disabled={busyId === entry.mailId} onPress={() => claim(entry)} />
            ) : null}
            <ActionButton label="Delete" Icon={Trash2} tone="ghost" disabled={busyId === entry.mailId} onPress={() => removeMail(entry)} />
          </View>
        </PremiumPanel>
      )) : (
        <PremiumPanel style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>No mail yet</Text>
          <Text style={styles.emptyCopy}>System notices and claimable rewards will appear here.</Text>
        </PremiumPanel>
      )}

      <SectionTitle title="Submit Feedback" />
      <PremiumPanel style={styles.feedbackPanel}>
        <View style={styles.categoryGrid}>
          {FEEDBACK_CATEGORIES.map(category => (
            <Pressable
              key={category.key}
              style={[styles.categoryButton, feedbackCategory === category.key && styles.categoryButtonActive]}
              onPress={() => setFeedbackCategory(category.key)}
            >
              <Text style={[styles.categoryText, feedbackCategory === category.key && styles.categoryTextActive]}>{category.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={feedbackSubject}
          onChangeText={setFeedbackSubject}
          placeholder="Optional subject"
          placeholderTextColor={ui.text.muted}
          style={styles.input}
          maxLength={100}
        />
        <TextInput
          value={feedbackMessage}
          onChangeText={value => setFeedbackMessage(value.slice(0, 1000))}
          placeholder="Tell us what happened or what would make Golf 9 better."
          placeholderTextColor={ui.text.muted}
          style={[styles.input, styles.feedbackInput]}
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />
        <Text style={styles.feedbackCount}>{feedbackRemaining} characters left</Text>
        <ActionButton label={feedbackBusy ? 'Sending...' : 'Send Feedback'} Icon={Send} disabled={feedbackBusy} onPress={submitFeedback} />
      </PremiumPanel>

      <ActionButton label="Back" tone="ghost" onPress={() => navigation.goBack()} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  mailCard: {
    gap: 12,
    marginBottom: 12,
  },
  mailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mailIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  mailTitle: {
    color: ui.text.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  mailMeta: {
    color: ui.text.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ui.palette.gold,
  },
  mailBody: {
    color: ui.text.secondary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expiry: {
    color: ui.text.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  mailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  emptyPanel: {
    alignItems: 'center',
    paddingVertical: 26,
    marginBottom: 16,
  },
  emptyTitle: {
    color: ui.text.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  emptyCopy: {
    color: ui.text.muted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  feedbackPanel: {
    gap: 12,
    marginBottom: 18,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonActive: {
    backgroundColor: ui.palette.emerald,
    borderColor: ui.palette.emerald,
  },
  categoryText: {
    color: ui.text.secondary,
    fontSize: 13,
    fontWeight: '900',
  },
  categoryTextActive: {
    color: ui.text.inverse,
  },
  input: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.base,
    color: ui.text.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '800',
  },
  feedbackInput: {
    minHeight: 130,
  },
  feedbackCount: {
    color: ui.text.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
});
