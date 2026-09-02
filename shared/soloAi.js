import {
  COLS,
  ROWS,
  cardValue,
  discardDrawn,
  drawFromDeck,
  pickTarget as legacyPickTarget,
  replaceGridCard,
  resolvePendingGridDecision,
  revealGridCardForDecision,
  takeDiscard,
} from './rules.js';

const HARD_DIRECT_KEEP_MAX = 2;
const HARD_SETUP_MAX = 7;
const HARD_REVEAL_MAX = 7;
const HARD_HIDDEN_BYPASS_IMPROVEMENT = 5;
const EASY_FINAL_HESITATION_PERCENT = 20;

export function planAiTurn(state, playerIndex, policy = 'easy') {
  const normalizedPolicy = normalizePolicy(policy);
  const context = decisionContext(state, playerIndex);
  const move = normalizedPolicy === 'afk'
    ? chooseAfkAiMove(state, playerIndex)
    : chooseStrategicAiMove(state, playerIndex, normalizedPolicy, context);
  return {
    ...move,
    playerIndex,
    policy: normalizedPolicy,
    fingerprint: turnFingerprint(state, playerIndex),
    cardId: move.card?.id || null,
  };
}

export function executeAiTurn(state, plan) {
  if (!isCurrentTurnPlan(state, plan)) return state;
  return plan.policy === 'afk'
    ? playPlannedAfkTurn(state, plan)
    : playPlannedStrategicTurn(state, plan);
}

export function chooseAiMove(state, playerIndex, difficulty = 'easy') {
  return planAiTurn(state, playerIndex, difficulty);
}

export function aiPlayTurn(state, playerIndex, difficulty = 'easy') {
  return executeAiTurn(state, planAiTurn(state, playerIndex, difficulty));
}

export function chooseAiPeekTargets(state, playerIndex, count = 2) {
  const grid = state?.players?.[playerIndex]?.grid;
  if (!grid) return [];
  const candidates = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const card = grid[r]?.[c];
      if (card && !card.faceUp) candidates.push({ r, c });
    }
  }
  const context = decisionContext(state, playerIndex);
  return candidates
    .map(target => ({
      target,
      order: stableHash(`${context.seed}|opening-peek|${target.r}:${target.c}`),
    }))
    .sort((left, right) => right.order - left.order || targetKey(left.target).localeCompare(targetKey(right.target)))
    .slice(0, Math.max(0, Math.min(candidates.length, Math.floor(Number(count) || 0))))
    .map(entry => entry.target);
}

export function countFaceDownCards(grid) {
  if (!grid) return 0;
  let total = 0;
  for (const row of grid) {
    for (const card of row) {
      if (card && !card.faceUp) total += 1;
    }
  }
  return total;
}

function playPlannedAfkTurn(state, plan) {
  let working = state;
  const playerIndex = plan.playerIndex;

  if (plan.source === 'discard') {
    const taken = takeDiscard(working);
    if (taken.error || !plannedCardMatches(taken.drawn, plan)) return state;
    working = taken.state;
    return playAfkCardAtTarget(working, playerIndex, taken.drawn, plan.target);
  }

  const drawn = drawFromDeck(working);
  if (drawn.error || !plannedCardMatches(drawn.drawn, plan)) return state;
  working = drawn.state;
  return playAfkCardAtTarget(working, playerIndex, drawn.drawn, plan.target);
}

function playAfkCardAtTarget(state, playerIndex, drawn, target) {
  const grid = state.players[playerIndex]?.grid;
  if (canRevealForDecision(grid, target?.r, target?.c)) {
    const revealed = revealGridCardForDecision(state, playerIndex, target.r, target.c);
    if (!revealed.error) {
      const choice = chooseLowerValueRevealDecision(revealed.state, playerIndex, drawn, target);
      return resolvePendingGridDecision(revealed.state, playerIndex, drawn, choice).state;
    }
  }
  if (!target) return state;
  return replaceGridCard(state, playerIndex, target.r, target.c, drawn).state;
}

