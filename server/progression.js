import { normalizeCompetitiveState, publicCompetitiveState } from './ranked.js';
import { publicDailyBonus } from './economy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEASON_REWARD_GRACE_MS = 30 * DAY_MS;
const STARTER_COSMETICS = ['classic-card-back', 'rookie-avatar-frame', 'rookie-title', 'classic-table-theme'];

export const COSMETIC_CATALOG = [
  { id: 'classic-card-back', type: 'cardBack', name: 'Classic', description: 'The original Golf 9 card back.', rarity: 'starter', price: 0, shopCategory: 'starter' },
  { id: 'gold-trim-card-back', type: 'cardBack', name: 'Gold Trim', description: 'A clean gold-edged card back.', rarity: 'rare', price: 350, shopCategory: 'coin' },
  { id: 'emerald-card-back', type: 'cardBack', name: 'Emerald', description: 'A sharp green card back for low-score hunters.', rarity: 'rare', price: 500, shopCategory: 'coin' },
  { id: 'neon-card-back', type: 'cardBack', name: 'Neon Grid', description: 'A bright table-night card back.', rarity: 'epic', price: 800, shopCategory: 'coin' },
  { id: 's1-gold-card-back', type: 'cardBack', name: 'Season 1 Gold Run', description: 'Reach Gold this season, then buy this ranked card back.', rarity: 'epic', price: 2500, shopCategory: 'ranked', unlockRequirement: 'rank', requiredMmr: 2000, requiredLeague: 'Gold', seasonId: 'season-1' },
  { id: 's1-master-card-back', type: 'cardBack', name: 'Season 1 Master', description: 'Reach Master this season, then buy this ranked card back.', rarity: 'epic', price: 12000, shopCategory: 'ranked', unlockRequirement: 'rank', requiredMmr: 5000, requiredLeague: 'Master', seasonId: 'season-1' },
  { id: 'club-crest-card-back', type: 'cardBack', name: 'Club Crest', description: 'A club card back earned by contributing to your club.', rarity: 'rare', price: 0, shopCategory: 'club', unlockRequirement: 'club' },
  { id: 'club-champion-card-back', type: 'cardBack', name: 'Club Champion', description: 'A premium club card back for major contributors.', rarity: 'epic', price: 0, shopCategory: 'club', unlockRequirement: 'club' },
  { id: 'classic-table-theme', type: 'tableTheme', name: 'Classic Table', description: 'The original dark Golf 9 table.', rarity: 'starter', price: 0, shopCategory: 'starter' },
  { id: 'emerald-felt-table-theme', type: 'tableTheme', name: 'Emerald Felt', description: 'A richer green felt table surface.', rarity: 'rare', price: 650, shopCategory: 'coin' },
  { id: 'carbon-table-theme', type: 'tableTheme', name: 'Carbon Night', description: 'A clean high-contrast table surface.', rarity: 'epic', price: 1000, shopCategory: 'coin' },
  { id: 's1-platinum-table-theme', type: 'tableTheme', name: 'Season 1 Platinum', description: 'Reach Platinum this season, then buy this ranked table theme.', rarity: 'epic', price: 4000, shopCategory: 'ranked', unlockRequirement: 'rank', requiredMmr: 3000, requiredLeague: 'Platinum', seasonId: 'season-1' },
  { id: 'club-felt-table-theme', type: 'tableTheme', name: 'Club Felt', description: 'A club table theme unlocked through shared progress.', rarity: 'rare', price: 0, shopCategory: 'club', unlockRequirement: 'club' },
  { id: 'rookie-avatar-frame', type: 'avatarFrame', name: 'Rookie Frame', description: 'A starter profile frame.', rarity: 'starter', price: 0, shopCategory: 'starter' },
  { id: 'emerald-avatar-frame', type: 'avatarFrame', name: 'Emerald Frame', description: 'A polished green profile frame.', rarity: 'rare', price: 450, shopCategory: 'coin' },
  { id: 'gold-avatar-frame', type: 'avatarFrame', name: 'Gold Frame', description: 'A gold profile frame for regular winners.', rarity: 'epic', price: 900, shopCategory: 'coin' },
  { id: 's1-bronze-frame', type: 'avatarFrame', name: 'Season 1 Bronze', description: 'Play ranked this season, then buy this ranked frame.', rarity: 'rare', price: 750, shopCategory: 'ranked', unlockRequirement: 'rank', requiredMmr: 0, requiredLeague: 'Bronze', seasonId: 'season-1' },
  { id: 's1-diamond-frame', type: 'avatarFrame', name: 'Season 1 Diamond', description: 'Reach Diamond this season, then buy this ranked frame.', rarity: 'epic', price: 7500, shopCategory: 'ranked', unlockRequirement: 'rank', requiredMmr: 4000, requiredLeague: 'Diamond', seasonId: 'season-1' },
  { id: 'club-emerald-frame', type: 'avatarFrame', name: 'Club Emerald', description: 'An emerald club avatar frame for active clubmates.', rarity: 'rare', price: 0, shopCategory: 'club', unlockRequirement: 'club' },
  { id: 'rookie-title', type: 'title', name: 'Rookie', description: 'Your first Golf 9 title.', rarity: 'starter', price: 0, shopCategory: 'starter' },
  { id: 'column-cleaner-title', type: 'title', name: 'Column Cleaner', description: 'A title for players who love three-of-a-kind clears.', rarity: 'rare', price: 600, shopCategory: 'coin' },
  { id: 'table-shark-title', type: 'title', name: 'Table Shark', description: 'A confident title for the lobby.', rarity: 'epic', price: 1200, shopCategory: 'coin' },
  { id: 's1-silver-title', type: 'title', name: 'Silver Climber', description: 'Reach Silver this season, then buy this ranked title.', rarity: 'rare', price: 1000, shopCategory: 'ranked', unlockRequirement: 'rank', requiredMmr: 1000, requiredLeague: 'Silver', seasonId: 'season-1' },
  { id: 's1-legend-title', type: 'title', name: 'Legend', description: 'Reach Legend this season, then buy this ranked title.', rarity: 'epic', price: 20000, shopCategory: 'ranked', unlockRequirement: 'rank', requiredMmr: 6000, requiredLeague: 'Legend', seasonId: 'season-1' },
  { id: 'club-regular-title', type: 'title', name: 'Club Regular', description: 'A title for reliable club contributors.', rarity: 'rare', price: 0, shopCategory: 'club', unlockRequirement: 'club' },
];

