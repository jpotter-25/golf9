// src/services/api.ts
// Purpose: Typed REST helpers for authentication and room setup.

import { SERVER_URL } from '../config';
import { getInstallId } from '../utils/deviceIdentity';

export type UserProfile = {
  userId: string;
  displayName: string;
  avatarInitial: string;
  stats: { gamesPlayed: number; wins: number };
  progression: ProgressionState;
  statistics: PlayerStatistics;
  achievements: Achievement[];
  currency: CurrencyBalance;
  inventory: PlayerInventory;
  challenges: ChallengeBuckets;
  competitive: CompetitiveState;
  competitiveByPlayers: RankedLadders;
  club: ClubSummary | null;
  authProviders: AuthProviderStatus;
};

export type AuthResponse = { token: string; user: UserProfile };
export type AuthProviderKey = 'google' | 'facebook';
export type AuthProviderStatus = Record<AuthProviderKey, boolean>;
export type AuthConfig = { environment: string; inviteRequired: boolean; apiUrl: string; adminUrl: string; providers: AuthProviderStatus };
export type PushTokenPayload = {
  expoPushToken?: string;
  deviceId?: string;
  platform?: 'ios' | 'android' | 'web';
};
export type SocialAuthPayload = {
  provider: AuthProviderKey;
  idToken?: string;
  accessToken?: string;
  displayName?: string;
  inviteCode?: string;
};
export type SocialProfileRequiredResponse = {
  requiresProfile: true;
  provider: AuthProviderKey;
  suggestedDisplayName: string;
  inviteRequired: boolean;
};
export type SocialAuthResponse = AuthResponse | SocialProfileRequiredResponse;
export type RoomPlayer = {
  userId: string;
  displayName: string;
  avatarInitial: string;
  cosmetics?: PlayerInventory['equipped'] | null;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
};
export type RoomSummary = {
  code: string;
  hostUserId: string;
  status: 'lobby' | 'playing';
  matchType: MatchType;
  isPublic: boolean;
  maxPlayers: number;
  rounds: 5 | 9;
  openSeats: number;
  countdownEndsAt?: number | null;
  economy: MatchEconomy;
  ranked?: { seasonId: string; league?: string; playerCount: number; buyIn: number } | null;
  players: RoomPlayer[];
};

export type SocialRelationship = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';
export type PlayerStatus = {
  online: boolean;
  inRoom: boolean;
  roomCode: string | null;
  roomStatus: 'lobby' | 'playing' | null;
  matchType: MatchType | null;
};

export type ClubRole = 'owner' | 'officer' | 'member' | 'rookie';

export type ClubBranding = {
  colorPair: 'emerald' | 'gold' | 'sky' | 'crimson' | 'violet' | string;
  badgeShape: 'shield' | 'crest' | 'diamond' | 'circle' | string;
  bannerStyle: 'classic' | 'night' | 'fairway' | 'champion' | string;
};

export type ClubSummary = {
  clubId: string;
  name: string;
  tag: string;
  motto: string;
  level: number;
  memberCount: number;
  memberCap: number;
  role: ClubRole | null;
  branding: ClubBranding;
  badge: { colorPair: string; shape: string; bannerStyle: string };
};

