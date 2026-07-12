// src/screens/LobbyScreen.tsx
// Purpose: Authenticated home hub for casual, ranked, offline, and club destinations.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, ChevronRight, Gamepad2, Search, Trophy, Users, Wifi, WifiOff } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { PremiumPanel, ProgressBar, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';
import { ClubEmblem } from '../components/ClubEmblem';
import { useAuth } from '../context/AuthContext';
import { useClubRealtime } from '../context/ClubRealtimeContext';
import { useConnectivity } from '../context/ConnectivityContext';
import type { ClubProfile, ClubSummary } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

export default function LobbyScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { club: realtimeClub, clubActionCount, clubChatUnread } = useClubRealtime();
  const { isOnline, isConnectionKnown } = useConnectivity();
  const club = realtimeClub ?? user?.club ?? null;
  const clubAttention = clubActionCount + clubChatUnread;

  return (
    <ScreenShell scroll centered>
      <ScreenHeader
        eyebrow="Golf 9"
        title="Play"
        subtitle="Choose a table style and get straight to the cards."
        right={isOnline
          ? <StatusBadge label="ONLINE" tone="emerald" />
          : isConnectionKnown
            ? <StatusBadge label="OFFLINE" tone="gold" />
            : <StatusBadge label="CHECKING" tone="muted" />}
      />

      <View style={styles.playStack}>
        <DestinationCard
          title="Play Casual"
          subtitle="Auto-match, room codes, custom tables, and coin wagers."
          Icon={Users}
          color={ui.palette.emerald}
          disabled={!isOnline}
          status={!isOnline ? 'Internet needed' : 'Online multiplayer'}
          onPress={() => navigation.navigate('CasualMenu')}
        />
        <DestinationCard
          title="Play Ranked"
          subtitle="Nine-round competitive matches with separate 2P, 3P, and 4P ladders."
          Icon={Trophy}
          color={ui.palette.gold}
          disabled={!isOnline}
          status={!isOnline ? 'Internet needed' : user?.competitive?.league.name ?? 'Iron III'}
          onPress={() => navigation.navigate('RankedMenu')}
        />
        <DestinationCard
          title="Play Offline"
          subtitle="Solo AI and Pass & Play work anywhere, with or without service."
          Icon={Gamepad2}
          color={ui.palette.sky}
          status={isOnline ? 'Local play' : 'Ready now'}
          onPress={() => navigation.navigate('OfflineMenu')}
        />
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionEyebrow}>Club</Text>
        <Text style={styles.sectionHint}>{club ? 'Your community' : 'Find your community'}</Text>
      </View>

      {club ? (
        <ClubDestinationCard
          club={club}
          attention={clubAttention}
          disabled={!isOnline}
          onPress={() => navigation.navigate('Club')}
        />
      ) : (
        <Pressable
          onPress={() => navigation.navigate('Club')}
          disabled={!isOnline}
          accessibilityRole="button"
          accessibilityLabel="Find a club"
          style={({ pressed }) => [(!isOnline || pressed) && styles.destinationDisabled]}
        >
          <PremiumPanel style={styles.findClubCard}>
            <View style={styles.findClubIcon}><Search size={25} color={ui.palette.violet} strokeWidth={2.7} /></View>
            <View style={styles.findClubCopy}>
              <Text style={styles.findClubTitle}>Find a Club</Text>
              <Text style={styles.findClubText}>{isOnline ? 'Meet players, share live chat, and build club progress.' : 'Reconnect to browse and join clubs.'}</Text>
            </View>
            {isOnline ? <ChevronRight size={21} color={ui.text.muted} strokeWidth={2.7} /> : <WifiOff size={20} color={ui.text.muted} strokeWidth={2.5} />}
          </PremiumPanel>
        </Pressable>
      )}

      <Pressable style={styles.howToPlay} onPress={() => navigation.navigate('Rules')} accessibilityRole="link">
        <BookOpen size={17} color={ui.palette.sky} strokeWidth={2.5} />
        <Text style={styles.howToPlayText}>How to play?</Text>
      </Pressable>
    </ScreenShell>
  );
}