const DAILY_CHALLENGES = [
  { templateId: 'daily_match', title: 'Warm-Up Table', description: 'Complete 1 match.', metric: 'matches', target: 1, reward: { xp: 150, coins: 50 } },
  { templateId: 'daily_columns', title: 'Column Work', description: 'Clear 2 columns.', metric: 'columnClears', target: 2, reward: { xp: 200, coins: 75 } },
  { templateId: 'daily_low_total', title: 'Keep It Tight', description: 'Finish a match at 30 or lower.', metric: 'lowTotal', threshold: 30, target: 1, reward: { xp: 250, coins: 90 } },
];

const WEEKLY_CHALLENGES = [
  { templateId: 'weekly_matches', title: 'Weekly Rotation', description: 'Complete 5 matches.', metric: 'matches', target: 5, reward: { xp: 700, coins: 250 } },
  { templateId: 'weekly_wins', title: 'Winner Circle', description: 'Win 3 matches.', metric: 'wins', target: 3, reward: { xp: 900, coins: 350 } },
  { templateId: 'weekly_columns', title: 'Clear Specialist', description: 'Clear 10 columns.', metric: 'columnClears', target: 10, reward: { xp: 850, coins: 325 } },
  { templateId: 'weekly_social', title: 'Table Talk', description: 'Send 5 chats or reactions.', metric: 'socialMessages', target: 5, reward: { xp: 500, coins: 180 } },
];

