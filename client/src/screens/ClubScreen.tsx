// src/screens/ClubScreen.tsx
// Purpose: Compact club hub with focused chat, progress, treasury, roster, news, and management sheets.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronLeft,
  Clock3,
  Landmark,
  Lock,
  Megaphone,
  MessageCircle,
  Settings2,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import { useClubRealtime } from '../context/ClubRealtimeContext';
import { useAvailability } from '../context/AvailabilityContext';
import { ClubEmblem } from '../components/ClubEmblem';
import * as api from '../services/api';
import { ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Club'>;
type ClubSection = 'chat' | 'progress' | 'treasury' | 'members' | 'news' | 'manage' | null;

const COLOR_PAIRS = ['emerald', 'gold', 'sky', 'crimson', 'violet'] as const;
const BADGE_SHAPES = ['shield', 'crest', 'diamond', 'circle', 'hexagon', 'octagon', 'pennant'] as const;
const BANNER_STYLES = ['classic', 'night', 'fairway', 'champion'] as const;
const BADGE_ICONS = ['shield', 'flag', 'trophy', 'crown', 'star', 'target', 'bolt', 'gem', 'spade', 'club', 'flame', 'swords', 'mountain', 'trees', 'compass', 'rocket'] as const;
const CLUB_COLORS = ['#67E0B0', '#67B7FF', '#F4C95D', '#FF6B6B', '#B99CFF', '#F7FAFC', '#2DD4BF', '#F472B6', '#1A2943', '#205E56', '#294A68', '#2B2515', '#331A24', '#211B3D'] as const;
const DEFAULT_CLUB_CONFIG: api.ClubEconomyConfig = {
  minJoinLevel: 1,
  minCreateLevel: 10,
  createCost: 5000,
  prestigeTiers: [
    { tier: 1, name: 'Founding Club', treasuryCost: 5000, memberCap: 15, minClubLevel: 1, minMembers: 1, minWeeklyMatches: 0, minSeasonMatches: 0, perks: ['Club tag', 'Club chat', '15 member seats'] },
    { tier: 2, name: 'Growing Club', treasuryCost: 10000, memberCap: 20, minClubLevel: 3, minMembers: 5, minWeeklyMatches: 10, minSeasonMatches: 0, perks: ['20 member seats'] },
  ],
};

const BRAND_COLORS: Record<string, { accent: string; background: string; soft: string }> = {
  emerald: { accent: '#67E0B0', background: '#205E56', soft: '#2DD4BF' },
  gold: { accent: '#F4C95D', background: '#2B2515', soft: '#F7FAFC' },
  sky: { accent: '#67B7FF', background: '#294A68', soft: '#2DD4BF' },
  crimson: { accent: '#FF6B6B', background: '#331A24', soft: '#F4C95D' },
  violet: { accent: '#B99CFF', background: '#211B3D', soft: '#F472B6' },
};

export default function ClubScreen({ navigation }: Props) {
  const { token, user, refreshProfile } = useAuth();
  const availability = useAvailability();
  const realtime = useClubRealtime();
  const { club, applications, invitations, recommended } = realtime;
  const [economy, setEconomy] = useState<api.EconomyCatalog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<api.ClubSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ClubSection>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [motto, setMotto] = useState('');
  const [description, setDescription] = useState('');
  const [branding, setBranding] = useState<api.ClubBranding>({
    colorPair: 'emerald',
    badgeShape: 'shield',
    bannerStyle: 'classic',
    badgeIcon: 'shield',
    primaryColor: '#67E0B0',
    backgroundColor: '#205E56',
    accentColor: '#2DD4BF',
  });
  const [announcementText, setAnnouncementText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [donationAmount, setDonationAmount] = useState('500');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editMotto, setEditMotto] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBranding, setEditBranding] = useState<api.ClubBranding>(branding);
  const clubConfig = economy?.clubConfig || DEFAULT_CLUB_CONFIG;

  const load = useCallback(async () => {
    if (!token) return;
    await Promise.all([
      realtime.refresh(),
      api.economyCatalog(token).then(setEconomy),
    ]);
  }, [realtime.refresh, token]);

  useFocusEffect(useCallback(() => {
    void load().catch(() => {});
  }, [load]));

  useEffect(() => {
    if (!club) return;
    setGoalTitle(club.treasuryGoal?.title ?? '');
    setGoalDescription(club.treasuryGoal?.description ?? '');
    setGoalAmount(club.treasuryGoal?.targetAmount ? String(club.treasuryGoal.targetAmount) : '');
    setEditName(club.name);
    setEditTag(club.tag);
    setEditMotto(club.motto);
    setEditDescription(club.description);
    setEditBranding(club.branding);
  }, [club?.clubId, club?.treasuryGoal?.updatedAt, club?.updatedAt]);

  useEffect(() => {
    realtime.setClubChatVisible(activeSection === 'chat');
    return () => realtime.setClubChatVisible(false);
  }, [activeSection, realtime.setClubChatVisible]);

  useEffect(() => {
    const featureKey = activeSection === 'chat'
      ? 'clubs.chat'
      : activeSection === 'treasury'
        ? 'clubs.treasury'
        : activeSection === 'manage'
          ? 'clubs.management'
          : null;
    if (!featureKey || availability.isAvailable(featureKey)) return;
    setActiveSection(null);
    if (availability.isVisible(featureKey)) availability.showUnavailable(featureKey);
  }, [activeSection, availability]);

  useEffect(() => {
    if (club || searchQuery.trim().length < 2 || !token) {
      setSearchResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.searchClubs(token, searchQuery.trim())
        .then(response => { if (!cancelled) setSearchResults(response.clubs); })
        .catch(() => { if (!cancelled) setSearchResults([]); });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [club, searchQuery, token]);

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

  const setClubFrom = (response: { club: api.ClubProfile }) => realtime.replaceClub(response.club);

  const create = () => runAction('create', async () => {
    const response = await api.createClub(token!, { name, tag, motto, description, branding });
    setClubFrom(response);
    setName('');
    setTag('');
    setMotto('');
    setDescription('');
    await refreshProfile();
    await realtime.refresh();
  });

  const apply = (target: api.ClubSummary) => runAction(`apply:${target.clubId}`, async () => {
    await api.requestJoinClub(token!, target.clubId);
    await realtime.refresh();
  });

  const acceptInvitation = (invitation: api.ClubInvitation) => runAction(`invite:${invitation.id}:accept`, async () => {
    await realtime.acceptInvitation(invitation);
  });

  const declineInvitation = (invitation: api.ClubInvitation) => runAction(`invite:${invitation.id}:decline`, async () => {
    await realtime.declineInvitation(invitation);
  });

  const donate = (amount: number) => runAction(`donate:${amount}`, async () => {
    if (!availability.isAvailable('clubs.treasury')) {
      availability.showUnavailable('clubs.treasury');
      return;
    }
    if (!club) return;
    setClubFrom(await api.donateToClub(token!, club.clubId, amount));
    await refreshProfile();
  });

  const buyPrestige = () => runAction('prestige', async () => {
    if (!availability.isAvailable('clubs.treasury')) {
      availability.showUnavailable('clubs.treasury');
      return;
    }
    if (!club) return;
    setClubFrom(await api.purchaseClubPrestige(token!, club.clubId));
  });

  const saveGoal = () => runAction('goal:save', async () => {
    if (!availability.isAvailable('clubs.treasury')) {
      availability.showUnavailable('clubs.treasury');
      return;
    }
    if (!club) return;
    setClubFrom(await api.updateClubTreasuryGoal(token!, club.clubId, {
      title: goalTitle,
      description: goalDescription,
      targetAmount: Number(goalAmount),
    }));
  });

  const clearGoal = () => runAction('goal:clear', async () => {
    if (!availability.isAvailable('clubs.treasury')) {
      availability.showUnavailable('clubs.treasury');
      return;
    }
    if (!club) return;
    setClubFrom(await api.clearClubTreasuryGoal(token!, club.clubId));
  });

  const postAnnouncement = () => runAction('announcement', async () => {
    if (!availability.isAvailable('clubs.management')) {
      availability.showUnavailable('clubs.management');
      return;
    }
    if (!club || !announcementText.trim()) return;
    setClubFrom(await api.postClubAnnouncement(token!, club.clubId, announcementText));
    setAnnouncementText('');
  });

  const sendChat = () => runAction('chat', async () => {
    if (!availability.isAvailable('clubs.chat')) {
      availability.showUnavailable('clubs.chat');
      return;
    }
    await realtime.sendClubMessage(chatInput);
    setChatInput('');
  });

  const acceptRequest = (request: api.ClubJoinRequest) => runAction(`accept:${request.id}`, async () => {
    if (!availability.isAvailable('clubs.management')) {
      availability.showUnavailable('clubs.management');
      return;
    }
    if (!club) return;
    setClubFrom(await api.acceptClubRequest(token!, club.clubId, request.id));
  });

  const rejectRequest = (request: api.ClubJoinRequest) => runAction(`reject:${request.id}`, async () => {
    if (!availability.isAvailable('clubs.management')) {
      availability.showUnavailable('clubs.management');
      return;
    }
    if (!club) return;
    setClubFrom(await api.rejectClubRequest(token!, club.clubId, request.id));
  });

  const updateRole = (member: api.ClubMember, role: api.ClubRole) => runAction(`role:${member.userId}:${role}`, async () => {
    if (!availability.isAvailable('clubs.management')) {
      availability.showUnavailable('clubs.management');
      return;
    }
    if (!club) return;
    setClubFrom(await api.updateClubMember(token!, club.clubId, member.userId, role));
  });

  const removeMember = (member: api.ClubMember) => runAction(`remove:${member.userId}`, async () => {
    if (!availability.isAvailable('clubs.management')) {
      availability.showUnavailable('clubs.management');
      return;
    }
    if (!club) return;
    setClubFrom(await api.removeClubMember(token!, club.clubId, member.userId));
  });

  const updateIdentity = () => runAction('identity', async () => {
    if (!availability.isAvailable('clubs.management')) {
      availability.showUnavailable('clubs.management');
      return;
    }
    if (!club) return;
    setClubFrom(await api.updateClub(token!, club.clubId, {
      name: editName,
      tag: editTag,
      motto: editMotto,
      description: editDescription,
      branding: editBranding,
    }));
  });

  const leave = () => runAction('leave', async () => {
    if (!club) return;
    await api.leaveClub(token!, club.clubId);
    realtime.replaceClub(null);
    setActiveSection(null);
    await refreshProfile();
    await realtime.refresh();
  });

  const activeColors = useMemo(() => colorsForBranding(club?.branding || branding), [branding, club?.branding]);

  return (
    <ScreenShell scroll>
      {club ? (
        <JoinedClub
          club={club}
          messages={realtime.chatMessages}
          unread={realtime.clubChatUnread}
          activeColors={activeColors}
          activeSection={activeSection}
          busyId={busyId}
          viewerCoins={user?.currency.coins ?? 0}
          chatInput={chatInput}
          announcementText={announcementText}
          donationAmount={donationAmount}
          goalTitle={goalTitle}
          goalDescription={goalDescription}
          goalAmount={goalAmount}
          editName={editName}
          editTag={editTag}
          editMotto={editMotto}
          editDescription={editDescription}
          editBranding={editBranding}
          setActiveSection={setActiveSection}
          setChatInput={setChatInput}
          setAnnouncementText={setAnnouncementText}
          setDonationAmount={setDonationAmount}
          setGoalTitle={setGoalTitle}
          setGoalDescription={setGoalDescription}
          setGoalAmount={setGoalAmount}
          setEditName={setEditName}
          setEditTag={setEditTag}
          setEditMotto={setEditMotto}
          setEditDescription={setEditDescription}
          setEditBranding={setEditBranding}
          goBack={() => navigation.goBack()}
          sendChat={sendChat}
          donate={donate}
          buyPrestige={buyPrestige}
          saveGoal={saveGoal}
          clearGoal={clearGoal}
          postAnnouncement={postAnnouncement}
          acceptRequest={acceptRequest}
          rejectRequest={rejectRequest}
          updateRole={updateRole}
          removeMember={removeMember}
          updateIdentity={updateIdentity}
          leave={leave}
        />
      ) : (
        <>
          <ScreenHeader
            eyebrow="Clubs"
            title="Clubhouse"
            subtitle={`Join from Level 1. Create your own at Level ${clubConfig.minCreateLevel}.`}
            right={<BackButton onPress={() => navigation.goBack()} />}
          />
          <NoClub
            applications={applications}
            invitations={invitations}
            recommended={recommended}
            searchQuery={searchQuery}
            searchResults={searchResults}
            name={name}
            tag={tag}
            motto={motto}
            description={description}
            branding={branding}
            user={user}
            clubConfig={clubConfig}
            busyId={busyId}
            setSearchQuery={setSearchQuery}
            setName={setName}
            setTag={setTag}
            setMotto={setMotto}
            setDescription={setDescription}
            setBranding={setBranding}
            create={create}
            apply={apply}
            acceptInvitation={acceptInvitation}
            declineInvitation={declineInvitation}
          />
        </>
      )}
    </ScreenShell>
  );
}

function JoinedClub(props: {
  club: api.ClubProfile;
  messages: api.ClubChatMessage[];
  unread: number;
  activeColors: { accent: string; background: string; soft: string };
  activeSection: ClubSection;
  busyId: string | null;
  viewerCoins: number;
  chatInput: string;
  announcementText: string;
  donationAmount: string;
  goalTitle: string;
  goalDescription: string;
  goalAmount: string;
  editName: string;
  editTag: string;
  editMotto: string;
  editDescription: string;
  editBranding: api.ClubBranding;
  setActiveSection: (section: ClubSection) => void;
  setChatInput: (value: string) => void;
  setAnnouncementText: (value: string) => void;
  setDonationAmount: (value: string) => void;
  setGoalTitle: (value: string) => void;
  setGoalDescription: (value: string) => void;
  setGoalAmount: (value: string) => void;
  setEditName: (value: string) => void;
  setEditTag: (value: string) => void;
  setEditMotto: (value: string) => void;
  setEditDescription: (value: string) => void;
  setEditBranding: (value: api.ClubBranding) => void;
  goBack: () => void;
  sendChat: () => void;
  donate: (amount: number) => void;
  buyPrestige: () => void;
  saveGoal: () => void;
  clearGoal: () => void;
  postAnnouncement: () => void;
  acceptRequest: (request: api.ClubJoinRequest) => void;
  rejectRequest: (request: api.ClubJoinRequest) => void;
  updateRole: (member: api.ClubMember, role: api.ClubRole) => void;
  removeMember: (member: api.ClubMember) => void;
  updateIdentity: () => void;
  leave: () => void;
}) {
  const { club, activeColors } = props;
  const availability = useAvailability();
  const canManage = club.permissions.canManageRequests || club.permissions.canEdit;
  const latestAnnouncement = club.announcements[0];
  const nextReward = club.rewards.find(reward => !reward.claimed);
  const openFeatureSection = (section: Exclude<ClubSection, null>, featureKey?: 'clubs.chat' | 'clubs.treasury' | 'clubs.management') => {
    if (featureKey && !availability.isAvailable(featureKey)) {
      availability.showUnavailable(featureKey);
      return;
    }
    props.setActiveSection(section);
  };
  const chatEntry = availability.entry('clubs.chat');
  const treasuryEntry = availability.entry('clubs.treasury');
  const managementEntry = availability.entry('clubs.management');
  return (
    <>
      <View style={[styles.clubHero, { backgroundColor: activeColors.background, borderColor: activeColors.accent }]}>
        <BackButton onPress={props.goBack} style={styles.heroBack} />
        <ClubEmblem branding={club.branding} tag={club.tag} size={72} showTag />
        <View style={styles.flex}>
          <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
          <Text style={styles.heroMotto} numberOfLines={1}>{club.motto || 'Playing lower together.'}</Text>
          <View style={styles.heroMetaRow}>
            <Text style={[styles.heroMeta, { color: activeColors.accent }]}>Lv {club.level}</Text>
            <Text style={styles.heroMeta}>{club.memberCount}/{club.memberCap} members</Text>
            <Text style={styles.heroMeta}>{club.onlineMemberCount} online</Text>
          </View>
          <ProgressBar progress={club.progression.levelProgress} color={activeColors.accent} />
          <Text style={styles.heroProgress}>{club.progression.currentLevelXp}/{club.progression.nextLevelXp} XP - {club.prestige.name} - {capitalize(club.role || 'member')}</Text>
        </View>
      </View>

      <View style={styles.actionGrid}>
        {availability.isVisible('clubs.chat') ? <HubAction title="Chat" detail={chatEntry.state === 'live' ? 'Live club conversation' : (chatEntry.title || 'Unavailable')} Icon={MessageCircle} accent={activeColors.accent} badge={props.unread} locked={chatEntry.state !== 'live'} testerPreview={chatEntry.testerPreview} onPress={() => openFeatureSection('chat', 'clubs.chat')} /> : null}
        <HubAction title="Progress" detail={nextReward ? `Next: ${nextReward.name}` : 'All rewards earned'} Icon={Target} accent="#67B7FF" onPress={() => props.setActiveSection('progress')} />
        {availability.isVisible('clubs.treasury') ? <HubAction title="Treasury" detail={treasuryEntry.state === 'live' ? `${formatCoins(club.treasury.balance)} available` : (treasuryEntry.title || 'Unavailable')} Icon={Landmark} accent={ui.palette.gold} locked={treasuryEntry.state !== 'live'} testerPreview={treasuryEntry.testerPreview} onPress={() => openFeatureSection('treasury', 'clubs.treasury')} /> : null}
        <HubAction title="Members" detail={`${club.onlineMemberCount} online now`} Icon={Users} accent="#B99CFF" onPress={() => props.setActiveSection('members')} />
        <HubAction title="News" detail={latestAnnouncement?.text || club.event.title} Icon={Megaphone} accent="#FF8D8D" onPress={() => props.setActiveSection('news')} />
        {canManage && availability.isVisible('clubs.management') ? <HubAction title="Manage" detail={managementEntry.state === 'live' ? `${club.joinRequests.length} join request${club.joinRequests.length === 1 ? '' : 's'}` : (managementEntry.title || 'Unavailable')} Icon={Settings2} accent="#F7FAFC" badge={club.joinRequests.length} locked={managementEntry.state !== 'live'} testerPreview={managementEntry.testerPreview} onPress={() => openFeatureSection('manage', 'clubs.management')} /> : null}
      </View>

      <View style={styles.hubBand}>
        <View style={styles.hubBandIcon}><Trophy size={24} color={ui.palette.gold} /></View>
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{club.event.title}</Text>
          <Text style={styles.metaText}>Live event score: {club.event.leaderboardScore}</Text>
        </View>
        <StatusBadge label={`Tier ${club.prestige.tier}`} tone="gold" />
      </View>

      <ClubSheet title="Club Chat" subtitle="Live while you are online" visible={props.activeSection === 'chat'} onClose={() => props.setActiveSection(null)}>
        <ChatSection messages={props.messages} input={props.chatInput} busy={props.busyId === 'chat'} setInput={props.setChatInput} send={props.sendChat} />
      </ClubSheet>

      <ClubSheet title="Club Progress" subtitle="Goals, event progress, and the reward journey" visible={props.activeSection === 'progress'} onClose={() => props.setActiveSection(null)}>
        <ProgressSection club={club} accent={activeColors.accent} />
      </ClubSheet>

      <ClubSheet title="Treasury" subtitle="Fund prestige and shared club goals" visible={props.activeSection === 'treasury'} onClose={() => props.setActiveSection(null)}>
        <TreasurySection {...props} />
      </ClubSheet>

      <ClubSheet title="Members" subtitle={`${club.memberCount} members - ${club.onlineMemberCount} online`} visible={props.activeSection === 'members'} onClose={() => props.setActiveSection(null)}>
        <MembersSection {...props} />
      </ClubSheet>

      <ClubSheet title="Club News" subtitle="Announcements and the current live event" visible={props.activeSection === 'news'} onClose={() => props.setActiveSection(null)}>
        <NewsSection club={club} />
      </ClubSheet>

      <ClubSheet title="Manage Club" subtitle="Owner and officer controls" visible={props.activeSection === 'manage'} onClose={() => props.setActiveSection(null)}>
        <ManageSection {...props} />
      </ClubSheet>
    </>
  );
}

function ChatSection({ messages, input, busy, setInput, send }: { messages: api.ClubChatMessage[]; input: string; busy: boolean; setInput: (value: string) => void; send: () => void }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.messageList}>
        {messages.length ? messages.map(message => (
          <View key={message.id} style={styles.messageRow}>
            <Text style={styles.chatName}>{message.displayName}</Text>
            <Text style={styles.chatText}>{message.text}</Text>
          </View>
        )) : <Empty text="Club chat is live. Messages appear here while you are online." />}
      </View>
      <View style={styles.inlineForm}>
        <TextInput
          style={[styles.input, styles.inlineInput]}
          value={input}
          onChangeText={setInput}
          placeholder="Message your club"
          placeholderTextColor={ui.text.muted}
          maxLength={160}
          multiline
        />
        <SmallButton label="Send" busy={busy} disabled={!input.trim()} onPress={send} />
      </View>
      <Text style={styles.helperText}>{input.length}/160 - Live messages are not saved after the session.</Text>
    </KeyboardAvoidingView>
  );
}