export type PublicPlayerSummary = {
  userId: string;
  displayName: string;
  avatarInitial: string;
  level: number;
  stats: { gamesPlayed: number; wins: number };
  statistics: Pick<PlayerStatistics, 'gamesPlayed' | 'wins' | 'bestTotal' | 'bestRound' | 'columnClears'>;
  competitive: Pick<CompetitiveState, 'league' | 'rankedGames' | 'wins'>;
  competitiveByPlayers?: RankedLadders;
  cosmetics: PlayerInventory['equipped'];
  club: ClubSummary | null;
  relationship: SocialRelationship;
  status: PlayerStatus;
  since?: number;
  recent?: {
    completedAt: number;
    matchType: string;
    opponentTotal: number;
    yourTotal: number;
    youWon: boolean;
  };
};
export type SocialRequest = {
  id: string;
  createdAt: number;
  direction: 'incoming' | 'outgoing';
  player: PublicPlayerSummary;
};
export type RoomInvite = {
  id: string;
  roomCode: string;
  createdAt: number;
  expiresAt: number;
  from: PublicPlayerSummary;
  room: RoomSummary;
};
export type SocialSummary = {
  friends: PublicPlayerSummary[];
  incomingRequests: SocialRequest[];
  outgoingRequests: SocialRequest[];
  roomInvites: RoomInvite[];
  recentPlayers: PublicPlayerSummary[];
};
export type PublicPlayerProfile = {
  userId: string;
  displayName: string;
  avatarInitial: string;
  progression: ProgressionState;
  stats: { gamesPlayed: number; wins: number };
  statistics: PlayerStatistics;
  achievements: Achievement[];
  competitive: {
    league: RankedLeague;
    placementComplete: boolean;
    placementsRemaining?: number;
    rankedGames: number;
    wins: number;
    losses: number;
    seasonBestLeague: RankedLeague;
  };
  competitiveByPlayers?: RankedLadders;
  cosmetics: PlayerInventory['equipped'];
  club: ClubSummary | null;
  relationship: SocialRelationship;
  status: PlayerStatus;
  recentMatches: Array<{
    resultId: string;
    completedAt: number;
    matchType: string;
    total: number;
    won: boolean;
    playerCount: number;
  }>;
};
export type GameResult = {
  resultId: string;
  completedAt: number;
  roomCode: string | null;
  matchType?: MatchType;
  mode?: 'online' | 'solo' | 'passplay';
  round: number;
  totalRounds: number;
  players: Array<{ userId: string; displayName: string; total: number; won: boolean; progression?: MatchProgressionSummary; ranked?: RankedMatchSummary; economy?: MatchEconomyResult }>;
};

export type ProgressionState = {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  levelProgress: number;
};

export type PlayerStatistics = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  onlineGames: number;
  soloGames: number;
  passPlayGames: number;
  roundsPlayed: number;
  totalScore: number;
  bestTotal: number | null;
  bestRound: number | null;
  columnClears: number;
  socialMessagesSent: number;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  reward: { xp: number; coins: number };
  unlockedAt: number | null;
};

export type CurrencyBalance = {
  coins: number;
  lifetimeCoins: number;
  dailyBonus: DailyBonus;
};

export type DailyBonus = {
  canClaim: boolean;
  reward: number;
  baseReward: number;
  streakBonus: number;
  streak: number;
  nextStreak: number;
  lowBalanceBoost: boolean;
  lastClaimedAt: number | null;
  nextAvailableAt: number;
};

export type PlayerInventory = {
  cosmetics: string[];
  equipped: { cardBack: string; avatarFrame: string; avatarIcon: string; title: string; tableTheme: string };
};

export type MatchProgressionSummary = {
  xpGained: number;
  coinsGained: number;
  levelBefore: number;
  levelAfter: number;
  totalXp: number;
  achievementsUnlocked: Achievement[];
  challengesCompleted: Challenge[];
  ranked?: RankedMatchSummary;
  economy?: MatchEconomyResult;
  club?: ClubContributionSummary;
};

export type Challenge = {
  id: string;
  templateId: string;
  cadence: 'daily' | 'weekly';
  title: string;
  description: string;
  metric: string;
  target: number;
  progress: number;
  reward: { xp: number; coins: number };
  expiresAt: number;
  completedAt: number | null;
  claimedAt: number | null;
  canClaim: boolean;
};

export type ChallengeBuckets = {
  daily: { periodStart: number; expiresAt: number; items: Challenge[] };
  weekly: { periodStart: number; expiresAt: number; items: Challenge[] };
};

export type CosmeticType = 'cardBack' | 'avatarFrame' | 'avatarIcon' | 'title' | 'tableTheme';

export type MatchType = 'casual' | 'wager' | 'ranked';

export type MatchEconomy = {
  buyIn: number;
  pot: number;
  chargedAt: number | null;
};

export type MatchEconomyResult = {
  userId: string;
  placement: number;
  buyIn: number;
  payout: number;
  net: number;
  pot: number;
};

export type WagerTable = {
  id: string;
  label: string;
  buyIn: number;
  description: string;
};

export type RankedFee = {
  league: string;
  minMmr: number;
  maxMmr: number | null;
  buyIn: number;
};

export type CoinSource = {
  id: string;
  title: string;
  description: string;
};

export type EconomyCatalog = {
  wagerTables: WagerTable[];
  rankedFees: RankedFee[];
  coinSources: CoinSource[];
  dailyBonus: DailyBonus | null;
};