export const ACHIEVEMENTS = [
  {
    id: 'first_match',
    name: 'First Round Table',
    description: 'Complete your first match.',
    reward: { xp: 100, coins: 25 },
    isUnlocked: stats => stats.gamesPlayed >= 1,
  },
  {
    id: 'first_win',
    name: 'First Win',
    description: 'Win a match.',
    reward: { xp: 200, coins: 75 },
    isUnlocked: stats => stats.wins >= 1,
  },
  {
    id: 'low_round',
    name: 'Low Round',
    description: 'Score 10 or lower in a round.',
    reward: { xp: 150, coins: 50 },
    isUnlocked: stats => typeof stats.bestRound === 'number' && stats.bestRound <= 10,
  },
  {
    id: 'column_cleaner',
    name: 'Column Cleaner',
    description: 'Clear a three-of-a-kind column.',
    reward: { xp: 150, coins: 50 },
    isUnlocked: stats => stats.columnClears >= 1,
  },
  {
    id: 'social_starter',
    name: 'Social Starter',
    description: 'Send your first in-game chat or reaction.',
    reward: { xp: 75, coins: 25 },
    isUnlocked: stats => stats.socialMessagesSent >= 1,
  },
  {
    id: 'table_regular',
    name: 'Table Regular',
    description: 'Complete 10 matches.',
    reward: { xp: 300, coins: 125 },
    isUnlocked: stats => stats.gamesPlayed >= 10,
  },
];

export function xpNeededForLevel(level) {
  if (level < 10) return 1000;
  if (level < 25) return 2500;
  if (level < 50) return 5000;
  return 5000 + ((level - 49) * 750);
}

export function levelSnapshot(totalXp = 0) {
  let level = 1;
  let remaining = Math.max(0, Math.floor(Number(totalXp) || 0));
  while (remaining >= xpNeededForLevel(level)) {
    remaining -= xpNeededForLevel(level);
    level += 1;
  }
  const nextLevelXp = xpNeededForLevel(level);
  return {
    level,
    totalXp: Math.max(0, Math.floor(Number(totalXp) || 0)),
    currentLevelXp: remaining,
    nextLevelXp,
    levelProgress: nextLevelXp > 0 ? remaining / nextLevelXp : 0,
  };
}

function numericOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function utcDayStart(now = Date.now()) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function utcWeekStart(now = Date.now()) {
  const start = utcDayStart(now);
  const day = new Date(start).getUTCDay();
  const mondayOffset = (day + 6) % 7;
  return start - (mondayOffset * DAY_MS);
}

function periodFor(cadence, now = Date.now()) {
  if (cadence === 'weekly') {
    const periodStart = utcWeekStart(now);
    return { periodStart, expiresAt: periodStart + (7 * DAY_MS) };
  }
  const periodStart = utcDayStart(now);
  return { periodStart, expiresAt: periodStart + DAY_MS };
}

function buildChallenge(cadence, template, periodStart, expiresAt, previous = null) {
  return {
    id: `${cadence}:${template.templateId}:${periodStart}`,
    templateId: template.templateId,
    cadence,
    title: template.title,
    description: template.description,
    metric: template.metric,
    threshold: template.threshold ?? null,
    target: template.target,
    progress: Math.min(template.target, Number(previous?.progress ?? 0) || 0),
    reward: template.reward,
    periodStart,
    expiresAt,
    completedAt: previous?.completedAt ?? null,
    claimedAt: previous?.claimedAt ?? null,
  };
}

function ensureChallengeBucket(user, cadence, templates, now = Date.now()) {
  const period = periodFor(cadence, now);
  user.challenges ||= {};
  const previousBucket = user.challenges[cadence];
  const previousItems = previousBucket?.periodStart === period.periodStart ? previousBucket.items || [] : [];
  user.challenges[cadence] = {
    periodStart: period.periodStart,
    expiresAt: period.expiresAt,
    items: templates.map(template => buildChallenge(
      cadence,
      template,
      period.periodStart,
      period.expiresAt,
      previousItems.find(item => item.templateId === template.templateId)
    )),
  };
}

