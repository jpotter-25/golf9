export const DEFAULT_WAGER_TABLES = [
  { id: 'free', label: 'Free Play', buyIn: 0, description: 'No entry fee. Earn coins slowly through match rewards.' },
  { id: 'casual-50', label: 'Casual Stakes', buyIn: 50, description: 'A light coin table.' },
  { id: 'competitive-100', label: 'Competitive', buyIn: 100, description: 'A standard wager table.' },
  { id: 'high-250', label: 'High Stakes', buyIn: 250, description: 'A bigger table for confident players.' },
  { id: 'elite-500', label: 'Elite', buyIn: 500, description: 'Top-end wager table.' },
  { id: 'pro-1000', label: 'Pro', buyIn: 1000, description: 'A serious coin table.' },
  { id: 'pro-2000', label: 'Double Pro', buyIn: 2000, description: 'A bigger table for confident regulars.' },
  { id: 'champion-5000', label: 'Champion', buyIn: 5000, description: 'A high-pressure coin table.' },
  { id: 'champion-10000', label: 'Double Champion', buyIn: 10000, description: 'A major buy-in for experienced players.' },
  { id: 'legend-25000', label: 'Legend', buyIn: 25000, description: 'A premium coin table.' },
  { id: 'legend-50000', label: 'Double Legend', buyIn: 50000, description: 'The current top-end wager table.' },
];

export const WAGER_TABLES = DEFAULT_WAGER_TABLES;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_TABLE_BONUS_BASE = 100;
const DAILY_TABLE_BONUS_LOW_BALANCE = 150;
const DAILY_TABLE_BONUS_STREAK_STEP = 25;
const DAILY_TABLE_BONUS_STREAK_MAX = 100;
const LOW_BALANCE_THRESHOLD = 100;

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function cleanText(value, max = 120) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function slugForBuyIn(buyIn) {
  return buyIn > 0 ? `wager-${buyIn}` : 'free';
}

function defaultLabelForBuyIn(buyIn) {
  if (buyIn <= 0) return 'Free Play';
  return buyIn.toLocaleString('en-US');
}

function normalizeWagerTable(input = {}) {
  const buyIn = Math.max(0, safeInteger(input.buyIn, 0));
  return {
    id: cleanText(input.id || slugForBuyIn(buyIn), 64) || slugForBuyIn(buyIn),
    label: cleanText(input.label || defaultLabelForBuyIn(buyIn), 48) || defaultLabelForBuyIn(buyIn),
    buyIn,
    description: cleanText(input.description || (buyIn ? `Buy in for ${defaultLabelForBuyIn(buyIn)} coins.` : 'No entry fee. Earn coins slowly through match rewards.'), 180),
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : true,
    sortOrder: safeInteger(input.sortOrder, buyIn),
  };
}

export function normalizeWagerTables(input = DEFAULT_WAGER_TABLES) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_WAGER_TABLES;
  const byBuyIn = new Map();
  for (const entry of source) {
    const table = normalizeWagerTable(entry);
    if (!table.enabled && !byBuyIn.has(table.buyIn)) continue;
    byBuyIn.set(table.buyIn, table);
  }
  if (!byBuyIn.has(0)) byBuyIn.set(0, normalizeWagerTable(DEFAULT_WAGER_TABLES[0]));
  return [...byBuyIn.values()]
    .filter(table => table.enabled !== false)
    .sort((a, b) => a.buyIn - b.buyIn || a.label.localeCompare(b.label));
}

export function normalizeEconomyConfigStore(input = {}) {
  const config = input && typeof input === 'object' ? input : {};
  return {
    wagerTables: normalizeWagerTables(config.wagerTables),
    updatedAt: safeInteger(config.updatedAt, 0) || null,
    updatedBy: cleanText(config.updatedBy || '', 80) || null,
  };
}

function utcDayStart(now = Date.now()) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function normalizeCurrency(user) {
  user.currency ||= {};
  user.currency.coins = Math.max(0, safeInteger(user.currency.coins, 0));
  user.currency.lifetimeCoins = Math.max(user.currency.coins, safeInteger(user.currency.lifetimeCoins, user.currency.coins));
  user.currency.dailyBonus ||= {};
  const storedClaimedAt = safeInteger(user.currency.dailyBonus.lastClaimedAt, 0) || null;
  const storedClaimDay = safeInteger(user.currency.dailyBonus.lastClaimDay, 0) || null;
  user.currency.dailyBonus.lastClaimedAt = storedClaimedAt || storedClaimDay || null;
  user.currency.dailyBonus.lastClaimDay = storedClaimedAt ? utcDayStart(storedClaimedAt) : storedClaimDay;
  user.currency.dailyBonus.streak = Math.max(0, safeInteger(user.currency.dailyBonus.streak, 0));
  return user.currency;
}

