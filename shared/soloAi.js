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
const HARD_BIG_IMPROVEMENT = 3;

export function chooseAiMove(state, playerIndex, difficulty = 'easy') {
  return difficulty === 'hard'
    ? chooseHardAiMove(state, playerIndex)
    : chooseEasyAiMove(state, playerIndex);
}

export function aiPlayTurn(state, playerIndex, difficulty = 'easy') {
  if (state?.phase !== 'turn' || state.currentPlayerIndex !== playerIndex) return state;

  if (difficulty !== 'hard') return playEasyTurn(state, playerIndex);
  return playHardTurn(state, playerIndex);
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

function playEasyTurn(state, playerIndex) {
  let working = state;
  const source = chooseEasySource(working, playerIndex);

  if (source === 'discard') {
    const taken = takeDiscard(working);
    if (taken.error || !taken.drawn) return working;
    working = taken.state;
    const target = chooseEasyTarget(working.players[playerIndex].grid, taken.drawn);
    return replaceGridCard(working, playerIndex, target.r, target.c, taken.drawn).state;
  }

  const drawn = drawFromDeck(working);
  if (drawn.error || !drawn.drawn) return working;
  working = drawn.state;
  const target = chooseEasyTarget(working.players[playerIndex].grid, drawn.drawn);
  return replaceGridCard(working, playerIndex, target.r, target.c, drawn.drawn).state;
}

function playHardTurn(state, playerIndex) {
  let working = state;
  const source = chooseHardSource(working, playerIndex);

  if (source === 'discard') {
    const taken = takeDiscard(working);
    if (taken.error || !taken.drawn) return working;
    working = taken.state;
    const target = chooseDirectTargetForKeptCard(working.players[playerIndex].grid, taken.drawn);
    return replaceGridCard(working, playerIndex, target.r, target.c, taken.drawn).state;
  }

  const drawn = drawFromDeck(working);
  if (drawn.error || !drawn.drawn) return working;
  working = drawn.state;
  const move = chooseHardDrawnCardMove(working, playerIndex, drawn.drawn);

  if (move.discardDrawn) {
    return discardDrawn(working, playerIndex, drawn.drawn).state;
  }

  const target = move.target || chooseDirectTargetForKeptCard(working.players[playerIndex].grid, drawn.drawn);
  if (move.revealThenDecide) {
    const revealed = revealGridCardForDecision(working, playerIndex, target.r, target.c);
    if (!revealed.error) {
      const choice = chooseRevealDecision(revealed.state, playerIndex, drawn.drawn, target);
      return resolvePendingGridDecision(revealed.state, playerIndex, drawn.drawn, choice).state;
    }
  }

  return replaceGridCard(working, playerIndex, target.r, target.c, drawn.drawn).state;
}

function chooseEasyAiMove(state, playerIndex) {
  const source = chooseEasySource(state, playerIndex);
  const card = source === 'discard' ? state.topDiscard : peekDrawCard(state);
  const grid = state.players[playerIndex]?.grid;
  const target = card && grid ? chooseEasyTarget(grid, card) : null;
  return {
    source,
    card,
    target: target ? { playerIndex, r: target.r, c: target.c } : null,
    discardDrawn: false,
    intent: source === 'discard' ? 'take-obvious-discard' : 'simple-draw-replace',
  };
}

function chooseHardAiMove(state, playerIndex) {
  const source = chooseHardSource(state, playerIndex);
  if (source === 'discard') {
    const card = state.topDiscard;
    const target = card ? chooseDirectTargetForKeptCard(state.players[playerIndex].grid, card) : null;
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
  return chooseHardDrawnCardMove(state, playerIndex, card);
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

function chooseHardSource(state, playerIndex) {
  if (mustDrawOnly(state, playerIndex)) return 'draw';
  const top = state.topDiscard;
  const grid = state.players[playerIndex]?.grid;
  if (!top || !grid) return 'draw';

  const topValue = cardValue(top);
  const hiddenCount = countFaceDownCards(grid);
  const worst = worstFaceUp(grid);

  if (visibleColumnCompletionTarget(grid, top)) return 'discard';
  if (topValue <= HARD_DIRECT_KEEP_MAX) return 'discard';
  if (visibleColumnSetupTarget(grid, top) && topValue <= HARD_SETUP_MAX) return 'discard';
  if (worst && topValue <= worst.score - HARD_BIG_IMPROVEMENT) return 'discard';
  if (hiddenCount <= 2 && worst && topValue < worst.score) return 'discard';
  return 'draw';
}

function chooseHardDrawnCardMove(state, playerIndex, card) {
  const grid = state.players[playerIndex]?.grid;
  if (!grid || !card) {
    return { source: 'draw', card, target: null, discardDrawn: false, intent: 'missing-grid' };
  }

  if (shouldDiscardDrawnHard(state, playerIndex, card)) {
    return { source: 'draw', card, target: null, discardDrawn: true, intent: 'discard-low-utility-draw' };
  }

  const target = chooseHardTargetForDraw(state, playerIndex, card);
  const shouldReveal = target && canRevealForDecision(grid, target.r, target.c) && shouldRevealBeforeChoosing(grid, card, target);
  return {
    source: 'draw',
    card,
    target: target ? { playerIndex, r: target.r, c: target.c } : null,
    discardDrawn: false,
    revealThenDecide: shouldReveal,
    intent: shouldReveal ? 'reveal-before-commit' : 'keep-drawn-card',
  };
}

function shouldDiscardDrawnHard(state, playerIndex, card) {
  if (!canDiscardDrawnForAi(state, playerIndex)) return false;
  const grid = state.players[playerIndex]?.grid;
  if (!grid) return false;

  const incomingValue = cardValue(card);
  const worst = worstFaceUp(grid);
  if (visibleColumnCompletionTarget(grid, card)) return false;
  if (visibleColumnSetupTarget(grid, card) && incomingValue <= HARD_SETUP_MAX) return false;
  if (incomingValue <= HARD_REVEAL_MAX) return false;
  if (worst && incomingValue <= worst.score - 1) return false;
  if (cardDangerToOpponents(state, playerIndex, card) >= 7) return false;
  return true;
}

function canDiscardDrawnForAi(state, playerIndex) {
  return mustDrawOnly(state, playerIndex)
    || (countFaceDownCards(state.players[playerIndex]?.grid) === 1 && !state.sweepActive);
}

function chooseHardTargetForDraw(state, playerIndex, card) {
  const grid = state.players[playerIndex]?.grid;
  if (!grid) return null;
  const completion = visibleColumnCompletionTarget(grid, card);
  if (completion) return completion;

  const setup = visibleColumnSetupTarget(grid, card);
  const incomingValue = cardValue(card);
  const hiddenCount = countFaceDownCards(grid);
  if (setup && (incomingValue <= HARD_SETUP_MAX || hiddenCount >= 4)) return setup;

  const hidden = bestHiddenTarget(grid, card);
  if (hidden && (hiddenCount >= 3 || incomingValue <= HARD_REVEAL_MAX)) return hidden;

  const worst = worstFaceUp(grid);
  if (worst && incomingValue <= worst.score - 1) return { r: worst.r, c: worst.c };
  if (hidden) return hidden;
  if (worst) return { r: worst.r, c: worst.c };
  return legacyPickTarget(grid, card);
}

function chooseDirectTargetForKeptCard(grid, card) {
  const completion = visibleColumnCompletionTarget(grid, card);
  if (completion) return completion;

  const incomingValue = cardValue(card);
  const setup = visibleColumnSetupTarget(grid, card);
  if (setup && incomingValue <= HARD_SETUP_MAX) return setup;

  const hidden = bestHiddenTarget(grid, card);
  const worst = worstFaceUp(grid);
  if (incomingValue <= HARD_DIRECT_KEEP_MAX && hidden) return hidden;
  if (worst && incomingValue <= worst.score - 1) return { r: worst.r, c: worst.c };
  if (hidden) return hidden;
  if (worst) return { r: worst.r, c: worst.c };
  return legacyPickTarget(grid, card);
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
  const drawnDanger = cardDangerToOpponents(state, playerIndex, drawn);
  const revealedDanger = cardDangerToOpponents(state, playerIndex, revealed);

  if (drawnDanger > revealedDanger && drawnValue <= revealedValue + 4) return 'drawn';
  if (revealedDanger > drawnDanger && revealedValue <= drawnValue + 4) return 'revealed';
  if (drawnValue <= revealedValue - 2) return 'drawn';
  return revealedValue <= drawnValue ? 'revealed' : 'drawn';
}

function visibleColumnCompletionTarget(grid, incoming) {
  for (let c = 0; c < COLS; c += 1) {
    const column = columnCards(grid, c);
    const visibleMatches = column.filter(card => card && card.faceUp && card.rank === incoming.rank).length;
    if (visibleMatches < 2) continue;
    for (let r = 0; r < ROWS; r += 1) {
      const card = grid[r]?.[c];
      if (card && (!card.faceUp || card.rank !== incoming.rank)) return { r, c };
    }
  }
  return null;
}

function visibleColumnSetupTarget(grid, incoming) {
  for (let c = 0; c < COLS; c += 1) {
    const column = columnCards(grid, c);
    const visibleMatches = column.filter(card => card && card.faceUp && card.rank === incoming.rank).length;
    if (visibleMatches !== 1) continue;
    for (let r = 0; r < ROWS; r += 1) {
      const card = grid[r]?.[c];
      if (card && !card.faceUp) return { r, c };
    }
  }
  return null;
}

function bestHiddenTarget(grid, incoming) {
  let best = null;
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
      if (!best || score > best.score) best = { r, c, score };
    }
  }
  return best ? { r: best.r, c: best.c } : null;
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

function worstFaceUp(grid) {
  let out = null;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const cell = grid[r]?.[c];
      if (!cell || !cell.faceUp || cell.zeroed) continue;
      const score = cardValue(cell);
      if (!out || score > out.score) out = { r, c, score };
    }
  }
  return out;
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