function ensureChallenges(user, now = Date.now()) {
  ensureChallengeBucket(user, 'daily', DAILY_CHALLENGES, now);
  ensureChallengeBucket(user, 'weekly', WEEKLY_CHALLENGES, now);
  return user.challenges;
}

function allChallenges(user, now = Date.now()) {
  ensureChallenges(user, now);
  return [
    ...(user.challenges?.daily?.items || []),
    ...(user.challenges?.weekly?.items || []),
  ];
}

function publicChallenge(challenge) {
  return {
    id: challenge.id,
    templateId: challenge.templateId,
    cadence: challenge.cadence,
    title: challenge.title,
    description: challenge.description,
    metric: challenge.metric,
    target: challenge.target,
    progress: Math.min(challenge.target, challenge.progress),
    reward: challenge.reward,
    expiresAt: challenge.expiresAt,
    completedAt: challenge.completedAt,
    claimedAt: challenge.claimedAt,
    canClaim: !!challenge.completedAt && !challenge.claimedAt,
  };
}

function publicChallenges(user) {
  ensureChallenges(user);
  return {
    daily: {
      periodStart: user.challenges.daily.periodStart,
      expiresAt: user.challenges.daily.expiresAt,
      items: user.challenges.daily.items.map(publicChallenge),
    },
    weekly: {
      periodStart: user.challenges.weekly.periodStart,
      expiresAt: user.challenges.weekly.expiresAt,
      items: user.challenges.weekly.items.map(publicChallenge),
    },
  };
}

function rankedSeasonPurchaseWindowOpen(item, rankedSeason, now = Date.now()) {
  if (!item.seasonId) return true;
  return !rankedSeason?.endsAt || now <= rankedSeason.endsAt + SEASON_REWARD_GRACE_MS;
}

function effectiveCosmeticPrice(item, now = Date.now()) {
  const basePrice = Math.max(0, Math.floor(Number(item?.price) || 0));
  const salePrice = Math.max(0, Math.floor(Number(item?.salePrice) || 0));
  const startsOk = !item?.saleStartsAt || now >= Number(item.saleStartsAt);
  const endsOk = !item?.saleEndsAt || now <= Number(item.saleEndsAt);
  const onSale = Boolean(item?.sale) && salePrice < basePrice && startsOk && endsOk;
  return {
    basePrice,
    salePrice: onSale ? salePrice : null,
    effectivePrice: onSale ? salePrice : basePrice,
    onSale,
  };
}

function cosmeticEligibility(user, item, rankedSeason = null, now = Date.now(), competitiveConfig = null) {
  if (!item.unlockRequirement) return { eligible: true, lockedReason: null, unlockStatus: 'unlocked' };
  if (item.unlockRequirement === 'rank') {
    const competitive = publicCompetitiveState(user, rankedSeason || undefined, competitiveConfig);
    const earned = competitive.seasonBestMmr >= Number(item.requiredMmr ?? 0);
    const windowOpen = rankedSeasonPurchaseWindowOpen(item, rankedSeason, now);
    if (!earned) {
      return {
        eligible: false,
        lockedReason: `Reach ${item.requiredLeague || 'the required rank'} this season.`,
        unlockStatus: 'locked',
      };
    }
    if (!windowOpen) {
      return {
        eligible: false,
        lockedReason: 'This season cosmetic is vaulted.',
        unlockStatus: 'vaulted',
      };
    }
    return { eligible: true, lockedReason: null, unlockStatus: 'unlocked' };
  }
  if (item.unlockRequirement === 'club') {
    return {
      eligible: user.inventory.cosmetics.includes(item.id),
      lockedReason: 'Earn this through club rewards.',
      unlockStatus: user.inventory.cosmetics.includes(item.id) ? 'unlocked' : 'locked',
    };
  }
  return { eligible: false, lockedReason: 'Complete the unlock requirement first.', unlockStatus: 'locked' };
}