function playPlannedStrategicTurn(state, plan) {
  let working = state;
  const playerIndex = plan.playerIndex;

  if (plan.source === 'discard') {
    const taken = takeDiscard(working);
    if (taken.error || !plannedCardMatches(taken.drawn, plan)) return state;
    working = taken.state;
    const target = plan.target;
    if (!target) return state;
    return replaceGridCard(working, playerIndex, target.r, target.c, taken.drawn).state;
  }

  const drawn = drawFromDeck(working);
  if (drawn.error || !plannedCardMatches(drawn.drawn, plan)) return state;
  working = drawn.state;

  if (plan.discardDrawn) {
    return discardDrawn(working, playerIndex, drawn.drawn).state;
  }

  const target = plan.target;
  if (!target) return state;
  if (plan.revealThenDecide) {
    const revealed = revealGridCardForDecision(working, playerIndex, target.r, target.c);
    if (!revealed.error) {
      const choice = chooseRevealDecision(revealed.state, playerIndex, drawn.drawn, target);
      return resolvePendingGridDecision(revealed.state, playerIndex, drawn.drawn, choice).state;
    }
  }

  return replaceGridCard(working, playerIndex, target.r, target.c, drawn.drawn).state;
}

function chooseAfkAiMove(state, playerIndex) {
  const source = chooseEasySource(state, playerIndex);
  const card = source === 'discard' ? state.topDiscard : peekDrawCard(state);
  const grid = state.players[playerIndex]?.grid;
  const target = card && grid ? chooseEasyTarget(grid, card) : null;
  const revealThenDecide = !!target && canRevealForDecision(grid, target.r, target.c);
  return {
    source,
    card,
    target: target ? { playerIndex, r: target.r, c: target.c } : null,
    discardDrawn: false,
    revealThenDecide,
    intent: revealThenDecide
      ? 'simple-reveal-before-commit'
      : source === 'discard' ? 'take-obvious-discard' : 'simple-draw-replace',
  };
}

function chooseStrategicAiMove(state, playerIndex, policy, context) {
  const grid = state.players[playerIndex]?.grid;
  const oneHidden = !state.sweepActive && countFaceDownCards(grid) === 1;
  const avoidBecauseTrailing = oneHidden && !hasLowestRoundScore(state, playerIndex);
  let move = buildStrategicAiMove(state, playerIndex, context, avoidBecauseTrailing);
  const wouldEndRound = oneHidden
    && move.target
    && !grid?.[move.target.r]?.[move.target.c]?.faceUp;
  const hesitate = policy === 'easy'
    && wouldEndRound
    && stableHash(`${context.seed}|easy-final-hesitation`) % 100 < EASY_FINAL_HESITATION_PERCENT;
  if (hesitate) move = buildStrategicAiMove(state, playerIndex, context, true);
  return { ...move, finalCardHesitation: hesitate };
}

function buildStrategicAiMove(state, playerIndex, context, avoidFinalHidden) {
  const source = chooseHardSource(state, playerIndex, context, avoidFinalHidden);
  if (source === 'discard') {
    const card = state.topDiscard;
    const target = card ? chooseDirectTargetForKeptCard(state.players[playerIndex].grid, card, {
      avoidFinalHidden,
      context,
    }) : null;
    return {
      source,
      card,
      target: target ? { playerIndex, r: target.r, c: target.c } : null,
      discardDrawn: false,
      intent: 'take-discard-for-value',
    };
  }

  const card = peekDrawCard(state);
  if (!card) {
    return { source: 'draw', card: null, target: null, discardDrawn: false, intent: 'no-card' };
  }
  return chooseHardDrawnCardMove(state, playerIndex, card, context, avoidFinalHidden);
}

function chooseEasySource(state, playerIndex) {
  if (mustDrawOnly(state, playerIndex)) return 'draw';
  const top = state.topDiscard;
  const grid = state.players[playerIndex]?.grid;
  if (!top || !grid) return 'draw';
  const worst = worstFaceUp(grid);
  if (cardValue(top) <= 2) return 'discard';
  if (worst && cardValue(top) <= worst.score - 3) return 'discard';
  return 'draw';
}

