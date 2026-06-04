export const ROWS = 3;
export const COLS = 3;
export const TURN_DURATION = 25_000;
export const PEEK_DURATION = 15_000;
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
  };
}

export function createDeck() {
  const deck = [];
  for (let copy = 0; copy < 2; copy += 1) {
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
  const deck = createDeck();
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
    peekTurnIndex: 0,
    peekEndsAt: Date.now() + PEEK_DURATION,
    round: options.round || 1,
    totalRounds: options.totalRounds || 9,
    totals: options.totals || Array.from({ length: players.length }, () => 0),
    sweepActive: false,
    sweepStarterIndex: null,
    completed: false,
    revision: 0,
    lastActionId: null,
  };
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
  next.revision = (next.revision || 0) + 1;
  return next;
}

export function advancePeek(state) {
  const next = cloneState(state);
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
  if (next.phase !== 'peek' || next.peekTurnIndex !== playerIndex) return { state: next, error: 'Not your peek turn.' };
  const player = next.players[playerIndex];
  if (!player || player.peekFlips >= 2) return { state: next, error: 'Peek limit reached.' };
  const card = player.grid?.[r]?.[c];
  if (!card || card.faceUp) return { state: next, error: 'Card cannot be peeked.' };
  card.faceUp = true;
  player.peekFlips += 1;
  next.revision = (next.revision || 0) + 1;
  if (player.peekFlips >= 2) {
    return { state: allPeeked(next) ? startTurns(next) : advancePeek(next) };
  }
  return { state: next };
}

export function autoCompleteCurrentPeek(state) {
  const next = cloneState(state);
  if (next.phase !== 'peek' || next.peekTurnIndex == null) return next;
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
  if (next.mustDrawOnlyForPlayerIndex === next.currentPlayerIndex) return drawFromDeck(state);
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
  const allUp = state.players[idx].grid.every(row => row.every(card => card?.faceUp));
  if (allUp) {
    state.sweepActive = true;
    state.sweepStarterIndex = idx;
  }
}

function maybeEndRound(state) {
  if (!state.sweepActive || state.sweepStarterIndex == null) return;
  if (state.currentPlayerIndex !== state.sweepStarterIndex) return;
  const roundScores = state.players.map(player => scoreGrid(player.grid));
  state.lastRoundScores = roundScores;
  state.totals = state.totals.map((total, index) => total + roundScores[index]);
  if (state.round >= state.totalRounds) {
    state.phase = 'roundEnd';
    state.completed = true;
    state.turnEndsAt = undefined;
    return;
  }
  const identities = state.players.map(player => ({ userId: player.userId, displayName: player.name, avatarInitial: player.avatarInitial }));
  const fresh = createGameState(identities, { round: state.round + 1, totalRounds: state.totalRounds, totals: state.totals });
  Object.keys(state).forEach(key => delete state[key]);
  Object.assign(state, fresh);
}

function advanceTurnInPlace(state) {
  markSweepIfNeeded(state);
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.turnEndsAt = Date.now() + TURN_DURATION;
  state.mustDrawOnlyForPlayerIndex = undefined;
  maybeEndRound(state);
}

function clearThreeOfAKindColumns(grid) {
  let changed = false;
  for (let c = 0; c < COLS; c += 1) {
    const col = [grid[0][c], grid[1][c], grid[2][c]];
    if (col.every(card => card && card.faceUp)) {
      const ranksInCol = col.map(card => card.rank);
      const allZeroed = col.every(card => card.zeroed);
      if (!allZeroed && ranksInCol[0] === ranksInCol[1] && ranksInCol[1] === ranksInCol[2]) {
        for (let r = 0; r < ROWS; r += 1) {
          grid[r][c].zeroed = true;
          grid[r][c].faceUp = true;
        }
        changed = true;
      }
    }
  }
  return changed;
}

export function replaceGridCard(state, playerIndex, r, c, newCard) {
  const next = cloneState(state);
  if (next.phase !== 'turn') return { state: next, error: 'Round is not in turn phase.' };
  if (next.currentPlayerIndex !== playerIndex) return { state: next, error: 'Not your turn.' };
  const player = next.players[playerIndex];
  const replaced = player?.grid?.[r]?.[c];
  if (!player || !replaced || !newCard) return { state: next, error: 'Invalid replacement.' };
  player.grid[r][c] = { ...newCard, faceUp: true };
  next.discardPile.push({ ...replaced, faceUp: true });
  next.topDiscard = next.discardPile[next.discardPile.length - 1] || null;
  const cleared = clearThreeOfAKindColumns(player.grid);
  if (cleared) {
    next.mustDrawOnlyForPlayerIndex = playerIndex;
    next.turnEndsAt = Date.now() + TURN_DURATION;
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
  if (!card) return { state: next, error: 'No card to discard.' };
  next.discardPile.push({ ...card, faceUp: true });
  next.topDiscard = next.discardPile[next.discardPile.length - 1] || null;
  advanceTurnInPlace(next);
  next.revision = (next.revision || 0) + 1;
  return { state: next };
}

export function applyTimedOutTurn(state) {
  const idx = state.currentPlayerIndex;
  const draw = drawFromDeck(state);
  if (draw.error || !draw.drawn) return draw.state;
  const target = pickTarget(draw.state.players[idx].grid, draw.drawn);
  return replaceGridCard(draw.state, idx, target.r, target.c, draw.drawn).state;
}

export function resolveExpiredTimers(state) {
  let next = cloneState(state);
  const now = Date.now();
  if (next.phase === 'peek' && next.peekEndsAt && now >= next.peekEndsAt) next = autoCompleteCurrentPeek(next);
  if (next.phase === 'turn' && next.turnEndsAt && now >= next.turnEndsAt) next = applyTimedOutTurn(next);
  return next;
}

export function isRoundOver(state) {
  return state.players.every(player => player.grid.flat().every(card => card?.faceUp));
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

export function publicGameState(state, viewerUserId = null) {
  const next = cloneState(state);
  next.drawPile = Array.from({ length: next.drawPile.length }, (_, index) => ({ id: `draw-${index}`, suit: '♠', rank: 'A', faceUp: false }));
  next.players = next.players.map(player => ({
    ...player,
    grid: player.grid.map(row => row.map(card => {
      if (!card || card.faceUp || player.userId === viewerUserId) return card;
      return { id: card.id, suit: card.suit, rank: card.rank, faceUp: false, zeroed: card.zeroed };
    })),
  }));
  return next;
}