function ProgressSection({ club, accent }: { club: api.ClubProfile; accent: string }) {
  const nextIndexRaw = club.rewards.findIndex(reward => !reward.claimed);
  const nextIndex = nextIndexRaw < 0 ? Math.max(0, club.rewards.length - 1) : nextIndexRaw;
  return (
    <>
      <SectionBlock title={`Club Level ${club.level}`}>
        <ProgressBar progress={club.progression.levelProgress} color={accent} />
        <Text style={styles.metaText}>{club.progression.currentLevelXp} / {club.progression.nextLevelXp} XP toward Level {club.level + 1}</Text>
      </SectionBlock>
      <SectionBlock title="Reward Journey">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: Math.max(0, nextIndex * 202 - 12), y: 0 }}
          contentContainerStyle={styles.rewardRail}
        >
          {club.rewards.map((reward, index) => {
            const status = reward.claimed ? 'Earned' : index === nextIndex ? 'Next' : 'Locked';
            return (
              <View key={reward.id} style={[styles.rewardCard, status === 'Next' && styles.rewardCardNext, status === 'Earned' && styles.rewardCardEarned]}>
                <Text style={styles.rewardScope}>{reward.scope === 'club' ? 'CLUB UNLOCK' : 'YOUR REWARD'}</Text>
                <Text style={styles.rewardName}>{reward.name}</Text>
                <Text style={styles.rewardDescription}>{reward.description}</Text>
                <StatusBadge label={status} tone={status === 'Earned' ? 'emerald' : status === 'Next' ? 'gold' : 'muted'} />
                <Text style={styles.rewardRequirement}>Club Lv {reward.minLevel}{reward.minContributionXp ? ` - ${reward.minContributionXp} contribution XP` : ''}</Text>
              </View>
            );
          })}
        </ScrollView>
      </SectionBlock>
      <SectionBlock title="Weekly Goals">
        {club.goals.weekly.map(goal => <GoalRow key={goal.id} goal={goal} color={accent} />)}
      </SectionBlock>
      <SectionBlock title="Season Objectives">
        {club.goals.season.map(goal => <GoalRow key={goal.id} goal={goal} color={accent} />)}
      </SectionBlock>
      <SectionBlock title="Live Event">
        <Text style={styles.rowTitle}>{club.event.title}</Text>
        <Text style={styles.metaText}>Club score: {club.event.leaderboardScore}</Text>
      </SectionBlock>
    </>
  );
}