function chooseEasyTarget(grid, card) {
  const worst = worstFaceUp(grid);
  if (worst && cardValue(card) <= worst.score - 2) return { r: worst.r, c: worst.c };
  const hidden = firstFaceDown(grid);
  if (hidden) return hidden;
  if (worst) return { r: worst.r, c: worst.c };
  return legacyPickTarget(grid, card);
}

function chooseHardSource(state, playerIndex, context, avoidFinalHidden) {
  if (mustDrawOnly(state, playerIndex)) return 'draw';
  const top = state.topDiscard;
  const grid = state.players[playerIndex]?.grid;
  if (!top || !grid) return 'draw';

  const topValue = cardValue(top);
  const hiddenCount = countFaceDownCards(grid);
  const worst = worstFaceUp(grid, context, 'source-worst-visible');
  const completion = visibleColumnCompletionTarget(grid, top, context, 'source-column-completion');
  const setup = visibleColumnSetupTarget(grid, top, context, 'source-column-setup');

  if (completion && !targetIsFinalHidden(grid, completion, avoidFinalHidden)) return 'discard';
  if (avoidFinalHidden && (!worst || topValue >= worst.score)) return 'draw';
  if (topValue <= HARD_DIRECT_KEEP_MAX) return 'discard';
  if (setup && !targetIsFinalHidden(grid, setup, avoidFinalHidden) && topValue <= HARD_SETUP_MAX) return 'discard';
  if (hiddenCount > 0 && worst && topValue <= worst.score - HARD_HIDDEN_BYPASS_IMPROVEMENT) return 'discard';
  if (hiddenCount === 0 && worst && topValue < worst.score) return 'discard';
  return 'draw';
}

function chooseHardDrawnCardMove(state, playerIndex, card, context, avoidFinalHidden) {
  const grid = state.players[playerIndex]?.grid;
  if (!grid || !card) {
    return { source: 'draw', card, target: null, discardDrawn: false, intent: 'missing-grid' };
  }

  if (shouldDiscardDrawnHard(state, playerIndex, card, context, avoidFinalHidden)) {
    return { source: 'draw', card, target: null, discardDrawn: true, intent: 'discard-low-utility-draw' };
  }

  const target = chooseHardTargetForDraw(state, playerIndex, card, context, avoidFinalHidden);
  const shouldReveal = target
    && canRevealForDecision(grid, target.r, target.c)
    && shouldRevealBeforeChoosing(grid, card, target);
  return {
    source: 'draw',
    card,
    target: target ? { playerIndex, r: target.r, c: target.c } : null,
    discardDrawn: false,
    revealThenDecide: shouldReveal,
    intent: shouldReveal ? 'reveal-before-commit' : 'keep-drawn-card',
  };
}

function shouldDiscardDrawnHard(state, playerIndex, card, context, avoidFinalHidden) {
  if (!canDiscardDrawnForAi(state, playerIndex)) return false;
  const grid = state.players[playerIndex]?.grid;
  if (!grid) return false;

  const incomingValue = cardValue(card);
  const worst = worstFaceUp(grid, context, 'draw-worst-visible');
  const completion = visibleColumnCompletionTarget(grid, card, context, 'draw-column-completion');
  const setup = visibleColumnSetupTarget(grid, card, context, 'draw-column-setup');
  if (completion && !targetIsFinalHidden(grid, completion, avoidFinalHidden)) return false;
  if (setup && !targetIsFinalHidden(grid, setup, avoidFinalHidden) && incomingValue <= HARD_SETUP_MAX) return false;
  if (avoidFinalHidden && (!worst || incomingValue >= worst.score)) {
    return true;
  }
  if (incomingValue <= HARD_REVEAL_MAX) return false;
  if (worst && incomingValue <= worst.score - 1) return false;
  if (cardDangerToOpponents(state, playerIndex, card) >= 7) return false;
  return true;
}

function canDiscardDrawnForAi(state, playerIndex) {
  return mustDrawOnly(state, playerIndex)
    || (countFaceDownCards(state.players[playerIndex]?.grid) === 1 && !state.sweepActive);
}