export type CosmeticItem = {
  id: string;
  type: CosmeticType;
  name: string;
  description: string;
  rarity: 'starter' | 'rare' | 'epic';
  price: number;
  shopCategory: 'starter' | 'coin' | 'ranked' | 'club' | 'event' | string;
  unlockRequirement: 'level' | 'achievement' | 'rank' | 'club' | 'event' | 'season' | null;
  requiredMmr: number | null;
  requiredLeague: string | null;
  seasonId: string | null;
  eligible: boolean;
  lockedReason: string | null;
  unlockStatus: 'locked' | 'unlocked' | 'owned' | 'vaulted' | string;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
};

export type LocalResultPayload = {
  mode: 'solo' | 'passplay';
  totalRounds: 5 | 9;
  roundScores: number[];
  columnClears: number;
  players: Array<{ displayName: string; total: number; won?: boolean }>;
};

export type RankedLeague = {
  league: string;
  division: string | null;
  name: string;
  minMmr: number;
  nextLeagueMmr: number | null;
};

export type RankedSeasonReward = {
  id: string;
  name: string;
  league: string;
  minMmr: number;
  cosmeticId: string;
  earned: boolean;
  claimed: boolean;
  shopUnlock?: boolean;
};

export type CompetitiveState = {
  playerCount: 2 | 3 | 4;
  seasonId: string;
  mmr: number;
  league: RankedLeague;
  placementsPlayed: number;
  placementMatchesRequired: number;
  placementComplete: boolean;
  placementsRemaining: number;
  rankedGames: number;
  wins: number;
  losses: number;
  seasonBestMmr: number;
  seasonBestLeague: RankedLeague;
  claimedSeasonRewards: string[];
  matchHistory: RankedMatchSummary[];
  season: {
    id: string;
    name: string;
    startsAt: number;
    endsAt: number;
    rewards: RankedSeasonReward[];
  };
};

export type RankedLadders = Record<'2' | '3' | '4', CompetitiveState>;

export type RankedMatchSummary = {
  matchType: 'ranked';
  playerCount?: number;
  seasonId: string;
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  leagueBefore: RankedLeague;
  leagueAfter: RankedLeague;
  placement: number;
  placementsPlayed: number;
  placementMatchesRequired: number;
  placementComplete: boolean;
  promoted: boolean;
  demoted: boolean;
};

export type RankedQueueStatus = {
  queued: boolean;
  matchedRoomCode: string | null;
  room: RoomSummary | null;
  status: 'idle' | 'searching' | 'lobby' | 'playing';
  maxPlayers?: number;
  rounds?: 5 | 9;
  joinedAt?: number;
  searchRange?: number;
  buyIn?: number;
  pot?: number;
  queuedPlayers?: number;
};

export type OpenRoomFilters = {
  matchType?: 'casual' | 'wager';
  maxPlayers?: 2 | 3 | 4;
  rounds?: 5 | 9;
  buyIn?: number;
};

export type ClubProgression = ProgressionState & { memberCap: number };

export type ClubMember = {
  userId: string;
  displayName: string;
  avatarInitial: string;
  role: ClubRole;
  joinedAt: number;
  contributionXp: number;
  contribution: { matches: number; wins: number; columnClears: number; rankedOrWager: number };
};

export type ClubJoinRequest = {
  id: string;
  userId: string;
  displayName: string;
  avatarInitial: string;
  createdAt: number;
  message: string;
};

export type ClubGoal = {
  id: string;
  templateId: string;
  kind: 'weekly' | 'season';
  title: string;
  metric: string;
  target: number;
  progress: number;
  reward: { clubXp: number };
  periodStart: number;
  expiresAt: number;
  completedAt: number | null;
  claimedAt: number | null;
  complete: boolean;
};

export type ClubEvent = {
  id: string;
  templateId: string;
  title: string;
  metric: string;
  startsAt: number;
  endsAt: number;
  reward: { clubXp: number };
  score: number;
  leaderboardScore: number;
  contributors: Record<string, number>;
  rewardClaimedAt: number | null;
};

export type ClubReward = {
  id: string;
  scope: 'club' | 'member';
  name: string;
  description: string;
  minLevel: number;
  minContributionXp?: number;
  cosmeticId?: string;
  unlocks?: { kind: string; value: string };
  eligible: boolean;
  claimed: boolean;
};

