// src/screens/ClubScreen.tsx
// Purpose: Club discovery, dashboard, shared goals, rewards, members, announcements, and chat.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, Lock } from 'lucide-react-native';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';
import {
  joinClubSocket,
  onClubAnnouncement,
  onClubChatHistory,
  onClubChatMessage,
  onClubUpdate,
  sendClubChatMessage,
} from '../services/network';

type Props = NativeStackScreenProps<RootStackParamList, 'Club'>;

const COLOR_PAIRS = ['emerald', 'gold', 'sky', 'crimson', 'violet'] as const;
const BADGE_SHAPES = ['shield', 'crest', 'diamond', 'circle'] as const;
const BANNER_STYLES = ['classic', 'night', 'fairway', 'champion'] as const;
const QUICK_CHATS = ['Nice play!', 'Good luck!', 'Huge clear!', 'Good game!'];
const DEFAULT_CLUB_CONFIG: api.ClubEconomyConfig = {
  minJoinLevel: 10,
  minCreateLevel: 10,
  createCost: 5000,
  prestigeTiers: [
    { tier: 1, name: 'Founding Club', treasuryCost: 5000, memberCap: 15, minClubLevel: 1, minMembers: 1, minWeeklyMatches: 0, minSeasonMatches: 0, perks: ['Club tag', 'Club chat', '15 member seats'] },
    { tier: 2, name: 'Growing Club', treasuryCost: 10000, memberCap: 20, minClubLevel: 3, minMembers: 5, minWeeklyMatches: 10, minSeasonMatches: 0, perks: ['20 member seats'] },
  ],
};

const BRAND_COLORS: Record<string, { accent: string; background: string; soft: string }> = {
  emerald: { accent: '#52E5A7', background: '#123B32', soft: '#163C33' },
  gold: { accent: '#FFCC66', background: '#2B2515', soft: '#3A3017' },
  sky: { accent: '#4DA3FF', background: '#102448', soft: '#142E59' },
  crimson: { accent: '#FF6B6B', background: '#331A24', soft: '#44202D' },
  violet: { accent: '#B99CFF', background: '#211B3D', soft: '#2D2551' },
};