export function publicDailyBonus(user, now = Date.now()) {
  const currency = normalizeCurrency(user);
  const lastClaimedAt = currency.dailyBonus.lastClaimedAt || null;
  const nextAvailableAt = lastClaimedAt ? lastClaimedAt + DAY_MS : now;
  const canClaim = !lastClaimedAt || now >= nextAvailableAt;
  const consecutive = !!lastClaimedAt && now - lastClaimedAt <= DAY_MS * 2;
  const nextStreak = canClaim ? (lastClaimedAt ? (consecutive ? currency.dailyBonus.streak + 1 : 1) : 1) : currency.dailyBonus.streak;
  const baseReward = currency.coins < LOW_BALANCE_THRESHOLD ? DAILY_TABLE_BONUS_LOW_BALANCE : DAILY_TABLE_BONUS_BASE;
  const streakBonus = Math.min(Math.max(0, nextStreak - 1) * DAILY_TABLE_BONUS_STREAK_STEP, DAILY_TABLE_BONUS_STREAK_MAX);
  return {
    canClaim,
    reward: canClaim ? baseReward + streakBonus : 0,
    baseReward,
    streakBonus: canClaim ? streakBonus : 0,
    streak: currency.dailyBonus.streak,
    nextStreak,
    lowBalanceBoost: currency.coins < LOW_BALANCE_THRESHOLD,
    lastClaimedAt,
    nextAvailableAt: canClaim ? now : nextAvailableAt,
  };
}

export function claimDailyTableBonus(user, now = Date.now()) {
  const currency = normalizeCurrency(user);
  const bonus = publicDailyBonus(user, now);
  if (!bonus.canClaim) return { error: 'Daily Table Bonus already claimed.', dailyBonus: bonus };
  const today = utcDayStart(now);
  currency.coins += bonus.reward;
  currency.lifetimeCoins += bonus.reward;
  currency.dailyBonus.lastClaimedAt = now;
  currency.dailyBonus.lastClaimDay = today;
  currency.dailyBonus.streak = bonus.nextStreak;
  return {
    reward: bonus.reward,
    currency,
    dailyBonus: publicDailyBonus(user, now),
  };
}

export function publicEconomyCatalog(user = null, config = null) {
  const economyConfig = normalizeEconomyConfigStore(config || {});
  return {
    wagerTables: economyConfig.wagerTables,
    rankedFees: [],
    coinSources: [
      { id: 'daily-table-bonus', title: 'Daily Table Bonus', description: 'Claim free coins every 24 hours, with a boost when your balance is low.' },
      { id: 'free-play', title: 'Free Play', description: 'Play free online matches to earn modest coins without risking your stack.' },
      { id: 'daily-challenges', title: 'Daily Challenges', description: 'Complete daily goals for XP and coin rewards.' },
      { id: 'weekly-challenges', title: 'Weekly Challenges', description: 'Build bigger weekly payouts through steady play.' },
      { id: 'wager-tables', title: 'Wager Tables', description: 'Risk coins for bigger pots once your balance is healthy.' },
    ],
    dailyBonus: user ? publicDailyBonus(user) : null,
  };
}

export function normalizeBuyIn(value, config = null) {
  const buyIn = Math.max(0, safeInteger(value, 0));
  return normalizeEconomyConfigStore(config || {}).wagerTables.some(table => table.buyIn === buyIn) ? buyIn : 0;
}

export function rankedBuyInForMmr(mmr) {
  safeInteger(mmr, 0);
  return 0;
}

export function payoutSlotsFor(playerCount, buyIn) {
  const safeCount = Math.max(2, Math.min(4, safeInteger(playerCount, 2)));
  const safeBuyIn = Math.max(0, safeInteger(buyIn, 0));
  const pot = safeBuyIn * safeCount;
  if (!safeBuyIn) return Array.from({ length: safeCount }, () => 0);
  if (safeCount === 2) return [pot, 0];
  if (safeCount === 3) {
    const second = Math.floor(safeBuyIn / 2);
    return [pot - second, second, 0];
  }
  return [pot - safeBuyIn, safeBuyIn, 0, 0];
}

export function calculatePayouts(players, buyIn) {
  const safeBuyIn = Math.max(0, safeInteger(buyIn, 0));
  const ordered = players
    .map(player => ({ ...player, total: safeInteger(player.total, 0) }))
    .sort((a, b) => a.total - b.total || String(a.userId).localeCompare(String(b.userId)));
  const slots = payoutSlotsFor(ordered.length, safeBuyIn);
  const payouts = new Map(ordered.map(player => [player.userId, 0]));

  let slotIndex = 0;
  while (slotIndex < ordered.length) {
    const tied = ordered.filter(player => player.total === ordered[slotIndex].total);
    const groupStart = slotIndex;
    const groupEnd = slotIndex + tied.length;
    const pool = slots.slice(groupStart, groupEnd).reduce((sum, value) => sum + value, 0);
    const share = tied.length ? Math.floor(pool / tied.length) : 0;
    let remainder = pool - (share * tied.length);
    for (const player of tied) {
      const extra = remainder > 0 ? 1 : 0;
      payouts.set(player.userId, share + extra);
      remainder -= extra;
    }
    slotIndex = groupEnd;
  }

  return ordered.map((player, index) => ({
    userId: player.userId,
    placement: index + 1,
    buyIn: safeBuyIn,
    payout: payouts.get(player.userId) || 0,
    net: (payouts.get(player.userId) || 0) - safeBuyIn,
  }));
}