function publicCosmeticItem(user, item, rankedSeason = null, now = Date.now(), competitiveConfig = null) {
  const owned = user.inventory.cosmetics.includes(item.id);
  const equipped = user.inventory.equipped[item.type] === item.id;
  const eligibility = owned ? { eligible: true, lockedReason: null, unlockStatus: 'owned' } : cosmeticEligibility(user, item, rankedSeason, now, competitiveConfig);
  const price = effectiveCosmeticPrice(item, now);
  const disabled = item.enabled === false || !!item.archivedAt;
  return {
    ...item,
    unlockRequirement: item.unlockRequirement || null,
    requiredMmr: item.requiredMmr ?? null,
    requiredLeague: item.requiredLeague ?? null,
    seasonId: item.seasonId ?? null,
    shopCategory: item.shopCategory || 'coin',
    basePrice: price.basePrice,
    salePrice: price.salePrice,
    effectivePrice: price.effectivePrice,
    onSale: price.onSale,
    enabled: item.enabled !== false,
    eligible: eligibility.eligible,
    lockedReason: disabled && !owned ? 'This cosmetic is not currently available.' : eligibility.lockedReason,
    unlockStatus: owned ? 'owned' : eligibility.unlockStatus,
    owned,
    equipped,
    canAfford: owned || (!disabled && eligibility.eligible && user.currency.coins >= price.effectivePrice),
  };
}

export function publicCosmeticCatalog(user, rankedSeason = null, catalog = COSMETIC_CATALOG, competitiveConfig = null) {
  normalizeUserProgression(user, Date.now(), rankedSeason, competitiveConfig);
  const source = Array.isArray(catalog) && catalog.length ? catalog : COSMETIC_CATALOG;
  return source
    .filter(item => item.enabled !== false || user.inventory.cosmetics.includes(item.id))
    .filter(item => !item.archivedAt || user.inventory.cosmetics.includes(item.id))
    .map(item => publicCosmeticItem(user, item, rankedSeason, Date.now(), competitiveConfig));
}

function defaultStatistics(user) {
  const legacy = user.stats || {};
  const gamesPlayed = Number(user.statistics?.gamesPlayed ?? legacy.gamesPlayed ?? 0) || 0;
  const wins = Number(user.statistics?.wins ?? legacy.wins ?? 0) || 0;
  return {
    gamesPlayed,
    wins,
    losses: Number(user.statistics?.losses ?? Math.max(0, gamesPlayed - wins)) || 0,
    onlineGames: Number(user.statistics?.onlineGames ?? 0) || 0,
    soloGames: Number(user.statistics?.soloGames ?? 0) || 0,
    passPlayGames: Number(user.statistics?.passPlayGames ?? 0) || 0,
    roundsPlayed: Number(user.statistics?.roundsPlayed ?? 0) || 0,
    totalScore: Number(user.statistics?.totalScore ?? 0) || 0,
    bestTotal: numericOrNull(user.statistics?.bestTotal),
    bestRound: numericOrNull(user.statistics?.bestRound),
    columnClears: Number(user.statistics?.columnClears ?? 0) || 0,
    socialMessagesSent: Number(user.statistics?.socialMessagesSent ?? 0) || 0,
  };
}

function defaultCurrency(user) {
  const coins = Number(user.currency?.coins ?? 0) || 0;
  const dailyBonus = user.currency?.dailyBonus || {};
  return {
    coins,
    lifetimeCoins: Number(user.currency?.lifetimeCoins ?? coins) || 0,
    dailyBonus: {
      lastClaimedAt: Number(dailyBonus.lastClaimedAt ?? 0) || null,
      lastClaimDay: Number(dailyBonus.lastClaimDay ?? 0) || null,
      streak: Math.max(0, Number(dailyBonus.streak ?? 0) || 0),
    },
  };
}