function chooseHardTargetForDraw(state, playerIndex, card, context, avoidFinalHidden) {
  const grid = state.players[playerIndex]?.grid;
  if (!grid) return null;
  const completion = visibleColumnCompletionTarget(grid, card, context, 'target-column-completion');
  if (completion && !targetIsFinalHidden(grid, completion, avoidFinalHidden)) return completion;

  const setup = visibleColumnSetupTarget(grid, card, context, 'target-column-setup');
  const incomingValue = cardValue(card);
  const hiddenCount = countFaceDownCards(grid);
  if (setup && !targetIsFinalHidden(grid, setup, avoidFinalHidden) && (incomingValue <= HARD_SETUP_MAX || hiddenCount >= 4)) {
    return setup;
  }

  const hidden = bestHiddenTarget(grid, card, context, 'target-hidden');
  const worst = worstFaceUp(grid, context, 'target-worst-visible');
  const canUseHidden = hidden && !targetIsFinalHidden(grid, hidden, avoidFinalHidden);
  if (canUseHidden) {
    if (hiddenCount >= 3 || hiddenCount === 1) return hidden;
    if (worst && incomingValue <= worst.score - HARD_HIDDEN_BYPASS_IMPROVEMENT) return { r: worst.r, c: worst.c };
    return hidden;
  }
  if (worst && incomingValue < worst.score) return { r: worst.r, c: worst.c };
  if (worst) return { r: worst.r, c: worst.c };
  return legacyPickTarget(grid, card);
}

function chooseDirectTargetForKeptCard(grid, card, options = {}) {
  const completion = visibleColumnCompletionTarget(
    grid,
    card,
    options.context,
    'kept-column-completion'
  );
  if (completion && !targetIsFinalHidden(grid, completion, options.avoidFinalHidden)) return completion;

  const incomingValue = cardValue(card);
  const setup = visibleColumnSetupTarget(grid, card, options.context, 'kept-column-setup');
  if (setup && !targetIsFinalHidden(grid, setup, options.avoidFinalHidden) && incomingValue <= HARD_SETUP_MAX) {
    return setup;
  }

  const hidden = bestHiddenTarget(grid, card, options.context, 'kept-hidden');
  const worst = worstFaceUp(grid, options.context, 'kept-worst-visible');
  if (incomingValue <= HARD_DIRECT_KEEP_MAX && hidden && !targetIsFinalHidden(grid, hidden, options.avoidFinalHidden)) {
    return hidden;
  }
  if (worst && incomingValue <= worst.score - 1) return { r: worst.r, c: worst.c };
  if (hidden && !targetIsFinalHidden(grid, hidden, options.avoidFinalHidden)) return hidden;
  if (worst) return { r: worst.r, c: worst.c };
  return legacyPickTarget(grid, card);
}

function targetIsFinalHidden(grid, target, shouldAvoid) {
  if (!shouldAvoid || !target) return false;
  const card = grid?.[target.r]?.[target.c];
  return !!card && !card.faceUp && countFaceDownCards(grid) === 1;
}

function hasLowestRoundScore(state, playerIndex) {
  const mine = currentRoundScore(state.players?.[playerIndex]);
  if (!Number.isFinite(mine)) return true;
  return (state.players || []).every((player, index) => (
    index === playerIndex || mine <= currentRoundScore(player)
  ));
}

function currentRoundScore(player) {
  const grid = player?.grid;
  if (!Array.isArray(grid)) {
    const score = Number(player?.score);
    return Number.isFinite(score) ? score : 0;
  }
  let total = 0;
  for (const row of grid) {
    for (const card of row) {
      if (card && card.faceUp && !card.zeroed) total += cardValue(card);
    }
  }
  return total;
}

function shouldRevealBeforeChoosing(grid, card, target) {
  const current = grid[target.r]?.[target.c];
  if (!current || current.faceUp) return false;
  if (visibleColumnCompletionTarget(grid, card)) return true;
  if (visibleColumnSetupTarget(grid, card)) return true;
  const hiddenCount = countFaceDownCards(grid);
  const incomingValue = cardValue(card);
  if (hiddenCount >= 3) return true;
  return incomingValue > HARD_DIRECT_KEEP_MAX;
}