export type ClubChatMessage = {
  id: string;
  clubId: string;
  userId: string;
  displayName: string;
  avatarInitial?: string;
  type: 'text' | 'preset' | 'emoji' | 'sticker';
  text: string;
  createdAt: number;
};

export type ClubAnnouncement = {
  id: string;
  userId: string;
  displayName: string;
  avatarInitial?: string;
  text: string;
  createdAt: number;
};

export type ClubProfile = ClubSummary & {
  createdAt: number;
  updatedAt: number;
  progression: ClubProgression;
  members: ClubMember[];
  joinRequests: ClubJoinRequest[];
  invites: ClubJoinRequest[];
  announcements: ClubAnnouncement[];
  goals: { weekly: ClubGoal[]; season: ClubGoal[] };
  event: ClubEvent;
  rewards: ClubReward[];
  chat: ClubChatMessage[];
  permissions: {
    canEdit: boolean;
    canManageRequests: boolean;
    canPostAnnouncement: boolean;
    canManageMembers: boolean;
  };
};

export type ClubApplication = {
  id: string;
  club: ClubSummary;
  createdAt: number;
  message: string;
};

export type ClubContributionSummary = {
  skipped?: boolean;
  clubXpGained: number;
  eventScoreGained: number;
  completedGoals: ClubGoal[];
  club: ClubSummary;
};

