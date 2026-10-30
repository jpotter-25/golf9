// Actual card/grid/pile components; synthetic table only, no live accounts.
const React = require('react');
const RN = require('react-native-web');
const { compile } = require('./topBarFixture.cjs');
const { tablePilePresentation } = compile('src/game/tablePresentation.ts');
const hooks = { ...React, useEffect: () => {}, useRef: value => ({ current: value }) };
const Card = compile('src/components/Card.tsx', {
  react: hooks, 'react-native': RN,
  '../theme/cosmetics': { getCardBackVisual: () => ({ backgroundColor: '#203650', borderColor: '#62809c' }) },
  './CosmeticArt': { CardBackArtwork: () => React.createElement(RN.Text, { style: { color: '#91abc4' } }, '♠') },
}).default;
const dependencies = { react: hooks, 'react-native': RN, './Card': { default: Card, __esModule: true } };
const Piles = compile('src/components/Piles.tsx', dependencies).default;
const Grid = compile('src/components/Grid.tsx', dependencies).default;
const drawn = { id: 'public-nine', rank: '9', suit: '♣', faceUp: true };

function tableVisibilityFixture({ observer = true, stage = 'reveal' } = {}) {
  const finished = stage === 'finished';
  const state = { phase: 'turn', currentPlayerIndex: finished ? 1 : 0, tableHeld: finished ? null : { playerIndex: 0, card: drawn, source: 'draw' } };
  const grid = Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => ({ id: `hidden-${r}-${c}`, rank: 'A', suit: '♠', faceUp: false })));
  grid[0][1] = { id: 'eight', rank: '8', suit: '♠', faceUp: true };
  if (stage !== 'draw') grid[2][1] = { id: 'revealed-seven', rank: '7', suit: '♠', faceUp: true };
  const display = tablePilePresentation(state, true, !observer && !finished ? drawn : null, !observer && !finished ? 'draw' : null);
  const piles = Piles({ ...display, topDiscard: finished ? drawn : { id: 'discard-eight', rank: '8', suit: '♥', faceUp: true }, drawCount: 84,
    disableDraw: true, disableTake: true, onDraw: () => { throw new Error('Observer must not draw'); }, compact: true });
  const board = Grid({ grid, activeCell: stage === 'reveal' ? { r: 2, c: 1 } : null, metrics: { cardW: 48, cardH: 70, gap: 6 } });
  return { state, piles, board, tree: React.createElement(RN.View, { style: { alignItems: 'center', gap: 12 } }, piles, board) };
}
module.exports = { tableVisibilityFixture, tablePilePresentation };