function chooseRevealDecision(state, playerIndex, drawn, target) {
  const grid = state.players[playerIndex]?.grid;
  const revealed = grid?.[target.r]?.[target.c];
  if (!grid || !revealed) return 'drawn';

  const drawnClears = columnWouldClearWithCard(grid, target.r, target.c, drawn);
  const revealedClears = columnAlreadyClears(grid, target.c);
  if (drawnClears && !revealedClears) return 'drawn';
  if (revealedClears && !drawnClears) return 'revealed';

  const drawnValue = cardValue(drawn);
  const revealedValue = cardValue(revealed);
  if (drawnValue < revealedValue) return 'drawn';
  if (revealedValue < drawnValue) return 'revealed';

  const drawnDanger = cardDangerToOpponents(state, playerIndex, drawn);
  const revealedDanger = cardDangerToOpponents(state, playerIndex, revealed);

  if (drawnDanger > revealedDanger) return 'drawn';
  return 'revealed';
}

function chooseLowerValueRevealDecision(state, playerIndex, drawn, target) {
  const revealed = state.players[playerIndex]?.grid?.[target.r]?.[target.c];
  if (!revealed) return 'drawn';
  return cardValue(drawn) < cardValue(revealed) ? 'drawn' : 'revealed';
}

function visibleColumnCompletionTarget(grid, incoming, context, scope = 'column-completion') {
  const candidates = [];
  for (let c = 0; c < COLS; c += 1) {
    const column = columnCards(grid, c);
    const visibleMatches = column.filter(card => card && card.faceUp && card.rank === incoming.rank).length;
    if (visibleMatches < 2) continue;
    for (let r = 0; r < ROWS; r += 1) {
      const card = grid[r]?.[c];
      if (card && (!card.faceUp || card.rank !== incoming.rank)) candidates.push({ r, c });
    }
  }
  return stableTargetChoice(candidates, context, scope);
}

function visibleColumnSetupTarget(grid, incoming, context, scope = 'column-setup') {
  const candidates = [];
  for (let c = 0; c < COLS; c += 1) {
    const column = columnCards(grid, c);
    const visibleMatches = column.filter(card => card && card.faceUp && card.rank === incoming.rank).length;
    if (visibleMatches !== 1) continue;
    for (let r = 0; r < ROWS; r += 1) {
      const card = grid[r]?.[c];
      if (card && !card.faceUp) candidates.push({ r, c });
    }
  }
  return stableTargetChoice(candidates, context, scope);
}

function bestHiddenTarget(grid, incoming, context, scope = 'hidden-target') {
  const candidates = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const card = grid[r]?.[c];
      if (!card || card.faceUp) continue;
      const column = columnCards(grid, c);
      const visible = column.filter(item => item && item.faceUp);
      const matchingVisible = visible.filter(item => item.rank === incoming.rank).length;
      const visibleScore = visible.reduce((total, item) => total + cardValue(item), 0);
      const duplicateVisible = visible.length >= 2 && visible.every(item => item.rank === visible[0].rank);
      const score = matchingVisible * 12 + visible.length * 4 + (duplicateVisible ? 4 : 0) + Math.max(0, visibleScore) / 3;
      if (score > bestScore) {
        bestScore = score;
        candidates.length = 0;
        candidates.push({ r, c });
      } else if (score === bestScore) {
        candidates.push({ r, c });
      }
    }
  }
  return stableTargetChoice(candidates, context, scope);
}

function cardDangerToOpponents(state, playerIndex, card) {
  if (!card) return 0;
  let danger = cardValue(card) <= 0 ? 2 : 0;
  for (let i = 0; i < (state.players?.length || 0); i += 1) {
    if (i === playerIndex) continue;
    const grid = state.players[i]?.grid;
    if (!grid) continue;
    if (visibleColumnCompletionTarget(grid, card)) return 10;
    if (visibleColumnSetupTarget(grid, card)) danger = Math.max(danger, 4);
  }
  return danger;
}

function columnWouldClearWithCard(grid, row, col, incoming) {
  const column = columnCards(grid, col).map((card, index) => (
    index === row ? { ...incoming, faceUp: true } : card
  ));
  return column.length === ROWS
    && column.every(card => card && card.faceUp)
    && column.every(card => card.rank === column[0].rank);
}

