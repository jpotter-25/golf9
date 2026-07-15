const DEFAULTS = Object.freeze({
  takeoverMisses: 2,
  penaltyAutomatedWindows: 4,
  sourceCueMs: 1300,
  commitMs: 3200,
  coinPenalty: 100,
});

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function normalizeAfkConfig(input = {}) {
  const takeoverMisses = integer(input.takeoverMisses, DEFAULTS.takeoverMisses, 1, 10);
  const penaltyAutomatedWindows = integer(
    input.penaltyAutomatedWindows,
    DEFAULTS.penaltyAutomatedWindows,
    takeoverMisses,
    50
  );
  const sourceCueMs = integer(input.sourceCueMs, DEFAULTS.sourceCueMs, 250, 10_000);
  const commitMs = integer(input.commitMs, DEFAULTS.commitMs, sourceCueMs + 250, 30_000);
  return {
    takeoverMisses,
    penaltyAutomatedWindows,
    sourceCueMs,
    commitMs,
    coinPenalty: integer(input.coinPenalty, DEFAULTS.coinPenalty, 0, 1_000_000),
  };
}

export function normalizeAfkPlayerState(input = {}) {
  return {
    consecutiveMisses: integer(input.consecutiveMisses, 0, 0, 10_000),
    automatedWindows: integer(input.automatedWindows, 0, 0, 10_000),
    autoplayActive: input.autoplayActive === true,
    penaltyPending: input.penaltyPending === true,
    activatedAt: Number.isFinite(Number(input.activatedAt)) ? Number(input.activatedAt) : null,
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : null,
  };
}

function withPenalty(state, config) {
  return {
    ...state,
    penaltyPending: state.penaltyPending
      || state.automatedWindows >= config.penaltyAutomatedWindows,
    updatedAt: Date.now(),
  };
}

export function recordMissedAfkWindow(input, rawConfig = {}) {
  const config = normalizeAfkConfig(rawConfig);
  const previous = normalizeAfkPlayerState(input);
  const consecutiveMisses = previous.consecutiveMisses + 1;
  const activated = !previous.autoplayActive && consecutiveMisses >= config.takeoverMisses;
  return {
    activated,
    state: withPenalty({
      ...previous,
      consecutiveMisses,
      automatedWindows: previous.automatedWindows + 1,
      autoplayActive: previous.autoplayActive || activated,
      activatedAt: activated ? Date.now() : previous.activatedAt,
    }, config),
  };
}

export function recordAutomatedAfkWindow(input, rawConfig = {}) {
  const config = normalizeAfkConfig(rawConfig);
  const previous = normalizeAfkPlayerState(input);
  return withPenalty({
    ...previous,
    autoplayActive: true,
    automatedWindows: previous.automatedWindows + 1,
  }, config);
}

export function recordHumanAfkAction(input) {
  const previous = normalizeAfkPlayerState(input);
  return {
    ...previous,
    consecutiveMisses: 0,
    autoplayActive: false,
    activatedAt: null,
    updatedAt: Date.now(),
  };
}

export function applyAfkCoinPenalty(balance, rawConfig = {}) {
  const config = normalizeAfkConfig(rawConfig);
  const numericBalance = Number(balance);
  const available = Number.isFinite(numericBalance) ? Math.max(0, numericBalance) : 0;
  const deducted = Math.min(available, config.coinPenalty);
  return {
    balance: available - deducted,
    deducted,
  };
}

export function placementsWithAfkPenalty(totals, penalized = []) {
  return totals.map((total, index) => {
    const isPenalized = penalized[index] === true;
    const lowerGroupCount = isPenalized
      ? penalized.filter(value => value !== true).length
      : 0;
    const lowerInGroup = totals.filter((otherTotal, otherIndex) => (
      penalized[otherIndex] === isPenalized && otherTotal < total
    )).length;
    const tiedInGroup = totals.filter((otherTotal, otherIndex) => (
      penalized[otherIndex] === isPenalized && otherTotal === total
    )).length;
    return 1 + lowerGroupCount + lowerInGroup + ((tiedInGroup - 1) / 2);
  });
}

export const DEFAULT_AFK_CONFIG = DEFAULTS;
