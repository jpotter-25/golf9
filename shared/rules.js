export const ROWS = 3;
export const COLS = 3;
export const TURN_DURATION = 25_000;
export const PEEK_DURATION = 15_000;
export const ROUND_REVEAL_DURATION = 4_500;
export const ROUND_SUMMARY_DURATION = 20_000;
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function makeId(prefix = '') {
  return `${prefix}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function sanitizePlayerIdentity(user) {
  return {
    userId: user.userId,
    displayName: user.displayName || 'Player',
    avatarInitial: (user.displayName || 'P').trim().slice(0, 1).toUpperCase(),
    cosmetics: {
      cardBack: user.inventory?.equipped?.cardBack || user.cosmetics?.cardBack || 'classic-card-back',
      avatarFrame: user.inventory?.equipped?.avatarFrame || user.cosmetics?.avatarFrame || 'rookie-avatar-frame',
      avatarIcon: user.inventory?.equipped?.avatarIcon || user.cosmetics?.avatarIcon || 'classic-avatar-icon',
      title: user.inventory?.equipped?.title || user.cosmetics?.title || 'rookie-title',
      tableTheme: user.inventory?.equipped?.tableTheme || user.cosmetics?.tableTheme || 'classic-table-theme',
    },
  };
}

export function deckCountForPlayers(playerCount) {
  return Number(playerCount) >= 3 ? 3 : 2;
}

export function createDeck(deckCount = 2) {
  const deck = [];
  const copies = Math.max(1, Math.floor(Number(deckCount) || 2));
  for (let copy = 0; copy < copies; copy += 1) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ id: `${suit}-${rank}-${copy}-${makeId()}`, suit, rank, faceUp: false });
      }
    }
  }
  return shuffle(deck);
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cardValue(card) {
  if (!card || card.zeroed) return 0;
  switch (card.rank) {
    case 'A': return 1;
    case '2': return 2;
    case '3': return 3;
    case '4': return 4;
    case '5': return -5;
    case '6': return 6;
    case '7': return 7;
    case '8': return 8;
    case '9': return 9;
    case '10': return 10;
    case 'J':
    case 'Q': return 10;
    case 'K': return 0;
    default: return 0;
  }
}

export function initGrid() {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function scoreGrid(grid) {
  let sum = 0;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      sum += cardValue(grid[r][c]);
    }
  }
  return sum;
}

export function createGameState(playerIdentities, options = {}) {
  const deck = createDeck(deckCountForPlayers(playerIdentities.length));
  const players = playerIdentities.map((identity, index) => {
    const grid = initGrid();
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const card = deck.pop();
        grid[r][c] = { ...card, faceUp: false };
      }
    }
    return {
      id: `P${index + 1}`,
      userId: identity.userId || `local-${index + 1}`,
      name: identity.displayName || identity.name || `Player ${index + 1}`,
      avatarInitial: identity.avatarInitial || (identity.displayName || identity.name || 'P').slice(0, 1).toUpperCase(),
      cosmetics: identity.cosmetics || {
        cardBack: 'classic-card-back',
        avatarFrame: 'rookie-avatar-frame',
        avatarIcon: 'classic-avatar-icon',
        title: 'rookie-title',
        tableTheme: 'classic-table-theme',
      },
      grid,
      score: 0,
      peekFlips: 0,
      connected: true,
    };
  });
  const starter = deck.pop();
  starter.faceUp = true;
  return {
    id: makeId('game-'),
    players,
    currentPlayerIndex: 0,
    drawPile: deck,
    discardPile: [starter],
    phase: 'peek',
    topDiscard: starter,
    peekTurnIndex: options.simultaneousPeek ? undefined : 0,
    peekEndsAt: Date.now() + PEEK_DURATION,
    simultaneousPeek: !!options.simultaneousPeek,
    round: options.round || 1,
    totalRounds: options.totalRounds || 9,
    totals: options.totals || Array.from({ length: players.length }, () => 0),
    sweepActive: false,
    sweepStarterIndex: null,
    pendingDecision: null,
    completed: false,
    revision: 0,
    turnSerial: 0,
    lastActionId: null,
  };
}

function bumpTurnSerial(state) {
  if (state.phase === 'turn') state.turnSerial = (state.turnSerial || 0) + 1;
}

export function dealLocal(players) {
  return createGameState(Array.from({ length: players }, (_, i) => ({ userId: `local-${i + 1}`, displayName: `Player ${i + 1}` })));
}

function allPeeked(state) {
  return state.players.every(player => player.peekFlips >= 2);
}

export function startTurns(state) {
  const next = cloneState(state);
  next.phase = 'turn';
  next.peekTurnIndex = undefined;
  next.peekEndsAt = undefined;
  next.currentPlayerIndex = Math.floor(Math.random() * next.players.length);
  next.turnEndsAt = Date.now() + TURN_DURATION;
  next.mustDrawOnlyForPlayerIndex = undefined;
  bumpTurnSerial(next);
  next.revision = (next.revision || 0) + 1;
  return next;
}

export function advancePeek(state) {
  const next = cloneState(state);
  if (next.phase === 'peek' && next.simultaneousPeek) return allPeeked(next) ? startTurns(next) : next;
  if (next.phase !== 'peek' || next.peekTurnIndex == null) return next;
  if (allPeeked(next)) return startTurns(next);
  let idx = next.peekTurnIndex;
  for (let i = 0; i < next.players.length; i += 1) {
    idx = (idx + 1) % next.players.length;
    if (next.players[idx].peekFlips < 2) {
      next.peekTurnIndex = idx;
      next.peekEndsAt = Date.now() + PEEK_DURATION;
      next.revision = (next.revision || 0) + 1;
      return next;
    }
  }
  return startTurns(next);
}

export function flipForPeek(state, playerIndex, r, c) {
  const next = cloneState(state);
  if (next.phase !== 'peek') return { state: next, error: 'Not in peek phase.' };
  if (!next.simultaneousPeek && next.peekTurnIndex !== playerIndex) return { state: next, error: 'Not your peek turn.' };
  const player = next.players[playerIndex];
  if (!player || player.peekFlips >= 2) return { state: next, error: 'Peek limit reached.' };
  const card = player.grid?.[r]?.[c];
  if (!card || card.faceUp) return { state: next, error: 'Card cannot be peeked.' };
  card.faceUp = true;
  player.peekFlips += 1;
  next.revision = (next.revision || 0) + 1;
  if (next.simultaneousPeek) {
    return { state: allPeeked(next) ? startTurns(next) : next };
  }
  if (player.peekFlips >= 2) {
    return { state: allPeeked(next) ? startTurns(next) : advancePeek(next) };
  }
  return { state: next };
}

export function autoCompleteCurrentPeek(state) {
  const next = cloneState(state);
  if (next.phase !== 'peek') return next;
  if (next.simultaneousPeek) {
    for (const player of next.players) {
      const coords = [];
      for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
        const card = player.grid[r][c];
        if (card && !card.faceUp) coords.push({ r, c });
      }
      while (player.peekFlips < 2 && coords.length) {
        const index = Math.floor(Math.random() * coords.length);
        const { r, c } = coords.splice(index, 1)[0];
        player.grid[r][c].faceUp = true;
        player.peekFlips += 1;
      }
    }
    next.revision = (next.revision || 0) + 1;
    return startTurns(next);
  }
  if (next.peekTurnIndex == null) return next;
  const player = next.players[next.peekTurnIndex];
  const coords = [];
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
    const card = player.grid[r][c];
    if (card && !card.faceUp) coords.push({ r, c });
  }
  while (player.peekFlips < 2 && coords.length) {
    const index = Math.floor(Math.random() * coords.length);
    const { r, c } = coords.splice(index, 1)[0];
    player.grid[r][c].faceUp = true;
    player.peekFlips += 1;
  }
  next.revision = (next.revision || 0) + 1;
  return allPeeked(next) ? startTurns(next) : advancePeek(next);
}

function reshuffle(state) {
  const top = state.discardPile.pop();
  const pool = [...state.discardPile];
  state.discardPile = top ? [top] : [];
  shuffle(pool);
  state.drawPile.push(...pool.map(card => ({ ...card, faceUp: false })));
  state.topDiscard = top || null;
}

export function drawFromDeck(state) {
  const next = cloneState(state);
  if (next.phase !== 'turn') return { state: next, drawn: null, error: 'Round is not in turn phase.' };
  if (!playerHasGridCards(next.players[next.currentPlayerIndex])) return { state: next, drawn: null, error: 'Player has no grid cards remaining.' };
  if (next.pendingDecision) return { state: next, drawn: null, error: 'Finish the revealed-card decision first.' };
  if (next.drawPile.length === 0) reshuffle(next);
  const card = next.drawPile.pop();
  if (!card) return { state: next, drawn: null, error: 'No cards available.' };
  card.faceUp = true;
  if (next.mustDrawOnlyForPlayerIndex === next.currentPlayerIndex) next.mustDrawOnlyForPlayerIndex = undefined;
  next.turnEndsAt = Date.now() + TURN_DURATION;
  next.revision = (next.revision || 0) + 1;
  return { state: next, drawn: card };
}

export function takeDiscard(state) {
  const next = cloneState(state);
  if (next.phase !== 'turn') return { state: next, drawn: null, error: 'Round is not in turn phase.' };
  if (!playerHasGridCards(next.players[next.currentPlayerIndex])) return { state: next, drawn: null, error: 'Player has no grid cards remaining.' };
  if (next.pendingDecision) return { state: next, drawn: null, error: 'Finish the revealed-card decision first.' };
  if (next.mustDrawOnlyForPlayerIndex === next.currentPlayerIndex) {
    return { state: next, drawn: null, error: 'Extra turns must draw from the deck.' };
  }
  const top = next.discardPile.pop() || null;
  if (!top) return { state: next, drawn: null, error: 'Discard pile is empty.' };
  top.faceUp = true;
  next.topDiscard = next.discardPile[next.discardPile.length - 1] || null;
  next.turnEndsAt = Date.now() + TURN_DURATION;
  next.revision = (next.revision || 0) + 1;
  return { state: next, drawn: top };
}

function markSweepIfNeeded(state) {
  if (state.phase !== 'turn' || state.sweepActive) return;
  const idx = state.currentPlayerIndex;
  const allUp = playerGridComplete(state.players[idx]);
  if (allUp) {
    state.sweepActive = true;
    state.sweepStarterIndex = idx;
  }
}

function playerHasGridCards(player) {
  return !!player?.grid?.some(row => row.some(Boolean));
}

function playerGridComplete(player) {
  return !playerHasGridCards(player) || player.grid.every(row => row.every(card => !card || card.faceUp));
}

function nextTurnIndex(state, fromIndex) {
  for (let step = 1; step <= state.players.length; step += 1) {
    const idx = (fromIndex + step) % state.players.length;
    if (state.sweepActive && idx === state.sweepStarterIndex) return idx;
    if (playerHasGridCards(state.players[idx])) return idx;
  }
  return state.sweepStarterIndex ?? fromIndex;
}

function refreshTurnDeadline(state) {
  if (state.phase !== 'turn') return;
  state.turnEndsAt = playerHasGridCards(state.players[state.currentPlayerIndex])
    ? Date.now() + TURN_DURATION
    : undefined;
}

function maybeEndRound(state) {
  if (!state.sweepActive || state.sweepStarterIndex == null) return;
  if (state.currentPlayerIndex !== state.sweepStarterIndex) return;
  beginRoundReveal(state);
}

function beginRoundReveal(state) {
  revealAllHiddenCards(state);
  const roundScores = state.players.map(player => scoreGrid(player.grid));
  state.lastRoundScores = roundScores;
  state.totals = state.totals.map((total, index) => total + roundScores[index]);
  state.lastRoundNumber = state.round;
  state.lastRoundTotals = [...state.totals];
  state.phase = 'roundReveal';
  state.pendingDecision = null;
  state.mustDrawOnlyForPlayerIndex = undefined;
  state.turnEndsAt = undefined;
  state.roundRevealEndsAt = Date.now() + ROUND_REVEAL_DURATION;
  state.completed = false;
}

function finishRoundReveal(state) {
  if (state.phase !== 'roundReveal') return;
  const finishedRound = state.lastRoundNumber || state.round;
  if (finishedRound >= state.totalRounds) {
    state.phase = 'roundEnd';
    state.completed = true;
    state.roundRevealEndsAt = undefined;
    state.roundSummaryEndsAt = undefined;
    state.turnEndsAt = undefined;
    state.revision = (state.revision || 0) + 1;
    return;
  }
  state.phase = 'roundSummary';
  state.completed = false;
  state.roundRevealEndsAt = undefined;
  state.turnEndsAt = undefined;
  state.peekEndsAt = undefined;
  state.roundSummaryEndsAt = Date.now() + ROUND_SUMMARY_DURATION;
  state.revision = (state.revision || 0) + 1;
}

function startNextRoundInPlace(state) {
  const finishedRound = state.lastRoundNumber || state.round;
  const identities = state.players.map(player => ({ userId: player.userId, displayName: player.name, avatarInitial: player.avatarInitial, cosmetics: player.cosmetics }));
  const fresh = createGameState(identities, {
    round: finishedRound + 1,
    totalRounds: state.totalRounds,
    totals: state.totals,
    simultaneousPeek: !!state.simultaneousPeek,
  });
  fresh.lastRoundScores = state.lastRoundScores;
  fresh.lastRoundNumber = finishedRound;
  fresh.lastRoundTotals = [...state.totals];
  fresh.revision = (state.revision || 0) + 1;
  Object.keys(state).forEach(key => delete state[key]);
  Object.assign(state, fresh);
}

function advanceTurnInPlace(state) {
  markSweepIfNeeded(state);
  state.currentPlayerIndex = nextTurnIndex(state, state.currentPlayerIndex);
  state.mustDrawOnlyForPlayerIndex = undefined;
  maybeEndRound(state);
  refreshTurnDeadline(state);
  bumpTurnSerial(state);
}

function awardExtraTurnInPlace(state, playerIndex) {
  markSweepIfNeeded(state);
  if (!playerHasGridCards(state.players[playerIndex])) {
    advanceTurnInPlace(state);
    return;
  }
  state.currentPlayerIndex = playerIndex;
  state.mustDrawOnlyForPlayerIndex = playerIndex;
  state.turnEndsAt = Date.now() + TURN_DURATION;
  bumpTurnSerial(state);
}

function clearThreeOfAKindColumns(state, playerIndex) {
  const grid = state.players[playerIndex]?.grid || [];
  let changed = false;
  for (let c = 0; c < COLS; c += 1) {
    const col = [grid[0][c], grid[1][c], grid[2][c]];
    if (col.every(card => card && card.faceUp)) {
      const ranksInCol = col.map(card => card.rank);
      const allZeroed = col.every(card => card.zeroed);
      if (!allZeroed && ranksInCol[0] === ranksInCol[1] && ranksInCol[1] === ranksInCol[2]) {
        for (let r = 0; r < ROWS; r += 1) {
          state.discardPile.push({ ...grid[r][c], faceUp: true, zeroed: false });
          grid[r][c] = null;
        }
        changed = true;
      }
    }
  }
  if (changed) state.topDiscard = state.discardPile[state.discardPile.length - 1] || null;
  return changed;
}

function revealAllHiddenCards(state) {
  for (const player of state.players) {
    for (const row of player.grid) {
      for (const card of row) {
        if (card) card.faceUp = true;
      }
    }
  }
}

export function revealGridCardForDecision(state, playerIndex, r, c) {
  const next = cloneState(state);
  if (next.phase !== 'turn') return { state: next, error: 'Round is not in turn phase.' };
  if (next.currentPlayerIndex !== playerIndex) return { state: next, error: 'Not your turn.' };
  if (next.pendingDecision) return { state: next, error: 'Finish the revealed-card decision first.' };
  const player = next.players[playerIndex];
  const card = player?.grid?.[r]?.[c];
  if (!player || !card) return { state: next, error: 'Invalid grid card.' };
  if (card.faceUp) return { state: next, error: 'Card is already face-up.' };
  card.faceUp = true;
  next.pendingDecision = { playerIndex, r, c, cardId: card.id };
  next.turnEndsAt = Date.now() + TURN_DURATION;
  next.revision = (next.revision || 0) + 1;
  return { state: next };
}

export function resolvePendingGridDecision(state, playerIndex, heldCard, choice) {
  const next = cloneState(state);
  if (next.phase !== 'turn') return { state: next, error: 'Round is not in turn phase.' };
  if (next.currentPlayerIndex !== playerIndex) return { state: next, error: 'Not your turn.' };
  if (!heldCard) return { state: next, error: 'No card to resolve.' };
  const pending = next.pendingDecision;
  if (!pending || pending.playerIndex !== playerIndex) {
    return { state: next, error: 'No revealed-card decision to resolve.' };
  }
  const player = next.players[playerIndex];
  const revealed = player?.grid?.[pending.r]?.[pending.c];
  if (!player || !revealed || revealed.id !== pending.cardId) {
    return { state: next, error: 'Revealed card is no longer available.' };
  }

  if (choice === 'revealed') {
    next.discardPile.push({ ...heldCard, faceUp: true });
    next.topDiscard = next.discardPile[next.discardPile.length - 1] || null;
    next.pendingDecision = null;
    const cleared = clearThreeOfAKindColumns(next, playerIndex);
    if (cleared) {
      awardExtraTurnInPlace(next, playerIndex);
    } else {
      advanceTurnInPlace(next);
    }
  } else if (choice === 'drawn') {
    player.grid[pending.r][pending.c] = { ...heldCard, faceUp: true };
    next.discardPile.push({ ...revealed, faceUp: true });
    next.topDiscard = next.discardPile[next.discardPile.length - 1] || null;
    next.pendingDecision = null;
    const cleared = clearThreeOfAKindColumns(next, playerIndex);
    if (cleared) {
      awardExtraTurnInPlace(next, playerIndex);
    } else {
      advanceTurnInPlace(next);
    }
  } else {
    return { state: next, error: 'Invalid revealed-card decision.' };
  }

  next.revision = (next.revision || 0) + 1;
  return { state: next };
}

export function resolvePendingGridDecisionWithoutHeld(state, playerIndex) {
  const next = cloneState(state);
  if (next.phase !== 'turn') return { state: next, error: 'Round is not in turn phase.' };
  if (next.currentPlayerIndex !== playerIndex) return { state: next, error: 'Not your turn.' };
  const pending = next.pendingDecision;
  if (!pending || pending.playerIndex !== playerIndex) {
    return { state: next, error: 'No revealed-card decision to resolve.' };
  }
  const revealed = next.players[playerIndex]?.grid?.[pending.r]?.[pending.c];
  if (!revealed || revealed.id !== pending.cardId) {
    return { state: next, error: 'Revealed card is no longer available.' };
  }

  next.pendingDecision = null;
  const cleared = clearThreeOfAKindColumns(next, playerIndex);
  if (cleared) {
    awardExtraTurnInPlace(next, playerIndex);
  } else {
    advanceTurnInPlace(next);
  }
  next.revision = (next.revision || 0) + 1;
  return { state: next };
}

export function replaceGridCard(state, playerIndex, r, c, newCard) {
  const next = cloneState(state);
  if (next.phase !== 'turn') return { state: next, error: 'Round is not in turn phase.' };
  if (next.currentPlayerIndex !== playerIndex) return { state: next, error: 'Not your turn.' };
  if (next.pendingDecision) return { state: next, error: 'Finish the revealed-card decision first.' };
  const player = next.players[playerIndex];
  const replaced = player?.grid?.[r]?.[c];
  if (!player || !replaced || !newCard) return { state: next, error: 'Invalid replacement.' };
  player.grid[r][c] = { ...newCard, faceUp: true };
  next.discardPile.push({ ...replaced, faceUp: true });
  next.topDiscard = next.discardPile[next.discardPile.length - 1] || null;
  const cleared = clearThreeOfAKindColumns(next, playerIndex);
  if (cleared) {
    awardExtraTurnInPlace(next, playerIndex);
  } else {
    advanceTurnInPlace(next);
  }
  next.revision = (next.revision || 0) + 1;
  return { state: next };
}

export function discardDrawn(state, playerIndex, card) {
  const next = cloneState(state);
  if (next.phase !== 'turn') return { state: next, error: 'Round is not in turn phase.' };
  if (next.currentPlayerIndex !== playerIndex) return { state: next, error: 'Not your turn.' };
  if (next.pendingDecision) return { state: next, error: 'Choose whether to keep the revealed card or drawn card.' };
  if (!card) return { state: next, error: 'No card to discard.' };
  next.discardPile.push({ ...card, faceUp: true });
  next.topDiscard = next.discardPile[next.discardPile.length - 1] || null;
  const cleared = clearThreeOfAKindColumns(next, playerIndex);
  if (cleared) {
    awardExtraTurnInPlace(next, playerIndex);
  } else {
    advanceTurnInPlace(next);
  }
  next.revision = (next.revision || 0) + 1;
  return { state: next };
}

export function applyTimedOutTurn(state) {
  if (!playerHasGridCards(state.players[state.currentPlayerIndex])) {
    const next = cloneState(state);
    advanceTurnInPlace(next);
    next.revision = (next.revision || 0) + 1;
    return next;
  }
  const idx = state.currentPlayerIndex;
  const draw = drawFromDeck(state);
  if (draw.error || !draw.drawn) return draw.state;
  const target = pickTarget(draw.state.players[idx].grid, draw.drawn);
  return replaceGridCard(draw.state, idx, target.r, target.c, draw.drawn).state;
}

export function continueAfterRoundSummary(state) {
  const next = cloneState(state);
  if (next.phase !== 'roundSummary') {
    return { state: next, error: 'Round summary is not active.' };
  }
  startNextRoundInPlace(next);
  return { state: next };
}

export function resolveExpiredTimers(state) {
  let next = cloneState(state);
  const now = Date.now();
  if (next.phase === 'peek' && next.peekEndsAt && now >= next.peekEndsAt) next = autoCompleteCurrentPeek(next);
  if (next.phase === 'turn' && next.turnEndsAt && now >= next.turnEndsAt) next = applyTimedOutTurn(next);
  if (next.phase === 'roundReveal' && next.roundRevealEndsAt && now >= next.roundRevealEndsAt) finishRoundReveal(next);
  if (next.phase === 'roundSummary' && next.roundSummaryEndsAt && now >= next.roundSummaryEndsAt) {
    next = continueAfterRoundSummary(next).state;
  }
  return next;
}

export function isRoundOver(state) {
  return state.players.every(player => player.grid.flat().every(card => !card || card.faceUp));
}

function worstFaceUp(grid) {
  let out = null;
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
    const cell = grid[r][c];
    if (!cell || !cell.faceUp || cell.zeroed) continue;
    const score = cardValue(cell);
    if (!out || score > out.score) out = { r, c, score };
  }
  return out;
}

function anyFaceDown(grid) {
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
    const cell = grid[r][c];
    if (cell && !cell.faceUp) return { r, c };
  }
  return null;
}

export function pickTarget(grid, incoming) {
  for (let c = 0; c < COLS; c += 1) {
    const cells = [grid[0][c], grid[1][c], grid[2][c]];
    const ranksInCol = cells.map(card => card?.rank || null);
    const same = ranksInCol.filter(rank => rank === incoming.rank).length;
    if (same >= 2) {
      for (let r = 0; r < ROWS; r += 1) {
        const cur = grid[r][c];
        if (cur && (!cur.faceUp || cur.rank !== incoming.rank)) return { r, c };
      }
    }
  }
  const worst = worstFaceUp(grid);
  if (worst && cardValue(incoming) < worst.score) return { r: worst.r, c: worst.c };
  const fd = anyFaceDown(grid);
  if (fd) return fd;
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
    const cell = grid[r][c];
    if (cell && cell.faceUp && !cell.zeroed) return { r, c };
  }
  return { r: 0, c: 0 };
}

export function publicGameState(
  state,
  viewerUserId = null,
  viewerHeldCard = null,
  viewerHeldSource = null,
  viewerHeldMustReplace = false,
  viewerHeldCanDiscard = false
) {
  const next = cloneState(state);
  next.drawPile = Array.from({ length: next.drawPile.length }, (_, index) => ({ id: `draw-${index}`, suit: '♠', rank: 'A', faceUp: false }));
  next.viewerHeldCard = viewerHeldCard;
  next.viewerHeldSource = viewerHeldSource;
  next.viewerHeldMustReplace = !!viewerHeldMustReplace;
  next.viewerHeldCanDiscard = !!viewerHeldCanDiscard;
  next.players = next.players.map(player => ({
    ...player,
    grid: player.grid.map(row => row.map(card => {
      if (!card || card.faceUp) return card;
      return { id: card.id, suit: '♠', rank: 'A', faceUp: false, zeroed: card.zeroed };
    })),
  }));
  return next;
}