export default function ClubScreen({ navigation }: Props) {
  const { token, user, refreshProfile } = useAuth();
  const [club, setClub] = useState<api.ClubProfile | null>(null);
  const [economy, setEconomy] = useState<api.EconomyCatalog | null>(null);
  const [applications, setApplications] = useState<api.ClubApplication[]>([]);
  const [recommended, setRecommended] = useState<api.ClubSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<api.ClubSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [motto, setMotto] = useState('');
  const [branding, setBranding] = useState<api.ClubBranding>({
    colorPair: 'emerald',
    badgeShape: 'shield',
    bannerStyle: 'classic',
  });
  const [announcementText, setAnnouncementText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chat, setChat] = useState<api.ClubChatMessage[]>([]);
  const [donationAmount, setDonationAmount] = useState('500');
  const clubConfig = economy?.clubConfig || DEFAULT_CLUB_CONFIG;

  const loadClub = useCallback(async () => {
    if (!token) return;
    const [response, economyResponse] = await Promise.all([
      api.clubMe(token),
      api.economyCatalog(token),
    ]);
    setEconomy(economyResponse);
    setClub(response.club);
    setApplications(response.applications);
    setRecommended(response.recommended ?? []);
    setChat(response.club?.chat ?? []);
  }, [token]);

  useFocusEffect(useCallback(() => {
    loadClub().catch(() => {
      setClub(null);
      setApplications([]);
      setRecommended([]);
    });
  }, [loadClub]));

  useEffect(() => {
    if (!token || !club) return undefined;
    let cancelled = false;
    joinClubSocket(token, club.clubId)
      .then(response => {
        if (!cancelled) {
          setClub(response.club);
          setChat(response.chat);
        }
      })
      .catch(() => {});
    const unsubHistory = onClubChatHistory(messages => setChat(messages));
    const unsubMessage = onClubChatMessage(message => {
      if (message.clubId !== club.clubId) return;
      setChat(prev => [...prev.filter(item => item.id !== message.id), message].slice(-80));
    });
    const unsubUpdate = onClubUpdate(update => {
      if (update.clubId === club.clubId) loadClub().catch(() => {});
    });
    const unsubAnnouncement = onClubAnnouncement(() => loadClub().catch(() => {}));
    return () => {
      cancelled = true;
      unsubHistory();
      unsubMessage();
      unsubUpdate();
      unsubAnnouncement();
    };
  }, [club?.clubId, loadClub, token]);

  useEffect(() => {
    if (!token || club || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return undefined;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      api.searchClubs(token, searchQuery.trim())
        .then(response => {
          if (!cancelled) setSearchResults(response.clubs);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [club, searchQuery, token]);

  const activeColors = useMemo(() => colorsFor(club?.branding.colorPair || branding.colorPair), [branding.colorPair, club?.branding.colorPair]);

  const runAction = async (id: string, action: () => Promise<void>) => {
    if (busyId || !token) return;
    setBusyId(id);
    try {
      await action();
    } catch (error) {
      Alert.alert('Club update failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const create = () => runAction('create', async () => {
    const response = await api.createClub(token!, { name, tag, motto, branding });
    setClub(response.club);
    setChat(response.club.chat);
    setName('');
    setTag('');
    setMotto('');
    await refreshProfile();
  });

  const donate = (amount: number) => runAction(`donate:${amount}`, async () => {
    if (!club) return;
    const response = await api.donateToClub(token!, club.clubId, amount);
    setClub(response.club);
    await refreshProfile();
  });

  const buyPrestige = () => runAction('prestige', async () => {
    if (!club) return;
    const response = await api.purchaseClubPrestige(token!, club.clubId);
    setClub(response.club);
  });

  const apply = (target: api.ClubSummary) => runAction(`apply:${target.clubId}`, async () => {
    await api.requestJoinClub(token!, target.clubId);
    await loadClub();
  });

  const claimReward = (reward: api.ClubReward) => runAction(`reward:${reward.id}`, async () => {
    const response = await api.claimClubReward(token!, reward.id);
    setClub(response.club);
    await refreshProfile();
  });

  const postAnnouncement = () => runAction('announcement', async () => {
    const response = await api.postClubAnnouncement(token!, club!.clubId, announcementText);
    setClub(response.club);
    setAnnouncementText('');
  });

  const sendChat = (type: api.ClubChatMessage['type'], text: string) => runAction(`chat:${type}:${text}`, async () => {
    if (!club) return;
    const response = await sendClubChatMessage(token!, club.clubId, type, text);
    setChat(prev => [...prev.filter(item => item.id !== response.message.id), response.message].slice(-80));
    if (type === 'text') setChatInput('');
  });

  const acceptRequest = (request: api.ClubJoinRequest) => runAction(`accept:${request.id}`, async () => {
    const response = await api.acceptClubRequest(token!, club!.clubId, request.id);
    setClub(response.club);
  });

  const rejectRequest = (request: api.ClubJoinRequest) => runAction(`reject:${request.id}`, async () => {
    const response = await api.rejectClubRequest(token!, club!.clubId, request.id);
    setClub(response.club);
  });

  const updateRole = (member: api.ClubMember, role: api.ClubRole) => runAction(`role:${member.userId}:${role}`, async () => {
    const response = await api.updateClubMember(token!, club!.clubId, member.userId, role);
    setClub(response.club);
  });

  const removeMember = (member: api.ClubMember) => runAction(`remove:${member.userId}`, async () => {
    const response = await api.removeClubMember(token!, club!.clubId, member.userId);
    setClub(response.club);
  });

  const leave = () => runAction('leave', async () => {
    await api.leaveClub(token!, club!.clubId);
    setClub(null);
    setChat([]);
    await refreshProfile();
    await loadClub();
  });

  return (
    <ScreenShell scroll>
      <ScreenHeader
        eyebrow="Clubs"
        title="Clubhouse"
        subtitle="Build a club, chase goals, and stay connected."
        right={
          <Pressable style={styles.headerIcon} onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color={ui.text.primary} strokeWidth={2.5} />
          </Pressable>
        }
      />
      {club ? <StatusBadge label={`${club.tag} Lv ${club.level}`} tone="gold" style={styles.clubStatus} /> : null}

      {club ? (
        <JoinedClub
          club={club}
          chat={chat}
          activeColors={activeColors}
          busyId={busyId}
          announcementText={announcementText}
          chatInput={chatInput}
          donationAmount={donationAmount}
          viewerCoins={user?.currency.coins || 0}
          setAnnouncementText={setAnnouncementText}
          setChatInput={setChatInput}
          setDonationAmount={setDonationAmount}
          postAnnouncement={postAnnouncement}
          sendChat={sendChat}
          donate={donate}
          buyPrestige={buyPrestige}
          claimReward={claimReward}
          acceptRequest={acceptRequest}
          rejectRequest={rejectRequest}
          updateRole={updateRole}
          removeMember={removeMember}
          leave={leave}
        />
      ) : (
        <NoClub
          applications={applications}
          recommended={recommended}
          searchQuery={searchQuery}
          searchResults={searchResults}
          name={name}
          tag={tag}
          motto={motto}
          branding={branding}
          user={user}
          clubConfig={clubConfig}
          busyId={busyId}
          setSearchQuery={setSearchQuery}
          setName={setName}
          setTag={setTag}
          setMotto={setMotto}
          setBranding={setBranding}
          create={create}
          apply={apply}
        />
      )}
    </ScreenShell>
  );
}

function NoClub({
  applications,
  recommended,
  searchQuery,
  searchResults,
  name,
  tag,
  motto,
  branding,
  user,
  clubConfig,
  busyId,
  setSearchQuery,
  setName,
  setTag,
  setMotto,
  setBranding,
  create,
  apply,
}: {
  applications: api.ClubApplication[];
  recommended: api.ClubSummary[];
  searchQuery: string;
  searchResults: api.ClubSummary[];
  name: string;
  tag: string;
  motto: string;
  branding: api.ClubBranding;
  user: api.UserProfile | null;
  clubConfig: api.ClubEconomyConfig;
  busyId: string | null;
  setSearchQuery: (value: string) => void;
  setName: (value: string) => void;
  setTag: (value: string) => void;
  setMotto: (value: string) => void;
  setBranding: (value: api.ClubBranding) => void;
  create: () => void;
  apply: (club: api.ClubSummary) => void;
}) {
  const clubsToShow = searchQuery.trim().length >= 2 ? searchResults : recommended;
  const level = user?.progression.level || 1;
  const coins = user?.currency.coins || 0;
  const joinLocked = level < clubConfig.minJoinLevel;
  const createLocked = level < clubConfig.minCreateLevel;
  const canAffordCreate = coins >= clubConfig.createCost;
  const clubAccessLevel = Math.max(clubConfig.minJoinLevel, clubConfig.minCreateLevel);
  const sharedLevelRequirement = clubConfig.minJoinLevel === clubConfig.minCreateLevel;
  if (joinLocked) {
    return (
      <Panel title="Clubhouse Locked">
        <Text style={styles.lockTitle}>Reach Level {clubAccessLevel} to unlock clubs.</Text>
        <Text style={styles.metaText}>
          You are Level {level}. Clubs are meant to be earned into, then built with players who are already active at the tables.
        </Text>
        <View style={styles.statGrid}>
          <StatTile
            label={sharedLevelRequirement ? 'Join + Create Clubs' : `Join Lv ${clubConfig.minJoinLevel} / Create Lv ${clubConfig.minCreateLevel}`}
            value={`Lv ${clubAccessLevel}`}
            locked
            style={styles.statTileWide}
          />
          <StatTile label="Your Level" value={`Lv ${level}`} />
          <StatTile label="Create Cost" value={formatCoins(clubConfig.createCost)} dimmed={!canAffordCreate} locked={!canAffordCreate} />
        </View>
      </Panel>
    );
  }
  return (
    <>
      <Panel title="Create Club">
        <View style={styles.costStrip}>
          <Text style={styles.metaText}>Creation cost</Text>
          <Text style={styles.costText}>{formatCoins(clubConfig.createCost)}</Text>
          <Text style={styles.metaText}>Your balance: {formatCoins(coins)}</Text>
        </View>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Club name" placeholderTextColor="#9BA3C7" />
        <TextInput style={styles.input} value={tag} onChangeText={text => setTag(text.toUpperCase())} placeholder="Tag" placeholderTextColor="#9BA3C7" autoCapitalize="characters" maxLength={5} />
        <TextInput style={styles.input} value={motto} onChangeText={setMotto} placeholder="Motto" placeholderTextColor="#9BA3C7" maxLength={80} />
        <PresetRow label="Color" items={COLOR_PAIRS} selected={branding.colorPair} onSelect={colorPair => setBranding({ ...branding, colorPair })} />
        <PresetRow label="Badge" items={BADGE_SHAPES} selected={branding.badgeShape} onSelect={badgeShape => setBranding({ ...branding, badgeShape })} />
        <PresetRow label="Banner" items={BANNER_STYLES} selected={branding.bannerStyle} onSelect={bannerStyle => setBranding({ ...branding, bannerStyle })} />
        {createLocked ? <Text style={styles.warningText}>Reach Level {clubConfig.minCreateLevel} before creating a club.</Text> : null}
        {!canAffordCreate ? <Text style={styles.warningText}>You need {formatCoins(clubConfig.createCost - coins)} more to create a club.</Text> : null}
        <PrimaryButton label={busyId === 'create' ? 'Creating...' : 'Create Club'} disabled={busyId === 'create' || createLocked || !canAffordCreate} onPress={create} />
      </Panel>

      {applications.length ? (
        <Panel title="Pending Applications">
          {applications.map(application => (
            <Text key={application.id} style={styles.metaText}>[{application.club.tag}] {application.club.name}</Text>
          ))}
        </Panel>
      ) : null}

      <Panel title="Find Clubs">
        <TextInput style={styles.input} value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by name or tag" placeholderTextColor="#9BA3C7" />
        {clubsToShow.length ? clubsToShow.map(item => (
          <ClubSearchRow
            key={item.clubId}
            club={item}
            busy={busyId === `apply:${item.clubId}`}
            pending={applications.some(application => application.club.clubId === item.clubId)}
            onApply={() => apply(item)}
          />
        )) : <Empty text="No clubs found yet." />}
      </Panel>
    </>
  );
}

function JoinedClub({
  club,
  chat,
  activeColors,
  busyId,
  announcementText,
  chatInput,
  donationAmount,
  viewerCoins,
  setAnnouncementText,
  setChatInput,
  setDonationAmount,
  postAnnouncement,
  sendChat,
  donate,
  buyPrestige,
  claimReward,
  acceptRequest,
  rejectRequest,
  updateRole,
  removeMember,
  leave,
}: {
  club: api.ClubProfile;
  chat: api.ClubChatMessage[];
  activeColors: { accent: string; background: string; soft: string };
  busyId: string | null;
  announcementText: string;
  chatInput: string;
  donationAmount: string;
  viewerCoins: number;
  setAnnouncementText: (value: string) => void;
  setChatInput: (value: string) => void;
  setDonationAmount: (value: string) => void;
  postAnnouncement: () => void;
  sendChat: (type: api.ClubChatMessage['type'], text: string) => void;
  donate: (amount: number) => void;
  buyPrestige: () => void;
  claimReward: (reward: api.ClubReward) => void;
  acceptRequest: (request: api.ClubJoinRequest) => void;
  rejectRequest: (request: api.ClubJoinRequest) => void;
  updateRole: (member: api.ClubMember, role: api.ClubRole) => void;
  removeMember: (member: api.ClubMember) => void;
  leave: () => void;
}) {
  return (
    <>
      <View style={[styles.banner, { backgroundColor: activeColors.background, borderColor: activeColors.accent }]}>
        <View style={[styles.clubBadge, { borderColor: activeColors.accent, backgroundColor: activeColors.soft }]}>
          <Text style={styles.clubBadgeText}>{club.tag}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
          <Text style={styles.metaText} numberOfLines={2}>{club.motto || 'No motto set yet.'}</Text>
          <Text style={[styles.accentText, { color: activeColors.accent }]}>Level {club.level} - {club.memberCount}/{club.memberCap} members - {club.role}</Text>
        </View>
      </View>

      <Panel title="Club Progress">
        <ProgressBar progress={club.progression.levelProgress} color={activeColors.accent} />
        <Text style={styles.metaText}>{club.progression.currentLevelXp} / {club.progression.nextLevelXp} XP toward Level {club.level + 1}</Text>
      </Panel>

      <Panel title="Club Treasury">
        <View style={styles.statGrid}>
          <StatTile label="Treasury" value={formatCoins(club.treasury.balance)} />
          <StatTile label="Lifetime" value={formatCoins(club.treasury.lifetimeDonated)} />
          <StatTile label="You Donated" value={formatCoins(club.donationStats.viewerDonated)} />
          <StatTile label="Your Coins" value={formatCoins(viewerCoins)} />
        </View>
        <View style={styles.quickRow}>
          {[100, 500, 1000].map(amount => (
            <Pressable key={amount} style={[styles.quickChip, viewerCoins < amount && styles.disabled]} disabled={viewerCoins < amount} onPress={() => donate(amount)}>
              <Text style={styles.quickChipText}>Donate {amount}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inlineForm}>
          <TextInput
            style={[styles.input, styles.inlineInput]}
            value={donationAmount}
            onChangeText={text => setDonationAmount(text.replace(/[^0-9]/g, '').slice(0, 7))}
            placeholder="Amount"
            keyboardType="number-pad"
            placeholderTextColor="#9BA3C7"
          />
          <SmallButton label="Donate" busy={busyId === `donate:${Number(donationAmount || 0)}`} disabled={!Number(donationAmount || 0)} onPress={() => donate(Number(donationAmount || 0))} />
        </View>
        {club.donationStats.topDonors.length ? club.donationStats.topDonors.slice(0, 5).map((donor, index) => (
          <Text key={donor.userId} style={styles.metaText}>{index + 1}. {donor.displayName} - {formatCoins(donor.amount)}</Text>
        )) : <Empty text="No donations yet. Treasury starts with members pitching in." />}
      </Panel>

      <Panel title="Prestige">
        <Text style={styles.rowTitle}>{club.prestige.name} - Tier {club.prestige.tier}</Text>
        <Text style={styles.metaText}>{club.memberCount}/{club.memberCap} member seats unlocked. Purchased perks never decay.</Text>
        {club.nextPrestige ? (
          <>
            <View style={styles.nextPrestigeCard}>
              <Text style={styles.rowTitle}>Next: {club.nextPrestige.name}</Text>
              <Text style={styles.metaText}>{formatCoins(club.nextPrestige.treasuryCost)} treasury cost - {club.nextPrestige.memberCap} member seats</Text>
              {club.nextPrestige.perks.map(perk => <Text key={perk} style={styles.metaText}>+ {perk}</Text>)}
            </View>
            {club.nextPrestige.requirements.map(requirement => (
              <View key={requirement.id} style={styles.requirementRow}>
                <Text style={styles.metaText}>{requirement.complete ? 'Ready' : 'Needed'} - {requirement.label}</Text>
                <Text style={styles.metaText}>{requirement.current}/{requirement.target}</Text>
              </View>
            ))}
            <PrimaryButton label={busyId === 'prestige' ? 'Buying...' : 'Buy Prestige'} disabled={!club.canPrestige || busyId === 'prestige'} onPress={buyPrestige} />
          </>
        ) : <Empty text="This club is already at the highest prestige tier." />}
      </Panel>

      <Panel title="Weekly Goals">
        {club.goals.weekly.map(goal => <GoalRow key={goal.id} goal={goal} color={activeColors.accent} />)}
      </Panel>

      <Panel title="Season Objectives">
        {club.goals.season.map(goal => <GoalRow key={goal.id} goal={goal} color={activeColors.accent} />)}
      </Panel>

      <Panel title="Live Event">
        <Text style={styles.rowTitle}>{club.event.title}</Text>
        <Text style={styles.metaText}>Club score: {club.event.leaderboardScore}</Text>
      </Panel>

      <Panel title="Announcements">
        {club.permissions.canPostAnnouncement ? (
          <View style={styles.inlineForm}>
            <TextInput style={[styles.input, styles.inlineInput]} value={announcementText} onChangeText={setAnnouncementText} placeholder="Post announcement" placeholderTextColor="#9BA3C7" />
            <SmallButton label="Post" busy={busyId === 'announcement'} onPress={postAnnouncement} />
          </View>
        ) : null}
        {club.announcements.length ? club.announcements.slice(0, 5).map(item => (
          <Text key={item.id} style={styles.metaText}>{item.displayName}: {item.text}</Text>
        )) : <Empty text="No announcements yet." />}
      </Panel>

      {club.permissions.canManageRequests ? (
        <Panel title="Join Requests">
          {club.joinRequests.length ? club.joinRequests.map(request => (
            <View key={request.id} style={styles.requestRow}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{request.displayName}</Text>
                <Text style={styles.metaText}>{request.message || 'Wants to join.'}</Text>
              </View>
              <SmallButton label="Accept" busy={busyId === `accept:${request.id}`} onPress={() => acceptRequest(request)} />
              <SmallButton label="Reject" tone="ghost" busy={busyId === `reject:${request.id}`} onPress={() => rejectRequest(request)} />
            </View>
          )) : <Empty text="No pending requests." />}
        </Panel>
      ) : null}

      <Panel title="Club Chat">
        <View style={styles.quickRow}>
          {QUICK_CHATS.map(text => (
            <Pressable key={text} style={styles.quickChip} onPress={() => sendChat('preset', text)}>
              <Text style={styles.quickChipText}>{text}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inlineForm}>
          <TextInput style={[styles.input, styles.inlineInput]} value={chatInput} onChangeText={setChatInput} placeholder="Message club" placeholderTextColor="#9BA3C7" />
          <SmallButton label="Send" busy={busyId === `chat:text:${chatInput}`} onPress={() => sendChat('text', chatInput)} />
        </View>
        {chat.length ? chat.slice(-8).reverse().map(message => (
          <Text key={message.id} style={styles.chatLine}><Text style={styles.chatName}>{message.displayName}: </Text>{message.text}</Text>
        )) : <Empty text="Club chat starts here." />}
      </Panel>

      <Panel title="Rewards">
        {club.rewards.map(reward => (
          <RewardRow key={reward.id} reward={reward} busy={busyId === `reward:${reward.id}`} onClaim={() => claimReward(reward)} />
        ))}
      </Panel>

      <Panel title="Members">
        {club.members.map(member => (
          <MemberRow
            key={member.userId}
            member={member}
            canManage={club.permissions.canManageMembers && member.role !== 'owner' && member.role !== club.role}
            viewerRole={club.role}
            busyId={busyId}
            onRole={role => updateRole(member, role)}
            onRemove={() => removeMember(member)}
          />
        ))}
      </Panel>

      <Pressable style={styles.leaveButton} onPress={leave}>
        <Text style={styles.leaveButtonText}>Leave Club</Text>
      </Pressable>
    </>
  );
}

function ClubSearchRow({ club, busy, pending, onApply }: { club: api.ClubSummary; busy: boolean; pending: boolean; onApply: () => void }) {
  const colors = colorsFor(club.branding.colorPair);
  return (
    <View style={styles.searchRow}>
      <View style={[styles.searchBadge, { borderColor: colors.accent, backgroundColor: colors.background }]}>
        <Text style={styles.searchBadgeText}>{club.tag}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{club.name}</Text>
        <Text style={styles.metaText}>Level {club.level} - Tier {club.prestige?.tier || 1} - {club.memberCount}/{club.memberCap} members</Text>
      </View>
      <SmallButton label={pending ? 'Pending' : 'Apply'} busy={busy} disabled={pending} onPress={onApply} />
    </View>
  );
}

function MemberRow({
  member,
  canManage,
  viewerRole,
  busyId,
  onRole,
  onRemove,
}: {
  member: api.ClubMember;
  canManage: boolean;
  viewerRole: api.ClubRole | null;
  busyId: string | null;
  onRole: (role: api.ClubRole) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.memberRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{member.avatarInitial}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{member.displayName}</Text>
        <Text style={styles.metaText}>{member.role} - {member.contributionXp} club XP - {formatCoins(member.coinContribution || 0)} donated</Text>
      </View>
      {canManage ? (
        <View style={styles.memberActions}>
          {viewerRole === 'owner' ? <SmallButton label="Transfer" busy={busyId === `role:${member.userId}:owner`} onPress={() => onRole('owner')} /> : null}
          {member.role === 'rookie' ? <SmallButton label="Member" busy={busyId === `role:${member.userId}:member`} onPress={() => onRole('member')} /> : null}
          {member.role === 'member' ? <SmallButton label="Officer" busy={busyId === `role:${member.userId}:officer`} onPress={() => onRole('officer')} /> : null}
          {member.role === 'officer' ? <SmallButton label="Member" busy={busyId === `role:${member.userId}:member`} onPress={() => onRole('member')} /> : null}
          <SmallButton label="Remove" tone="danger" busy={busyId === `remove:${member.userId}`} onPress={onRemove} />
        </View>
      ) : null}
    </View>
  );
}

function GoalRow({ goal, color }: { goal: api.ClubGoal; color: string }) {
  return (
    <View style={styles.goalRow}>
      <View style={styles.goalHeader}>
        <Text style={styles.rowTitle}>{goal.title}</Text>
        <Text style={styles.metaText}>{goal.progress}/{goal.target}</Text>
      </View>
      <ProgressBar progress={goal.target ? goal.progress / goal.target : 0} color={goal.complete ? '#52E5A7' : color} />
    </View>
  );
}

function RewardRow({ reward, busy, onClaim }: { reward: api.ClubReward; busy: boolean; onClaim: () => void }) {
  return (
    <View style={styles.rewardRow}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{reward.name}</Text>
        <Text style={styles.metaText}>{reward.description}</Text>
        <Text style={styles.metaText}>Level {reward.minLevel}{reward.minContributionXp ? ` - ${reward.minContributionXp} club XP` : ''}</Text>
      </View>
      <SmallButton
        label={reward.claimed ? 'Claimed' : reward.eligible ? 'Claim' : 'Locked'}
        busy={busy}
        disabled={reward.claimed || !reward.eligible}
        onPress={onClaim}
      />
    </View>
  );
}

function PresetRow<T extends string>({ label, items, selected, onSelect }: { label: string; items: readonly T[]; selected: string; onSelect: (value: T) => void }) {
  return (
    <View style={styles.presetBlock}>
      <Text style={styles.metaText}>{label}</Text>
      <View style={styles.presetRow}>
        {items.map(item => (
          <Pressable key={item} style={[styles.presetChip, selected === item && styles.presetChipActive]} onPress={() => onSelect(item)}>
            <Text style={[styles.presetChipText, selected === item && styles.presetChipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.primaryButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ label, busy, disabled, tone = 'primary', onPress }: { label: string; busy?: boolean; disabled?: boolean; tone?: 'primary' | 'ghost' | 'danger'; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.smallButton, tone === 'ghost' && styles.smallButtonGhost, tone === 'danger' && styles.smallButtonDanger, (busy || disabled) && styles.disabled]}
      disabled={busy || disabled}
      onPress={onPress}
    >
      <Text style={[styles.smallButtonText, tone !== 'primary' && styles.smallButtonGhostText]}>{busy ? '...' : label}</Text>
    </Pressable>
  );
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function StatTile({
  label,
  value,
  dimmed,
  locked,
  style,
}: {
  label: string;
  value: string;
  dimmed?: boolean;
  locked?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.statTile, dimmed && styles.statTileDimmed, style]}>
      <View style={styles.statValueRow}>
        {locked ? <Lock size={13} color={dimmed ? '#687097' : '#9BA3C7'} /> : null}
        <Text style={[styles.statValue, dimmed && styles.statValueDimmed]}>{value}</Text>
      </View>
      <Text style={[styles.statLabel, dimmed && styles.statLabelDimmed]}>{label}</Text>
    </View>
  );
}

function formatCoins(value: number) {
  return `${Math.max(0, Math.floor(Number(value) || 0)).toLocaleString()} coins`;
}

function colorsFor(colorPair?: string) {
  return BRAND_COLORS[colorPair || 'emerald'] || BRAND_COLORS.emerald;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023' },
  content: { padding: 16, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubStatus: { alignSelf: 'flex-start', marginBottom: 12 },
  title: { color: '#E8ECF1', fontSize: 34, fontWeight: '900' },
  subtitle: { color: '#9BA3C7', fontSize: 13, fontWeight: '800', marginTop: 4, maxWidth: 260 },
  backButton: { borderWidth: 1, borderColor: '#2A2F57', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  backText: { color: '#9BA3C7', fontWeight: '900' },
  banner: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  clubBadge: {
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubBadgeText: { color: '#E8ECF1', fontWeight: '900', fontSize: 18 },
  clubName: { color: '#E8ECF1', fontSize: 24, fontWeight: '900' },
  accentText: { fontSize: 12, fontWeight: '900', marginTop: 6 },
  panel: {
    backgroundColor: '#121737',
    borderColor: '#2A2F57',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  panelTitle: { color: '#E8ECF1', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  lockTitle: { color: '#E8ECF1', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  input: {
    backgroundColor: '#0F1430',
    borderColor: '#2A2F57',
    borderWidth: 1,
    borderRadius: 8,
    color: '#E8ECF1',
    fontSize: 15,
    fontWeight: '800',
    padding: 12,
    marginBottom: 10,
  },
  inlineForm: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  inlineInput: { flex: 1, marginBottom: 0 },
  presetBlock: { marginBottom: 10 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  presetChip: { borderWidth: 1, borderColor: '#2A2F57', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  presetChipActive: { backgroundColor: '#52E5A7', borderColor: '#52E5A7' },
  presetChipText: { color: '#E8ECF1', fontWeight: '900', fontSize: 12, textTransform: 'capitalize' },
  presetChipTextActive: { color: '#0B1023' },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#0B1023', fontWeight: '900', fontSize: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#2A2F57' },
  searchBadge: { width: 52, height: 52, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  searchBadgeText: { color: '#E8ECF1', fontWeight: '900', fontSize: 13 },
  rowTitle: { color: '#E8ECF1', fontSize: 15, fontWeight: '900' },
  metaText: { color: '#9BA3C7', fontSize: 12, fontWeight: '800', lineHeight: 18 },
  flex: { flex: 1, minWidth: 0 },
  progressTrack: { height: 10, borderRadius: 8, backgroundColor: '#0F1430', borderWidth: 1, borderColor: '#2A2F57', overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 8 },
  goalRow: { marginBottom: 10 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  quickChip: { borderWidth: 1, borderColor: '#4DA3FF', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 9 },
  quickChipText: { color: '#BFD9FF', fontWeight: '900', fontSize: 12 },
  costStrip: {
    borderWidth: 1,
    borderColor: '#3A3F73',
    borderRadius: 8,
    backgroundColor: '#0F1430',
    padding: 12,
    marginBottom: 10,
  },
  costText: { color: '#FFCC66', fontSize: 22, fontWeight: '900', marginVertical: 2 },
  warningText: { color: '#FF9A9A', fontSize: 12, fontWeight: '900', marginBottom: 8 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  statTile: {
    flexGrow: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#2A2F57',
    borderRadius: 8,
    backgroundColor: '#0F1430',
    padding: 10,
  },
  statTileWide: { width: '100%' },
  statTileDimmed: { opacity: 0.62 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { color: '#E8ECF1', fontSize: 15, fontWeight: '900' },
  statLabel: { color: '#9BA3C7', fontSize: 11, fontWeight: '800', marginTop: 2 },
  statValueDimmed: { color: '#9BA3C7' },
  statLabelDimmed: { color: '#687097' },
  nextPrestigeCard: {
    borderWidth: 1,
    borderColor: '#FFCC66',
    borderRadius: 8,
    backgroundColor: '#2B2515',
    padding: 10,
    marginVertical: 10,
  },
  requirementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#2A2F57',
    paddingVertical: 8,
  },
  chatLine: { color: '#E8ECF1', fontSize: 13, fontWeight: '700', paddingVertical: 4 },
  chatName: { color: '#52E5A7', fontWeight: '900' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#2A2F57' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#2A2F57' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#123B32',
    borderWidth: 2,
    borderColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#E8ECF1', fontWeight: '900', fontSize: 16 },
  memberActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: 180 },
  smallButton: {
    minWidth: 72,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  smallButtonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4DA3FF' },
  smallButtonDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF6B6B' },
  smallButtonText: { color: '#0B1023', fontWeight: '900', fontSize: 12 },
  smallButtonGhostText: { color: '#E8ECF1' },
  emptyText: {
    color: '#9BA3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#0F1430',
    padding: 12,
    fontWeight: '800',
  },
  leaveButton: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  leaveButtonText: { color: '#FF9A9A', fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.45 },
});