const REQUEST_TIMEOUT_MS = 8000;

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const installId = await getInstallId();
    const res = await fetch(`${SERVER_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Golf9-Device-Id': installId,
        'X-Golf9-Platform': 'mobile',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out connecting to ${SERVER_URL}`);
    }
    if (error instanceof TypeError && error.message === 'Network request failed') {
      throw new Error(`Cannot reach server at ${SERVER_URL}. Make sure the server is running and your phone can open ${SERVER_URL}/health.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function authConfig(): Promise<AuthConfig> {
  return request<AuthConfig>('/auth/config');
}

export function signup(displayName: string, password: string, inviteCode = ''): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify({ displayName, password, inviteCode }) });
}

export function login(displayName: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ displayName, password }) });
}

export function socialLogin(payload: SocialAuthPayload): Promise<SocialAuthResponse> {
  return request<SocialAuthResponse>('/auth/social/login', { method: 'POST', body: JSON.stringify(payload) });
}

export function linkSocialProvider(token: string, payload: SocialAuthPayload): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>('/auth/social/link', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function createSupportTicket(
  token: string,
  payload: { subject?: string; category?: string; message: string }
): Promise<{ ticket: { ticketId: string; status: string; subject: string; createdAt: number } }> {
  return request<{ ticket: { ticketId: string; status: string; subject: string; createdAt: number } }>(
    '/support/tickets',
    { method: 'POST', body: JSON.stringify(payload) },
    token
  );
}

export function logout(token: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/auth/logout', { method: 'POST' }, token);
}

export function me(token: string): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>('/auth/me', {}, token);
}

export function profile(token: string): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>('/profile/me', {}, token);
}

export function registerPushToken(token: string, payload: PushTokenPayload): Promise<{ ok: boolean; pushTokenCount: number }> {
  return request<{ ok: boolean; pushTokenCount: number }>(
    '/push/register',
    { method: 'POST', body: JSON.stringify(payload) },
    token
  );
}

export function unregisterPushToken(token: string, payload: PushTokenPayload): Promise<{ ok: boolean; pushTokenCount: number }> {
  return request<{ ok: boolean; pushTokenCount: number }>(
    '/push/unregister',
    { method: 'POST', body: JSON.stringify(payload) },
    token
  );
}

export function socialMe(token: string): Promise<{ social: SocialSummary }> {
  return request<{ social: SocialSummary }>('/social/me', {}, token);
}

export function searchPlayers(token: string, query: string): Promise<{ players: PublicPlayerSummary[] }> {
  return request<{ players: PublicPlayerSummary[] }>(`/players/search?q=${encodeURIComponent(query)}`, {}, token);
}

export function publicProfile(token: string, userId: string): Promise<{ profile: PublicPlayerProfile }> {
  return request<{ profile: PublicPlayerProfile }>(`/profiles/${encodeURIComponent(userId)}`, {}, token);
}

export function clubMe(token: string): Promise<{ club: ClubProfile | null; applications: ClubApplication[]; recommended?: ClubSummary[] }> {
  return request<{ club: ClubProfile | null; applications: ClubApplication[]; recommended?: ClubSummary[] }>('/clubs/me', {}, token);
}

export function createClub(token: string, payload: { name: string; tag: string; motto?: string; branding?: Partial<ClubBranding> }): Promise<{ club: ClubProfile }> {
  return request<{ club: ClubProfile }>('/clubs', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function searchClubs(token: string, query: string): Promise<{ clubs: ClubSummary[] }> {
  return request<{ clubs: ClubSummary[] }>(`/clubs/search?q=${encodeURIComponent(query)}`, {}, token);
}

export function clubProfile(token: string, clubId: string): Promise<{ club: ClubProfile }> {
  return request<{ club: ClubProfile }>(`/clubs/${encodeURIComponent(clubId)}`, {}, token);
}

export function updateClub(token: string, clubId: string, payload: { name?: string; tag?: string; motto?: string; branding?: Partial<ClubBranding> }): Promise<{ club: ClubProfile }> {
  return request<{ club: ClubProfile }>(
    `/clubs/${encodeURIComponent(clubId)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    token
  );
}

export function requestJoinClub(token: string, clubId: string, message = ''): Promise<{ request: { id: string; userId: string; createdAt: number; message: string }; club: ClubSummary }> {
  return request<{ request: { id: string; userId: string; createdAt: number; message: string }; club: ClubSummary }>(
    `/clubs/${encodeURIComponent(clubId)}/requests`,
    { method: 'POST', body: JSON.stringify({ message }) },
    token
  );
}

export function acceptClubRequest(token: string, clubId: string, requestId: string): Promise<{ club: ClubProfile; member: PublicPlayerSummary }> {
  return request<{ club: ClubProfile; member: PublicPlayerSummary }>(
    `/clubs/${encodeURIComponent(clubId)}/requests/${encodeURIComponent(requestId)}/accept`,
    { method: 'POST' },
    token
  );
}

export function rejectClubRequest(token: string, clubId: string, requestId: string): Promise<{ club: ClubProfile }> {
  return request<{ club: ClubProfile }>(
    `/clubs/${encodeURIComponent(clubId)}/requests/${encodeURIComponent(requestId)}/reject`,
    { method: 'POST' },
    token
  );
}

export function inviteToClub(token: string, clubId: string, userId: string): Promise<{ invite: ClubJoinRequest; club: ClubProfile }> {
  return request<{ invite: ClubJoinRequest; club: ClubProfile }>(
    `/clubs/${encodeURIComponent(clubId)}/invites`,
    { method: 'POST', body: JSON.stringify({ userId }) },
    token
  );
}

export function leaveClub(token: string, clubId: string): Promise<{ ok: boolean; club: null }> {
  return request<{ ok: boolean; club: null }>(`/clubs/${encodeURIComponent(clubId)}/leave`, { method: 'POST' }, token);
}

export function updateClubMember(token: string, clubId: string, userId: string, role: ClubRole): Promise<{ club: ClubProfile }> {
  return request<{ club: ClubProfile }>(
    `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(userId)}`,
    { method: 'PATCH', body: JSON.stringify({ role }) },
    token
  );
}

export function removeClubMember(token: string, clubId: string, userId: string): Promise<{ club: ClubProfile }> {
  return request<{ club: ClubProfile }>(
    `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    token
  );
}

export function postClubAnnouncement(token: string, clubId: string, text: string): Promise<{ announcement: ClubAnnouncement; club: ClubProfile }> {
  return request<{ announcement: ClubAnnouncement; club: ClubProfile }>(
    `/clubs/${encodeURIComponent(clubId)}/announcements`,
    { method: 'POST', body: JSON.stringify({ text }) },
    token
  );
}

export function deleteClubAnnouncement(token: string, clubId: string, announcementId: string): Promise<{ club: ClubProfile }> {
  return request<{ club: ClubProfile }>(
    `/clubs/${encodeURIComponent(clubId)}/announcements/${encodeURIComponent(announcementId)}`,
    { method: 'DELETE' },
    token
  );
}

export function claimClubReward(token: string, rewardId: string): Promise<{ reward: ClubReward; granted: string | null; club: ClubProfile; user: UserProfile; cosmetics: CosmeticItem[] }> {
  return request<{ reward: ClubReward; granted: string | null; club: ClubProfile; user: UserProfile; cosmetics: CosmeticItem[] }>(
    '/clubs/rewards/claim',
    { method: 'POST', body: JSON.stringify({ rewardId }) },
    token
  );
}

export function sendFriendRequest(token: string, userId: string): Promise<{ social: SocialSummary; friend?: PublicPlayerSummary }> {
  return request<{ social: SocialSummary; friend?: PublicPlayerSummary }>(
    '/friends/requests',
    { method: 'POST', body: JSON.stringify({ userId }) },
    token
  );
}

export function acceptFriendRequest(token: string, requestId: string): Promise<{ social: SocialSummary; friend: PublicPlayerSummary }> {
  return request<{ social: SocialSummary; friend: PublicPlayerSummary }>(
    `/friends/requests/${encodeURIComponent(requestId)}/accept`,
    { method: 'POST' },
    token
  );
}

export function rejectFriendRequest(token: string, requestId: string): Promise<{ social: SocialSummary }> {
  return request<{ social: SocialSummary }>(
    `/friends/requests/${encodeURIComponent(requestId)}/reject`,
    { method: 'POST' },
    token
  );
}

export function cancelFriendRequest(token: string, requestId: string): Promise<{ social: SocialSummary }> {
  return request<{ social: SocialSummary }>(
    `/friends/requests/${encodeURIComponent(requestId)}`,
    { method: 'DELETE' },
    token
  );
}

export function removeFriend(token: string, userId: string): Promise<{ social: SocialSummary }> {
  return request<{ social: SocialSummary }>(
    `/friends/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    token
  );
}

export function inviteFriendToRoom(token: string, roomCode: string, userId: string): Promise<{ invite: RoomInvite; social: SocialSummary }> {
  return request<{ invite: RoomInvite; social: SocialSummary }>(
    `/rooms/${encodeURIComponent(roomCode)}/invites`,
    { method: 'POST', body: JSON.stringify({ userId }) },
    token
  );
}

export function acceptRoomInvite(token: string, inviteId: string): Promise<{ room: RoomSummary; social: SocialSummary }> {
  return request<{ room: RoomSummary; social: SocialSummary }>(
    `/rooms/invites/${encodeURIComponent(inviteId)}/accept`,
    { method: 'POST' },
    token
  );
}

export function dismissRoomInvite(token: string, inviteId: string): Promise<{ social: SocialSummary }> {
  return request<{ social: SocialSummary }>(
    `/rooms/invites/${encodeURIComponent(inviteId)}`,
    { method: 'DELETE' },
    token
  );
}

export function myResults(token: string): Promise<{ results: GameResult[] }> {
  return request<{ results: GameResult[] }>('/results/me', {}, token);
}

export function economyCatalog(token: string): Promise<EconomyCatalog> {
  return request<EconomyCatalog>('/economy/catalog', {}, token);
}

export function claimDailyBonus(token: string): Promise<{ reward: number; currency: CurrencyBalance; dailyBonus: DailyBonus; user: UserProfile; economy: EconomyCatalog }> {
  return request<{ reward: number; currency: CurrencyBalance; dailyBonus: DailyBonus; user: UserProfile; economy: EconomyCatalog }>(
    '/economy/daily-bonus/claim',
    { method: 'POST' },
    token
  );
}

export function cosmeticCatalog(token: string): Promise<{ cosmetics: CosmeticItem[] }> {
  return request<{ cosmetics: CosmeticItem[] }>('/cosmetics/catalog', {}, token);
}

export function claimChallenge(token: string, challengeId: string): Promise<{ challenge: Challenge; progression: MatchProgressionSummary; user: UserProfile }> {
  return request<{ challenge: Challenge; progression: MatchProgressionSummary; user: UserProfile }>(
    '/challenges/claim',
    { method: 'POST', body: JSON.stringify({ challengeId }) },
    token
  );
}

export function purchaseCosmetic(token: string, cosmeticId: string): Promise<{ cosmetic: CosmeticItem; user: UserProfile; cosmetics: CosmeticItem[] }> {
  return request<{ cosmetic: CosmeticItem; user: UserProfile; cosmetics: CosmeticItem[] }>(
    '/cosmetics/purchase',
    { method: 'POST', body: JSON.stringify({ cosmeticId }) },
    token
  );
}

export function equipCosmetic(token: string, cosmeticId: string): Promise<{ cosmetic: CosmeticItem; user: UserProfile; cosmetics: CosmeticItem[] }> {
  return request<{ cosmetic: CosmeticItem; user: UserProfile; cosmetics: CosmeticItem[] }>(
    '/cosmetics/equip',
    { method: 'POST', body: JSON.stringify({ cosmeticId }) },
    token
  );
}

export function recordLocalResult(token: string, payload: LocalResultPayload): Promise<{ result: GameResult; progression: MatchProgressionSummary; user: UserProfile }> {
  return request<{ result: GameResult; progression: MatchProgressionSummary; user: UserProfile }>(
    '/results/local',
    { method: 'POST', body: JSON.stringify(payload) },
    token
  );
}

export function createOnlineRoom(token: string, maxPlayers: number, rounds: number): Promise<{ room: RoomSummary }> {
  return request<{ room: RoomSummary }>('/rooms', { method: 'POST', body: JSON.stringify({ maxPlayers, rounds }) }, token);
}

export function openRooms(token: string, filters: OpenRoomFilters = {}): Promise<{ rooms: RoomSummary[] }> {
  const params = new URLSearchParams();
  if (filters.matchType) params.set('matchType', filters.matchType);
  if (filters.maxPlayers) params.set('maxPlayers', String(filters.maxPlayers));
  if (filters.rounds) params.set('rounds', String(filters.rounds));
  if (filters.buyIn !== undefined) params.set('buyIn', String(filters.buyIn));
  const query = params.toString();
  return request<{ rooms: RoomSummary[] }>(`/rooms/open${query ? `?${query}` : ''}`, {}, token);
}

export function joinOnlineRoom(token: string, code: string): Promise<{ room: RoomSummary }> {
  return request<{ room: RoomSummary }>(`/rooms/${code}/join`, { method: 'POST' }, token);
}

export function quickPlayOnlineRoom(token: string, maxPlayers: number, rounds: number): Promise<{ room: RoomSummary }> {
  return request<{ room: RoomSummary }>('/rooms/quick-play', { method: 'POST', body: JSON.stringify({ maxPlayers, rounds }) }, token);
}

export function wagerPlayOnlineRoom(token: string, maxPlayers: number, rounds: number, buyIn: number): Promise<{ room: RoomSummary }> {
  return request<{ room: RoomSummary }>('/rooms/wager-play', { method: 'POST', body: JSON.stringify({ maxPlayers, rounds, buyIn }) }, token);
}

export function rankedProfile(token: string): Promise<{ competitive: CompetitiveState; competitiveByPlayers: RankedLadders; queue: RankedQueueStatus }> {
  return request<{ competitive: CompetitiveState; competitiveByPlayers: RankedLadders; queue: RankedQueueStatus }>('/ranked/me', {}, token);
}

export function joinRankedQueue(token: string, maxPlayers: number): Promise<{ competitive: CompetitiveState; competitiveByPlayers: RankedLadders; queue: RankedQueueStatus }> {
  return request<{ competitive: CompetitiveState; competitiveByPlayers: RankedLadders; queue: RankedQueueStatus }>(
    '/ranked/queue',
    { method: 'POST', body: JSON.stringify({ maxPlayers, rounds: 9 }) },
    token
  );
}

export function rankedQueueStatus(token: string): Promise<{ competitive: CompetitiveState; competitiveByPlayers: RankedLadders; queue: RankedQueueStatus }> {
  return request<{ competitive: CompetitiveState; competitiveByPlayers: RankedLadders; queue: RankedQueueStatus }>('/ranked/queue', {}, token);
}

export function cancelRankedQueue(token: string): Promise<{ queue: RankedQueueStatus }> {
  return request<{ queue: RankedQueueStatus }>('/ranked/queue', { method: 'DELETE' }, token);
}

export function claimRankedSeasonRewards(token: string): Promise<{ granted: RankedSeasonReward[]; competitive: CompetitiveState; user: UserProfile; cosmetics: CosmeticItem[] }> {
  return request<{ granted: RankedSeasonReward[]; competitive: CompetitiveState; user: UserProfile; cosmetics: CosmeticItem[] }>(
    '/ranked/season/rewards/claim',
    { method: 'POST' },
    token
  );
}