function TreasurySection(props: Parameters<typeof JoinedClub>[0]) {
  const club = props.club;
  const customGoalProgress = club.treasuryGoal ? club.treasury.balance / Math.max(1, club.treasuryGoal.targetAmount) : 0;
  return (
    <>
      <SectionBlock title="Next Prestige">
        {club.nextPrestige ? (
          <>
            <View style={styles.prestigeHeader}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{club.nextPrestige.name}</Text>
                <Text style={styles.metaText}>{club.nextPrestige.memberCap} member seats and new club perks</Text>
              </View>
              <StatusBadge label={formatCoins(club.nextPrestige.treasuryCost)} tone="gold" />
            </View>
            <ProgressBar progress={club.treasury.balance / Math.max(1, club.nextPrestige.treasuryCost)} color={ui.palette.gold} />
            <Text style={styles.metaText}>{formatCoins(club.treasury.balance)} funded - {formatCoins(club.nextPrestige.treasuryNeeded)} still needed</Text>
            {club.nextPrestige.requirements.map(requirement => (
              <View key={requirement.id} style={styles.requirementRow}>
                {requirement.complete ? <Check size={16} color={ui.palette.emerald} /> : <Clock3 size={16} color={ui.text.muted} />}
                <Text style={styles.metaText}>{requirement.label}</Text>
                <Text style={styles.metaText}>{requirement.current}/{requirement.target}</Text>
              </View>
            ))}
            {club.permissions.canManageRequests ? <PrimaryButton label={props.busyId === 'prestige' ? 'Purchasing...' : 'Purchase Prestige'} disabled={!club.canPrestige || props.busyId === 'prestige'} onPress={props.buyPrestige} /> : null}
          </>
        ) : <Empty text="This club has reached the highest prestige tier." />}
      </SectionBlock>

      <SectionBlock title="Club Goal">
        {club.treasuryGoal ? (
          <>
            <Text style={styles.rowTitle}>{club.treasuryGoal.title}</Text>
            {club.treasuryGoal.description ? <Text style={styles.metaText}>{club.treasuryGoal.description}</Text> : null}
            <ProgressBar progress={customGoalProgress} color="#67B7FF" />
            <Text style={styles.metaText}>{formatCoins(club.treasury.balance)} / {formatCoins(club.treasuryGoal.targetAmount)}</Text>
          </>
        ) : <Empty text="No optional club goal is set. Donations still fund the next prestige." />}
        {club.permissions.canManageRequests ? (
          <View style={styles.formStack}>
            <TextInput style={styles.input} value={props.goalTitle} onChangeText={props.setGoalTitle} placeholder="Goal name" placeholderTextColor={ui.text.muted} maxLength={60} />
            <TextInput style={styles.input} value={props.goalDescription} onChangeText={props.setGoalDescription} placeholder="What is the club funding?" placeholderTextColor={ui.text.muted} maxLength={180} />
            <TextInput style={styles.input} value={props.goalAmount} onChangeText={text => props.setGoalAmount(text.replace(/[^0-9]/g, '').slice(0, 9))} placeholder="Coin target" placeholderTextColor={ui.text.muted} keyboardType="number-pad" />
            <View style={styles.buttonRow}>
              <SmallButton label="Save Goal" busy={props.busyId === 'goal:save'} disabled={!props.goalTitle.trim() || !Number(props.goalAmount)} onPress={props.saveGoal} />
              {club.treasuryGoal ? <SmallButton label="Clear" tone="ghost" busy={props.busyId === 'goal:clear'} onPress={props.clearGoal} /> : null}
            </View>
          </View>
        ) : null}
      </SectionBlock>

      <SectionBlock title="Donate Coins">
        <View style={styles.statGrid}>
          <StatTile label="Treasury" value={formatCoins(club.treasury.balance)} />
          <StatTile label="You Donated" value={formatCoins(club.donationStats.viewerDonated)} />
          <StatTile label="Your Coins" value={formatCoins(props.viewerCoins)} />
          <StatTile label="Lifetime" value={formatCoins(club.treasury.lifetimeDonated)} />
        </View>
        <View style={styles.quickRow}>
          {[100, 500, 1000].map(amount => (
            <Pressable key={amount} style={[styles.quickChip, props.viewerCoins < amount && styles.disabled]} disabled={props.viewerCoins < amount} onPress={() => props.donate(amount)}>
              <Text style={styles.quickChipText}>{amount.toLocaleString()}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inlineForm}>
          <TextInput style={[styles.input, styles.inlineInput]} value={props.donationAmount} onChangeText={text => props.setDonationAmount(text.replace(/[^0-9]/g, '').slice(0, 7))} placeholder="Custom amount" keyboardType="number-pad" placeholderTextColor={ui.text.muted} />
          <SmallButton label="Donate" busy={props.busyId === `donate:${Number(props.donationAmount || 0)}`} disabled={!Number(props.donationAmount || 0) || Number(props.donationAmount) > props.viewerCoins} onPress={() => props.donate(Number(props.donationAmount || 0))} />
        </View>
      </SectionBlock>

      <SectionBlock title="Top Donors">
        {club.donationStats.topDonors.length ? club.donationStats.topDonors.map((donor, index) => (
          <View key={donor.userId} style={styles.listRow}>
            <Text style={styles.listIndex}>{index + 1}</Text>
            <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>{donor.displayName}</Text>
            <Text style={styles.coinText}>{formatCoins(donor.amount)}</Text>
          </View>
        )) : <Empty text="No donations yet." />}
      </SectionBlock>

      <SectionBlock title="Recent Donations">
        {club.donationStats.recent.length ? club.donationStats.recent.map(donation => (
          <View key={donation.id} style={styles.listRow}>
            <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>{donation.displayName}</Text>
            <View style={styles.memberActions}>
              <Text style={styles.coinText}>{formatCoins(donation.amount)}</Text>
              <Text style={styles.helperText}>{new Date(donation.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>
        )) : <Empty text="No recent donations." />}
      </SectionBlock>
    </>
  );
}

function MembersSection(props: Parameters<typeof JoinedClub>[0]) {
  const club = props.club;
  return (
    <>
      <SectionBlock title="Roster">
        {club.members.map(member => (
          <View key={member.userId} style={styles.memberRow}>
            <View style={[styles.onlineDot, !member.isOnline && styles.offlineDot]} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={1}>{member.displayName}</Text>
              <Text style={styles.metaText}>{capitalize(member.role)} - {member.contributionXp} XP - {formatCoins(member.coinContribution)} donated</Text>
            </View>
            {club.permissions.canManageMembers && member.role !== 'owner' && member.role !== club.role ? (
              <View style={styles.memberActions}>
                {club.role === 'owner' ? <SmallButton label={member.role === 'officer' ? 'Member' : 'Officer'} onPress={() => props.updateRole(member, member.role === 'officer' ? 'member' : 'officer')} /> : null}
                <SmallButton label="Remove" tone="ghost" busy={props.busyId === `remove:${member.userId}`} onPress={() => props.removeMember(member)} />
              </View>
            ) : null}
          </View>
        ))}
      </SectionBlock>
      <Pressable style={styles.leaveButton} onPress={props.leave}>
        <Text style={styles.leaveButtonText}>{props.busyId === 'leave' ? 'Leaving...' : 'Leave Club'}</Text>
      </Pressable>
    </>
  );
}

function NewsSection({ club }: { club: api.ClubProfile }) {
  return (
    <>
      <SectionBlock title="About">
        <Text style={styles.chatText}>{club.description || club.motto || 'This club has not added a description yet.'}</Text>
      </SectionBlock>
      <SectionBlock title="Live Event">
        <Text style={styles.rowTitle}>{club.event.title}</Text>
        <Text style={styles.metaText}>Club score: {club.event.leaderboardScore}</Text>
      </SectionBlock>
      <SectionBlock title="Announcements">
        {club.announcements.length ? club.announcements.slice(0, 1).map(item => (
          <View key={item.id} style={styles.announcementRow}>
            <Text style={styles.chatName}>{item.displayName}</Text>
            <Text style={styles.chatText}>{item.text}</Text>
            <Text style={styles.helperText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        )) : <Empty text="No club announcements yet." />}
      </SectionBlock>
    </>
  );
}

function ManageSection(props: Parameters<typeof JoinedClub>[0]) {
  const club = props.club;
  return (
    <>
      {club.permissions.canPostAnnouncement ? (
        <SectionBlock title="Update Announcement">
          <Text style={styles.metaText}>Your club keeps one current announcement. Posting replaces the previous one.</Text>
          <View style={styles.inlineForm}>
            <TextInput style={[styles.input, styles.inlineInput]} value={props.announcementText} onChangeText={props.setAnnouncementText} placeholder="Announcement" placeholderTextColor={ui.text.muted} maxLength={160} />
            <SmallButton label="Post" busy={props.busyId === 'announcement'} disabled={!props.announcementText.trim()} onPress={props.postAnnouncement} />
          </View>
        </SectionBlock>
      ) : null}
      {club.permissions.canManageRequests ? (
        <SectionBlock title={`Join Requests (${club.joinRequests.length})`}>
          {club.joinRequests.length ? club.joinRequests.map(request => (
            <View key={request.id} style={styles.requestRow}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{request.displayName}</Text>
                <Text style={styles.metaText}>{request.message || 'Wants to join.'}</Text>
              </View>
              <SmallButton label="Accept" busy={props.busyId === `accept:${request.id}`} onPress={() => props.acceptRequest(request)} />
              <SmallButton label="Reject" tone="ghost" busy={props.busyId === `reject:${request.id}`} onPress={() => props.rejectRequest(request)} />
            </View>
          )) : <Empty text="No pending requests." />}
        </SectionBlock>
      ) : null}
      {club.permissions.canEdit ? (
        <SectionBlock title="Club Identity">
          <TextInput style={styles.input} value={props.editName} onChangeText={props.setEditName} placeholder="Club name" placeholderTextColor={ui.text.muted} maxLength={28} />
          <TextInput style={styles.input} value={props.editTag} onChangeText={text => props.setEditTag(sanitizeClubTag(text))} placeholder="Tag (1-4 letters)" placeholderTextColor={ui.text.muted} maxLength={4} autoCapitalize="characters" />
          <TextInput style={styles.input} value={props.editMotto} onChangeText={props.setEditMotto} placeholder="Motto" placeholderTextColor={ui.text.muted} maxLength={80} />
          <TextInput style={[styles.input, styles.descriptionInput]} value={props.editDescription} onChangeText={props.setEditDescription} placeholder="Club description" placeholderTextColor={ui.text.muted} maxLength={250} multiline />
          <Text style={styles.helperText}>{props.editDescription.length}/250</Text>
          <ClubBrandingEditor tag={props.editTag} branding={props.editBranding} setBranding={props.setEditBranding} />
          <PrimaryButton label={props.busyId === 'identity' ? 'Saving...' : 'Save Club Identity'} disabled={props.busyId === 'identity'} onPress={props.updateIdentity} />
        </SectionBlock>
      ) : null}
    </>
  );
}

function NoClub(props: {
  applications: api.ClubApplication[];
  invitations: api.ClubInvitation[];
  recommended: api.ClubSummary[];
  searchQuery: string;
  searchResults: api.ClubSummary[];
  name: string;
  tag: string;
  motto: string;
  description: string;
  branding: api.ClubBranding;
  user: api.UserProfile | null;
  clubConfig: api.ClubEconomyConfig;
  busyId: string | null;
  setSearchQuery: (value: string) => void;
  setName: (value: string) => void;
  setTag: (value: string) => void;
  setMotto: (value: string) => void;
  setDescription: (value: string) => void;
  setBranding: (value: api.ClubBranding) => void;
  create: () => void;
  apply: (club: api.ClubSummary) => void;
  acceptInvitation: (invitation: api.ClubInvitation) => void;
  declineInvitation: (invitation: api.ClubInvitation) => void;
}) {
  const level = props.user?.progression.level || 1;
  const coins = props.user?.currency.coins || 0;
  const createLocked = level < props.clubConfig.minCreateLevel;
  const canAffordCreate = coins >= props.clubConfig.createCost;
  const clubsToShow = props.searchQuery.trim().length >= 2 ? props.searchResults : props.recommended;

  return (
    <>
      {props.invitations.length ? (
        <Panel title="Club Invitations">
          {props.invitations.map(invitation => (
            <View key={invitation.id} style={styles.invitationRow}>
              <ClubEmblem branding={invitation.club.branding} tag={invitation.club.tag} size={42} />
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>[{invitation.club.tag}] {invitation.club.name}</Text>
                <Text style={styles.metaText}>Invited by {invitation.fromDisplayName} - {invitation.club.memberCount}/{invitation.club.memberCap} members</Text>
              </View>
              <SmallButton label="Join" busy={props.busyId === `invite:${invitation.id}:accept`} onPress={() => props.acceptInvitation(invitation)} />
              <SmallButton label="Decline" tone="ghost" busy={props.busyId === `invite:${invitation.id}:decline`} onPress={() => props.declineInvitation(invitation)} />
            </View>
          ))}
        </Panel>
      ) : null}
      {props.applications.length ? (
        <Panel title="Pending Applications">
          {props.applications.map(application => <Text key={application.id} style={styles.metaText}>[{application.club.tag}] {application.club.name}</Text>)}
        </Panel>
      ) : null}
      <Panel title="Join a Club">
        <Text style={styles.metaText}>Club membership is open at every level.</Text>
        <TextInput style={styles.input} value={props.searchQuery} onChangeText={props.setSearchQuery} placeholder="Search by name or tag" placeholderTextColor={ui.text.muted} />
        {clubsToShow.length ? clubsToShow.map(item => (
          <View key={item.clubId} style={styles.searchRow}>
            <ClubEmblem branding={item.branding} tag={item.tag} size={50} showTag />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              {item.description ? <Text style={styles.metaText} numberOfLines={2}>{item.description}</Text> : null}
              <Text style={styles.metaText}>Lv {item.level} - {item.memberCount}/{item.memberCap} members - {item.onlineMemberCount} online</Text>
            </View>
            <SmallButton label={props.applications.some(application => application.club.clubId === item.clubId) ? 'Pending' : 'Apply'} disabled={props.applications.some(application => application.club.clubId === item.clubId)} busy={props.busyId === `apply:${item.clubId}`} onPress={() => props.apply(item)} />
          </View>
        )) : <Empty text="No clubs found yet." />}
      </Panel>
      <Panel title="Create Club">
        {createLocked ? (
          <View style={styles.lockStrip}>
            <Lock size={20} color={ui.text.muted} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Creation unlocks at Level {props.clubConfig.minCreateLevel}</Text>
              <Text style={styles.metaText}>You can still join any club now. You are Level {level}.</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.costStrip}>
          <Text style={styles.metaText}>Creation cost</Text>
          <Text style={styles.costText}>{formatCoins(props.clubConfig.createCost)}</Text>
          <Text style={styles.metaText}>Your balance: {formatCoins(coins)}</Text>
        </View>
        <TextInput style={styles.input} value={props.name} onChangeText={props.setName} placeholder="Club name" placeholderTextColor={ui.text.muted} />
        <TextInput style={styles.input} value={props.tag} onChangeText={text => props.setTag(sanitizeClubTag(text))} placeholder="Tag (1-4 letters)" placeholderTextColor={ui.text.muted} autoCapitalize="characters" maxLength={4} />
        <TextInput style={styles.input} value={props.motto} onChangeText={props.setMotto} placeholder="Motto" placeholderTextColor={ui.text.muted} maxLength={80} />
        <TextInput style={[styles.input, styles.descriptionInput]} value={props.description} onChangeText={props.setDescription} placeholder="Describe your club" placeholderTextColor={ui.text.muted} maxLength={250} multiline />
        <Text style={styles.helperText}>{props.description.length}/250</Text>
        <ClubBrandingEditor tag={props.tag} branding={props.branding} setBranding={props.setBranding} />
        {!canAffordCreate ? <Text style={styles.warningText}>You need {formatCoins(props.clubConfig.createCost - coins)} more.</Text> : null}
        <PrimaryButton label={createLocked ? `Unlocks at Level ${props.clubConfig.minCreateLevel}` : props.busyId === 'create' ? 'Creating...' : 'Create Club'} disabled={createLocked || !canAffordCreate || props.busyId === 'create'} onPress={props.create} />
      </Panel>
    </>
  );
}

function ClubSheet({ title, subtitle, visible, onClose, children }: { title: string; subtitle: string; visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.flex}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}><X size={22} color={ui.text.primary} strokeWidth={3} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function HubAction({ title, detail, Icon, accent, badge = 0, locked = false, testerPreview = false, onPress }: { title: string; detail: string; Icon: LucideIcon; accent: string; badge?: number; locked?: boolean; testerPreview?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.hubAction, locked && styles.hubActionLocked]} onPress={onPress}>
      <View style={[styles.hubActionIcon, { borderColor: accent }]}>{locked ? <Lock size={22} color={ui.text.muted} strokeWidth={2.5} /> : <Icon size={24} color={accent} strokeWidth={2.5} />}</View>
      <View style={styles.flex}>
        <Text style={styles.hubActionTitle}>{title}</Text>
        <Text style={styles.hubActionDetail} numberOfLines={2}>{detail}</Text>
      </View>
      {testerPreview ? <View style={styles.testerPreviewBadge}><Text style={styles.testerPreviewText}>Preview</Text></View> : null}
      {badge > 0 ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{Math.min(99, badge)}</Text></View> : null}
    </Pressable>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.sectionBlock}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function GoalRow({ goal, color }: { goal: api.ClubGoal; color: string }) {
  return (
    <View style={styles.goalRow}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{goal.title}</Text>
        <ProgressBar progress={goal.progress / Math.max(1, goal.target)} color={color} />
        <Text style={styles.metaText}>{goal.progress}/{goal.target} - +{goal.reward.clubXp} club XP</Text>
      </View>
      {goal.complete ? <Check size={20} color={ui.palette.emerald} /> : null}
    </View>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text>{children}</View>;
}

function StatTile({ label, value, style, locked, dimmed }: { label: string; value: string; style?: StyleProp<ViewStyle>; locked?: boolean; dimmed?: boolean }) {
  return (
    <View style={[styles.statTile, dimmed && styles.statTileDimmed, style]}>
      <View style={styles.statValueRow}>{locked ? <Lock size={16} color={ui.text.muted} /> : null}<Text style={styles.statValue}>{value}</Text></View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PresetRow<T extends string>({ label, items, selected, onSelect }: { label: string; items: readonly T[]; selected: string; onSelect: (value: T) => void }) {
  return (
    <View style={styles.presetBlock}>
      <Text style={styles.metaText}>{label}</Text>
      <View style={styles.quickRow}>{items.map(item => <Pressable key={item} style={[styles.quickChip, item === selected && styles.quickChipSelected]} onPress={() => onSelect(item)}><Text style={styles.quickChipText}>{capitalize(item)}</Text></Pressable>)}</View>
    </View>
  );
}

function BannerPresetRow({ tag, branding, onSelect }: { tag: string; branding: api.ClubBranding; onSelect: (value: (typeof BANNER_STYLES)[number]) => void }) {
  const previewTag = sanitizeClubTag(tag) || 'CLUB';
  return (
    <View style={styles.presetBlock}>
      <Text style={styles.metaText}>Club tag banner</Text>
      <Text style={styles.presetHint}>This changes the plate behind your club tag.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerPreviewRow}>
        {BANNER_STYLES.map(item => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityLabel={`${bannerLabel(item)} club tag banner`}
            style={[styles.bannerOption, item === branding.bannerStyle && styles.bannerOptionSelected]}
            onPress={() => onSelect(item)}
          >
            <ClubEmblem branding={{ ...branding, bannerStyle: item }} tag={previewTag} size={52} showTag />
            <Text style={styles.bannerOptionLabel}>{bannerLabel(item)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ClubBrandingEditor({ tag, branding, setBranding }: { tag: string; branding: api.ClubBranding; setBranding: (value: api.ClubBranding) => void }) {
  const applyTheme = (colorPair: (typeof COLOR_PAIRS)[number]) => {
    const colors = BRAND_COLORS[colorPair];
    setBranding({
      ...branding,
      colorPair,
      primaryColor: colors.accent,
      backgroundColor: colors.background,
      accentColor: colors.soft,
    });
  };
  return (
    <View style={styles.emblemEditor}>
      <View style={styles.emblemPreview}>
        <ClubEmblem branding={branding} tag={sanitizeClubTag(tag) || 'CLUB'} size={88} showTag />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>Club Emblem</Text>
          <Text style={styles.metaText}>Primary colors the outline and symbol. Background fills the emblem. Trim colors the inset line and club-tag banner.</Text>
        </View>
      </View>
      <PresetRow label="Starting theme" items={COLOR_PAIRS} selected={branding.colorPair} onSelect={applyTheme} />
      <PresetRow label="Icon" items={BADGE_ICONS} selected={branding.badgeIcon} onSelect={badgeIcon => setBranding({ ...branding, badgeIcon })} />
      <PresetRow label="Shape" items={BADGE_SHAPES} selected={branding.badgeShape} onSelect={badgeShape => setBranding({ ...branding, badgeShape })} />
      <BannerPresetRow tag={tag} branding={branding} onSelect={bannerStyle => setBranding({ ...branding, bannerStyle })} />
      <ColorSwatchRow label="Primary" selected={branding.primaryColor} onSelect={primaryColor => setBranding({ ...branding, primaryColor })} />
      <ColorSwatchRow label="Background" selected={branding.backgroundColor} onSelect={backgroundColor => setBranding({ ...branding, backgroundColor })} />
      <ColorSwatchRow label="Trim & banner" selected={branding.accentColor} onSelect={accentColor => setBranding({ ...branding, accentColor })} />
    </View>
  );
}

function ColorSwatchRow({ label, selected, onSelect }: { label: string; selected: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.presetBlock}>
      <Text style={styles.metaText}>{label}</Text>
      <View style={styles.colorSwatchRow}>
        {CLUB_COLORS.map(color => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${color}`}
            style={[styles.colorSwatch, { backgroundColor: color }, selected === color && styles.colorSwatchSelected]}
            onPress={() => onSelect(color)}
          />
        ))}
      </View>
    </View>
  );
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%`, backgroundColor: color }]} /></View>;
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable style={[styles.primaryButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function SmallButton({ label, busy, disabled, tone = 'solid', onPress }: { label: string; busy?: boolean; disabled?: boolean; tone?: 'solid' | 'ghost'; onPress: () => void }) {
  return <Pressable style={[styles.smallButton, tone === 'ghost' && styles.smallButtonGhost, (disabled || busy) && styles.disabled]} disabled={disabled || busy} onPress={onPress}><Text style={styles.smallButtonText}>{busy ? '...' : label}</Text></Pressable>;
}

function BackButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return <Pressable style={[styles.headerIcon, style]} onPress={onPress}><ChevronLeft size={24} color={ui.text.primary} strokeWidth={2.7} /></Pressable>;
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function colorsForBranding(branding: api.ClubBranding) {
  const fallback = BRAND_COLORS[branding.colorPair] || BRAND_COLORS.emerald;
  return {
    accent: branding.primaryColor || fallback.accent,
    background: branding.backgroundColor || fallback.background,
    soft: branding.accentColor || fallback.soft,
  };
}

function sanitizeClubTag(value: string) {
  return value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4);
}

function capitalize(value: string) {
  return value ? value.slice(0, 1).toUpperCase() + value.slice(1) : value;
}

function bannerLabel(value: string) {
  return value === 'night' ? 'Knight' : capitalize(value);
}

function formatCoins(value: number) {
  return `${Math.max(0, Math.floor(Number(value) || 0)).toLocaleString()} coins`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  headerIcon: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: ui.border.strong, backgroundColor: ui.surface.raised, alignItems: 'center', justifyContent: 'center' },
  heroBack: { position: 'absolute', right: 12, top: 12, zIndex: 2, width: 42, height: 42 },
  clubHero: { borderWidth: 1.5, borderRadius: 8, padding: 18, paddingRight: 60, flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 14 },
  clubName: { color: ui.text.primary, fontSize: 25, fontWeight: '900' },
  heroMotto: { color: ui.text.secondary, fontSize: 13, fontWeight: '700', marginTop: 2 },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  heroMeta: { color: ui.text.secondary, fontSize: 12, fontWeight: '900' },
  heroProgress: { color: ui.text.muted, fontSize: 11, fontWeight: '800', marginTop: 5 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  hubAction: { width: '48.5%', minHeight: 104, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.panel, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hubActionLocked: { opacity: 0.62 },
  hubActionIcon: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.surface.raised },
  hubActionTitle: { color: ui.text.primary, fontWeight: '900', fontSize: 16 },
  hubActionDetail: { color: ui.text.muted, fontWeight: '700', fontSize: 11, marginTop: 3 },
  notificationBadge: { position: 'absolute', right: 7, top: 7, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: ui.palette.coral, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { color: '#08111F', fontSize: 11, fontWeight: '900' },
  testerPreviewBadge: { position: 'absolute', left: 7, top: 7, borderRadius: 5, backgroundColor: '#26325A', paddingHorizontal: 5, paddingVertical: 2 },
  testerPreviewText: { color: '#BDEBFF', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  hubBand: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: ui.border.soft, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  hubBandIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: ui.surface.raised, alignItems: 'center', justifyContent: 'center' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(3, 7, 17, 0.72)', justifyContent: 'flex-end' },
  sheetDismiss: { flex: 1 },
  sheet: { maxHeight: '91%', minHeight: '65%', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderColor: ui.border.strong, backgroundColor: ui.surface.base },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: ui.border.soft },
  sheetTitle: { color: ui.text.primary, fontSize: 25, fontWeight: '900' },
  sheetSubtitle: { color: ui.text.secondary, fontSize: 12, fontWeight: '700', marginTop: 3 },
  closeButton: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, borderColor: ui.border.strong, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { padding: 18, gap: 18 },
  sectionBlock: { paddingBottom: 18, borderBottomWidth: 1, borderColor: ui.border.soft, gap: 10 },
  sectionTitle: { color: ui.text.primary, fontSize: 19, fontWeight: '900' },
  panel: { borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.panel, padding: 16, marginBottom: 14 },
  panelTitle: { color: ui.text.primary, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  input: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, color: ui.text.primary, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', marginBottom: 9 },
  descriptionInput: { minHeight: 96, textAlignVertical: 'top' },
  inlineForm: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  inlineInput: { flex: 1, marginBottom: 0, maxHeight: 100 },
  formStack: { marginTop: 8 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  primaryButton: { minHeight: 52, borderRadius: 8, backgroundColor: ui.palette.emerald, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 14 },
  primaryButtonText: { color: '#08111F', fontSize: 16, fontWeight: '900' },
  smallButton: { minHeight: 42, borderRadius: 8, backgroundColor: ui.palette.emerald, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  smallButtonGhost: { backgroundColor: ui.surface.raised, borderWidth: 1, borderColor: ui.border.soft },
  smallButtonText: { color: ui.text.primary, fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.42 },
  rowTitle: { color: ui.text.primary, fontSize: 15, fontWeight: '900' },
  metaText: { color: ui.text.secondary, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  helperText: { color: ui.text.muted, fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 9, borderRadius: 5, overflow: 'hidden', backgroundColor: '#20344F', borderWidth: 1, borderColor: ui.border.soft, marginTop: 8 },
  progressFill: { height: '100%', borderRadius: 5 },
  messageList: { gap: 8, marginBottom: 12 },
  messageRow: { paddingVertical: 10, borderBottomWidth: 1, borderColor: ui.border.soft },
  chatName: { color: ui.palette.emerald, fontSize: 12, fontWeight: '900' },
  chatText: { color: ui.text.primary, fontSize: 14, fontWeight: '700', marginTop: 3, lineHeight: 20 },
  rewardRail: { gap: 10, paddingVertical: 4 },
  rewardCard: { width: 192, minHeight: 198, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.raised, padding: 14 },
  rewardCardNext: { borderColor: ui.palette.gold, backgroundColor: '#25203A' },
  rewardCardEarned: { borderColor: ui.palette.emerald, backgroundColor: '#102A2B' },
  rewardScope: { color: ui.text.muted, fontSize: 10, fontWeight: '900' },
  rewardName: { color: ui.text.primary, fontSize: 16, fontWeight: '900', marginTop: 8 },
  rewardDescription: { color: ui.text.secondary, fontSize: 12, lineHeight: 17, marginVertical: 8, flex: 1 },
  rewardRequirement: { color: ui.text.muted, fontSize: 10, fontWeight: '800', marginTop: 8 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  prestigeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statTile: { width: '48.5%', minHeight: 86, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.raised, padding: 12, justifyContent: 'center' },
  statTileDimmed: { opacity: 0.52 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statValue: { color: ui.text.primary, fontSize: 18, fontWeight: '900' },
  statLabel: { color: ui.text.muted, fontSize: 11, fontWeight: '800', marginTop: 5 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.raised, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  quickChipSelected: { borderColor: ui.palette.emerald, backgroundColor: '#143A35' },
  quickChipText: { color: ui.text.primary, fontSize: 12, fontWeight: '900' },
  listRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: ui.border.soft },
  listIndex: { color: ui.text.muted, fontWeight: '900', width: 22 },
  coinText: { color: ui.palette.gold, fontWeight: '900' },
  memberRow: { paddingVertical: 11, borderBottomWidth: 1, borderColor: ui.border.soft, flexDirection: 'row', alignItems: 'center', gap: 10 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ui.palette.emerald },
  offlineDot: { backgroundColor: ui.palette.coral },
  memberActions: { gap: 6, alignItems: 'flex-end' },
  announcementRow: { paddingVertical: 10, borderBottomWidth: 1, borderColor: ui.border.soft },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, borderBottomWidth: 1, borderColor: ui.border.soft },
  invitationRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, borderBottomWidth: 1, borderColor: ui.border.soft },
  leaveButton: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: ui.palette.coral, alignItems: 'center', justifyContent: 'center' },
  leaveButtonText: { color: ui.palette.coral, fontWeight: '900' },
  costStrip: { padding: 12, borderRadius: 8, backgroundColor: ui.surface.raised, marginBottom: 12 },
  lockStrip: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.raised, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  costText: { color: ui.palette.gold, fontSize: 22, fontWeight: '900', marginVertical: 3 },
  warningText: { color: ui.palette.coral, fontSize: 12, fontWeight: '800', marginTop: 6 },
  presetBlock: { marginTop: 8 },
  emblemEditor: { marginTop: 8, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.raised },
  emblemPreview: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  presetHint: { color: ui.text.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  bannerPreviewRow: { gap: 8, paddingTop: 8, paddingRight: 8 },
  bannerOption: { width: 78, minHeight: 84, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
  bannerOptionSelected: { borderColor: ui.palette.emerald, backgroundColor: '#143A35' },
  bannerOptionLabel: { color: ui.text.primary, fontSize: 10, fontWeight: '900' },
  colorSwatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 7 },
  colorSwatch: { width: 30, height: 30, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(232,236,241,0.18)' },
  colorSwatchSelected: { borderColor: '#FFFFFF', transform: [{ scale: 1.08 }] },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: ui.border.soft },
  emptyText: { color: ui.text.muted, fontSize: 13, fontWeight: '700', paddingVertical: 12 },
});