function defaultInventory(user) {
  const cosmetics = Array.isArray(user.inventory?.cosmetics) ? [...user.inventory.cosmetics] : [];
  for (const id of STARTER_COSMETICS) {
    if (!cosmetics.includes(id)) cosmetics.push(id);
  }
  return {
    cosmetics,
    equipped: {
      cardBack: user.inventory?.equipped?.cardBack || 'classic-card-back',
      avatarFrame: user.inventory?.equipped?.avatarFrame || 'rookie-avatar-frame',
      title: user.inventory?.equipped?.title || 'rookie-title',
      tableTheme: user.inventory?.equipped?.tableTheme || 'classic-table-theme',
    },
  };
}

export function normalizeUserProgression(user, now = Date.now(), rankedSeason = null, competitiveConfig = null) {
  user.statistics = defaultStatistics(user);
  const totalXp = Number(user.progression?.totalXp ?? user.progression?.xp ?? 0) || 0;
  user.progression = levelSnapshot(totalXp);
  user.currency = defaultCurrency(user);
  user.inventory = defaultInventory(user);
  user.achievements = Array.isArray(user.achievements) ? user.achievements.filter(item => item?.id) : [];
  ensureChallenges(user, now);
  normalizeCompetitiveState(user, rankedSeason || undefined, competitiveConfig);
  user.stats = {
    gamesPlayed: user.statistics.gamesPlayed,
    wins: user.statistics.wins,
  };
  return user;
}

function publicAchievement(user, definition) {
  const unlocked = user.achievements.find(item => item.id === definition.id);
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    reward: definition.reward,
    unlockedAt: unlocked?.unlockedAt ?? null,
  };
}

export function publicUserProfile(user, rankedSeason = null, competitiveConfig = null) {
  normalizeUserProgression(user, Date.now(), rankedSeason, competitiveConfig);
  return {
    userId: user.userId,
    displayName: user.displayName,
    avatarInitial: user.displayName.trim().slice(0, 1).toUpperCase(),
    stats: user.stats,
    progression: user.progression,
    statistics: user.statistics,
    achievements: ACHIEVEMENTS.map(definition => publicAchievement(user, definition)),
    currency: { ...user.currency, dailyBonus: publicDailyBonus(user) },
    inventory: user.inventory,
    challenges: publicChallenges(user),
    competitive: publicCompetitiveState(user, rankedSeason || undefined, competitiveConfig),
  };
}

function grantProgression(user, xp, coins, now = Date.now()) {
  normalizeUserProgression(user, now);
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const safeCoins = Math.max(0, Math.floor(Number(coins) || 0));
  user.progression = levelSnapshot(user.progression.totalXp + safeXp);
  user.currency.coins += safeCoins;
  user.currency.lifetimeCoins += safeCoins;
}

function unlockEligibleAchievements(user, now = Date.now()) {
  normalizeUserProgression(user, now);
  const alreadyUnlocked = new Set(user.achievements.map(item => item.id));
  const unlocked = [];
  for (const definition of ACHIEVEMENTS) {
    if (alreadyUnlocked.has(definition.id) || !definition.isUnlocked(user.statistics)) continue;
    const item = { id: definition.id, unlockedAt: now };
    user.achievements.push(item);
    grantProgression(user, definition.reward.xp, definition.reward.coins, now);
    unlocked.push({ ...publicAchievement(user, definition), unlockedAt: item.unlockedAt });
  }
  return unlocked;
}

function challengeDelta(challenge, event) {
  if (event.kind === 'social') {
    return challenge.metric === 'socialMessages' ? 1 : 0;
  }
  if (event.kind !== 'match') return 0;
  switch (challenge.metric) {
    case 'matches':
      return 1;
    case 'wins':
      return event.won ? 1 : 0;
    case 'columnClears':
      return Math.max(0, Math.floor(Number(event.columnClears ?? 0) || 0));
    case 'lowTotal':
      return Number(event.total ?? 0) <= Number(challenge.threshold ?? 0) ? 1 : 0;
    default:
      return 0;
  }
}