function DestinationCard({ title, subtitle, Icon, color, status, disabled = false, onPress }: { title: string; subtitle: string; Icon: LucideIcon; color: string; status: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${status}`}
      style={({ pressed }) => [(disabled || pressed) && styles.destinationDisabled]}
    >
      <PremiumPanel tone="felt" style={[styles.destinationCard, { borderColor: disabled ? ui.border.soft : color }]}>
        <View style={[styles.destinationAccent, { backgroundColor: color }]} />
        <View style={[styles.destinationIcon, { borderColor: color }]}><Icon size={27} color={color} strokeWidth={2.7} /></View>
        <View style={styles.destinationCopy}>
          <View style={styles.destinationTitleRow}>
            <Text style={styles.destinationTitle}>{title}</Text>
            <Text style={[styles.destinationStatus, { color: disabled ? ui.text.muted : color }]} numberOfLines={1}>{status}</Text>
          </View>
          <Text style={styles.destinationSubtitle}>{subtitle}</Text>
        </View>
        {disabled ? <WifiOff size={20} color={ui.text.muted} strokeWidth={2.5} /> : <ChevronRight size={21} color={color} strokeWidth={2.7} />}
      </PremiumPanel>
    </Pressable>
  );
}

function ClubDestinationCard({ club, attention, disabled, onPress }: { club: ClubSummary | ClubProfile; attention: number; disabled: boolean; onPress: () => void }) {
  const progression = 'progression' in club ? club.progression : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Open ${club.name}${attention ? `, ${attention} new club item${attention === 1 ? '' : 's'}` : ''}`}
      style={({ pressed }) => [(disabled || pressed) && styles.destinationDisabled]}
    >
      <PremiumPanel style={styles.clubCard}>
        <View style={styles.clubEmblemWrap}>
          <ClubEmblem branding={club.branding} tag={club.tag} size={68} />
          {attention > 0 ? <View style={styles.clubBadge}><Text style={styles.clubBadgeText}>{Math.min(99, attention)}</Text></View> : null}
        </View>
        <View style={styles.clubCopy}>
          <View style={styles.clubNameRow}>
            <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
            <Text style={styles.clubTag}>[{club.tag}]</Text>
          </View>
          <Text style={styles.clubMotto} numberOfLines={1}>{club.motto || 'Play together. Grow together.'}</Text>
          <View style={styles.clubMetaRow}>
            <Text style={styles.clubMeta}>Lv {club.level}</Text>
            <Text style={styles.clubMeta}>{club.memberCount}/{club.memberCap} members</Text>
            <Text style={[styles.clubMeta, styles.clubOnline]}>{club.onlineMemberCount} online</Text>
          </View>
          <ProgressBar value={progression?.levelProgress ?? 0} color={ui.palette.violet} />
        </View>
        {disabled ? <WifiOff size={20} color={ui.text.muted} strokeWidth={2.5} /> : <ChevronRight size={21} color={ui.palette.violet} strokeWidth={2.7} />}
      </PremiumPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  playStack: { gap: 10 },
  destinationCard: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, overflow: 'hidden' },
  destinationAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  destinationIcon: { width: 52, height: 52, borderRadius: 8, borderWidth: 1, backgroundColor: 'rgba(7, 10, 24, 0.4)', alignItems: 'center', justifyContent: 'center' },
  destinationCopy: { flex: 1, minWidth: 0 },
  destinationTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  destinationTitle: { color: ui.text.primary, fontSize: 19, fontWeight: '900' },
  destinationStatus: { maxWidth: 105, fontSize: 10, fontWeight: '900', textAlign: 'right' },
  destinationSubtitle: { color: ui.text.secondary, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 5 },
  destinationDisabled: { opacity: 0.52 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 },
  sectionEyebrow: { color: ui.text.primary, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: ui.text.muted, fontSize: 11, fontWeight: '800' },
  clubCard: { minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: 13, borderColor: ui.palette.violet },
  clubEmblemWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  clubBadge: { position: 'absolute', right: -2, top: -2, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: ui.feedback.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: ui.surface.base },
  clubBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  clubCopy: { flex: 1, minWidth: 0 },
  clubNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  clubName: { flexShrink: 1, color: ui.text.primary, fontSize: 19, fontWeight: '900' },
  clubTag: { color: ui.palette.violet, fontSize: 11, fontWeight: '900' },
  clubMotto: { color: ui.text.secondary, fontSize: 12, fontWeight: '700', marginTop: 3 },
  clubMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7, marginBottom: 7 },
  clubMeta: { color: ui.text.muted, fontSize: 10, fontWeight: '900' },
  clubOnline: { color: ui.palette.emerald },
  findClubCard: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 13, borderColor: ui.palette.violet },
  findClubIcon: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: ui.palette.violet, alignItems: 'center', justifyContent: 'center' },
  findClubCopy: { flex: 1, minWidth: 0 },
  findClubTitle: { color: ui.text.primary, fontSize: 18, fontWeight: '900' },
  findClubText: { color: ui.text.secondary, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 4 },
  howToPlay: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 10 },
  howToPlayText: { color: ui.palette.sky, fontSize: 14, fontWeight: '900', textDecorationLine: 'underline' },
});