function columnAlreadyClears(grid, col) {
  const column = columnCards(grid, col);
  return column.length === ROWS
    && column.every(card => card && card.faceUp)
    && column.every(card => card.rank === column[0].rank);
}

function worstFaceUp(grid, context, scope = 'worst-visible') {
  const candidates = [];
  let worstScore = Number.NEGATIVE_INFINITY;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const cell = grid[r]?.[c];
      if (!cell || !cell.faceUp || cell.zeroed) continue;
      const score = cardValue(cell);
      if (score > worstScore) {
        worstScore = score;
        candidates.length = 0;
        candidates.push({ r, c, score });
      } else if (score === worstScore) {
        candidates.push({ r, c, score });
      }
    }
  }
  return stableTargetChoice(candidates, context, scope);
}

function firstFaceDown(grid) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const card = grid[r]?.[c];
      if (card && !card.faceUp) return { r, c };
    }
  }
  return null;
}

function canRevealForDecision(grid, r, c) {
  const card = grid?.[r]?.[c];
  return !!card && !card.faceUp;
}

function mustDrawOnly(state, playerIndex) {
  return state.mustDrawOnlyForPlayerIndex === playerIndex;
}

function peekDrawCard(state) {
  return state.drawPile?.[state.drawPile.length - 1] || null;
}

function columnCards(grid, c) {
  return Array.from({ length: ROWS }, (_, r) => grid[r]?.[c] || null);
}

function normalizePolicy(policy) {
  if (policy === 'hard' || policy === 'afk') return policy;
  return 'easy';
}

function decisionContext(state, playerIndex) {
  const player = state?.players?.[playerIndex];
  const identity = player?.userId || player?.id || `player-${playerIndex}`;
  return {
    seed: [
      state?.id || 'game',
      state?.round || 1,
      state?.turnSerial || 0,
      identity,
    ].join('|'),
  };
}

function turnFingerprint(state, playerIndex) {
  const player = state?.players?.[playerIndex];
  return {
    gameId: state?.id || null,
    round: state?.round || 1,
    turnSerial: state?.turnSerial || 0,
    revision: state?.revision || 0,
    playerId: player?.userId || player?.id || `player-${playerIndex}`,
  };
}

function isCurrentTurnPlan(state, plan) {
  if (!state || !plan || state.phase !== 'turn') return false;
  if (!Number.isInteger(plan.playerIndex) || state.currentPlayerIndex !== plan.playerIndex) return false;
  if (!plan.fingerprint || normalizePolicy(plan.policy) !== plan.policy) return false;
  const current = turnFingerprint(state, plan.playerIndex);
  if (current.gameId !== plan.fingerprint.gameId
    || current.round !== plan.fingerprint.round
    || current.turnSerial !== plan.fingerprint.turnSerial
    || current.revision !== plan.fingerprint.revision
    || current.playerId !== plan.fingerprint.playerId) return false;
  const sourceCard = plan.source === 'discard' ? state.topDiscard : peekDrawCard(state);
  if ((sourceCard?.id || null) !== (plan.cardId || null)) return false;
  if (plan.target) {
    if (plan.target.playerIndex !== plan.playerIndex) return false;
    if (!state.players?.[plan.playerIndex]?.grid?.[plan.target.r]?.[plan.target.c]) return false;
  }
  return plan.source === 'draw' || plan.source === 'discard';
}

function plannedCardMatches(card, plan) {
  return !!card && (card.id || null) === (plan.cardId || null);
}

function stableTargetChoice(candidates, context, scope) {
  if (!candidates.length) return null;
  if (!context?.seed) return candidates[0];
  let chosen = candidates[0];
  let chosenOrder = stableHash(`${context.seed}|${scope}|${targetKey(chosen)}`);
  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const order = stableHash(`${context.seed}|${scope}|${targetKey(candidate)}`);
    if (order > chosenOrder || (order === chosenOrder && targetKey(candidate) < targetKey(chosen))) {
      chosen = candidate;
      chosenOrder = order;
    }
  }
  return chosen;
}

function targetKey(target) {
  return `${target.r}:${target.c}`;
}

function stableHash(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