function updateChallengeProgress(user, event, now = Date.now()) {
  normalizeUserProgression(user, now);
  ensureChallenges(user, now);
  const completed = [];
  for (const challenge of allChallenges(user, now)) {
    if (challenge.claimedAt) continue;
    const delta = challengeDelta(challenge, event);
    if (!delta) continue;
    const wasComplete = !!challenge.completedAt;
    challenge.progress = Math.min(challenge.target, challenge.progress + delta);
    if (!wasComplete && challenge.progress >= challenge.target) {
      challenge.completedAt = now;
      completed.push(publicChallenge(challenge));
    }
  }
  return completed;
}

function progressionSummarySince(user, levelBefore, totalXpBefore, coinsBefore, achievementsUnlocked = [], challengesCompleted = [], now = Date.now()) {
  normalizeUserProgression(user, now);
  return {
    xpGained: user.progression.totalXp - totalXpBefore,
    coinsGained: user.currency.coins - coinsBefore,
    levelBefore,
    levelAfter: user.progression.level,
    totalXp: user.progression.totalXp,
    achievementsUnlocked,
    challengesCompleted,
  };
}

function findChallenge(user, challengeId, now = Date.now()) {
  normalizeUserProgression(user, now);
  ensureChallenges(user, now);
  return allChallenges(user, now).find(item => item.id === challengeId) || null;
}

export function claimChallengeReward(user, challengeId, now = Date.now()) {
  normalizeUserProgression(user, now);
  const challenge = findChallenge(user, challengeId, now);
  if (!challenge) return { error: 'Challenge not found.' };
  if (!challenge.completedAt) return { error: 'Challenge is not complete yet.' };
  if (challenge.claimedAt) return { error: 'Challenge reward already claimed.' };
  const levelBefore = user.progression.level;
  const totalXpBefore = user.progression.totalXp;
  const coinsBefore = user.currency.coins;
  challenge.claimedAt = now;
  grantProgression(user, challenge.reward.xp, challenge.reward.coins, now);
  return {
    challenge: publicChallenge(challenge),
    progression: progressionSummarySince(user, levelBefore, totalXpBefore, coinsBefore, [], [], now),
  };
}

export function purchaseCosmetic(user, cosmeticId, rankedSeason = null, catalog = COSMETIC_CATALOG, competitiveConfig = null) {
  normalizeUserProgression(user, Date.now(), rankedSeason, competitiveConfig);
  const source = Array.isArray(catalog) && catalog.length ? catalog : COSMETIC_CATALOG;
  const cosmetic = source.find(item => item.id === cosmeticId);
  if (!cosmetic) return { error: 'Cosmetic not found.' };
  if (cosmetic.enabled === false || cosmetic.archivedAt) return { error: 'This cosmetic is not currently available.' };
  if (user.inventory.cosmetics.includes(cosmetic.id)) return { error: 'Cosmetic already owned.' };
  const eligibility = cosmeticEligibility(user, cosmetic, rankedSeason, Date.now(), competitiveConfig);
  if (!eligibility.eligible) return { error: eligibility.lockedReason || 'Cosmetic is locked.' };
  const price = effectiveCosmeticPrice(cosmetic).effectivePrice;
  if (user.currency.coins < price) return { error: 'Not enough coins.' };
  user.currency.coins -= price;
  user.inventory.cosmetics.push(cosmetic.id);
  return { cosmetic: publicCosmeticItem(user, cosmetic, rankedSeason, Date.now(), competitiveConfig) };
}

export function equipCosmetic(user, cosmeticId, catalog = COSMETIC_CATALOG, rankedSeason = null, competitiveConfig = null) {
  normalizeUserProgression(user, Date.now(), rankedSeason, competitiveConfig);
  const source = Array.isArray(catalog) && catalog.length ? catalog : COSMETIC_CATALOG;
  const cosmetic = source.find(item => item.id === cosmeticId);
  if (!cosmetic) return { error: 'Cosmetic not found.' };
  if (!user.inventory.cosmetics.includes(cosmetic.id)) return { error: 'Cosmetic is locked.' };
  user.inventory.equipped[cosmetic.type] = cosmetic.id;
  return { cosmetic: publicCosmeticItem(user, cosmetic, rankedSeason, Date.now(), competitiveConfig) };
}

function modeKey(mode) {
  if (mode === 'solo') return 'soloGames';
  if (mode === 'passplay') return 'passPlayGames';
  return 'onlineGames';
}

function scoreBonus(total, bestRound) {
  let xp = 0;
  let coins = 0;
  if (total <= 0) {
    xp += 150;
    coins += 40;
  } else if (total <= 20) {
    xp += 100;
    coins += 25;
  } else if (total <= 40) {
    xp += 50;
    coins += 10;
  }
  if (typeof bestRound === 'number' && bestRound <= 10) {
    xp += bestRound <= 0 ? 125 : 75;
    coins += bestRound <= 0 ? 35 : 20;
  }
  return { xp, coins };
}

export function applyMatchProgression(user, match, now = Date.now()) {
  normalizeUserProgression(user, now);
  const levelBefore = user.progression.level;
  const totalXpBefore = user.progression.totalXp;
  const coinsBefore = user.currency.coins;
  const total = Number(match.total ?? 0) || 0;
  const roundScores = Array.isArray(match.roundScores) ? match.roundScores.filter(Number.isFinite) : [];
  const bestRound = roundScores.length ? Math.min(...roundScores) : null;
  const roundsPlayed = Number(match.totalRounds ?? roundScores.length ?? 0) || 0;
  const columnClears = Math.max(0, Math.floor(Number(match.columnClears ?? 0) || 0));
  const mode = match.mode === 'solo' || match.mode === 'passplay' ? match.mode : 'online';
  const won = !!match.won;
  const coinScale = Number.isFinite(match.coinScale) ? Math.max(0, Number(match.coinScale)) : 1;

  user.statistics.gamesPlayed += 1;
  user.statistics.wins += won ? 1 : 0;
  user.statistics.losses += won ? 0 : 1;
  user.statistics[modeKey(mode)] += 1;
  user.statistics.roundsPlayed += roundsPlayed;
  user.statistics.totalScore += total;
  user.statistics.bestTotal = user.statistics.bestTotal == null ? total : Math.min(user.statistics.bestTotal, total);
  if (bestRound != null) {
    user.statistics.bestRound = user.statistics.bestRound == null ? bestRound : Math.min(user.statistics.bestRound, bestRound);
  }
  user.statistics.columnClears += columnClears;

  let xp = 250 + (roundsPlayed * 25) + (won ? 300 : 0) + (columnClears * 60);
  let coins = 25 + (won ? 50 : 0) + (columnClears * 10);
  const bonus = scoreBonus(total, bestRound);
  xp += bonus.xp;
  coins += bonus.coins;
  coins = Math.floor(coins * coinScale);

  grantProgression(user, xp, coins, now);
  const achievementsUnlocked = unlockEligibleAchievements(user, now);
  const challengesCompleted = updateChallengeProgress(user, {
    kind: 'match',
    total,
    won,
    columnClears,
  }, now);
  normalizeUserProgression(user, now);

  return progressionSummarySince(user, levelBefore, totalXpBefore, coinsBefore, achievementsUnlocked, challengesCompleted, now);
}

export function registerSocialMessage(user, now = Date.now()) {
  normalizeUserProgression(user, now);
  const levelBefore = user.progression.level;
  const totalXpBefore = user.progression.totalXp;
  const coinsBefore = user.currency.coins;
  user.statistics.socialMessagesSent += 1;
  const achievementsUnlocked = unlockEligibleAchievements(user, now);
  const challengesCompleted = updateChallengeProgress(user, { kind: 'social' }, now);
  normalizeUserProgression(user, now);
  return progressionSummarySince(user, levelBefore, totalXpBefore, coinsBefore, achievementsUnlocked, challengesCompleted, now);
}
