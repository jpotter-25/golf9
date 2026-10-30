const assert = require('node:assert/strict');
const test = require('node:test');
const { renderToStaticMarkup } = require('react-dom/server');
const { descendants } = require('./helpers/topBarFixture.cjs');
const { tableVisibilityFixture, tablePilePresentation } = require('./helpers/tableVisibilityFixture.cjs');

test('actor and opponent render the same public draw and mid-turn revealed grid card', () => {
  for (const stage of ['draw', 'reveal', 'finished']) {
    const actor = tableVisibilityFixture({ observer: false, stage });
    const observer = tableVisibilityFixture({ observer: true, stage });
    assert.equal(renderToStaticMarkup(actor.tree), renderToStaticMarkup(observer.tree));
    const drawn = descendants(observer.piles).find(node => node.props.card?.id === 'public-nine');
    assert.ok(drawn);
    assert.equal(drawn.props.card.faceUp, true);
    assert.equal(drawn.props.selected, stage !== 'finished');
    const gridCards = descendants(observer.board).filter(node => node.props.card);
    assert.equal(gridCards.filter(node => node.props.card.faceUp).length, stage === 'draw' ? 1 : 2);
    assert.equal(gridCards.find(node => node.props.card.id === 'revealed-seven')?.props.selected, stage === 'reveal' ? true : stage === 'finished' ? false : undefined);
    assert.ok(descendants(observer.piles).some(node => node.props.onPress && node.props.disabled === true), 'public draw remains non-interactive');
  }
});

test('table display does not alter viewer ownership and supports both card sources', () => {
  for (const source of ['draw', 'discard']) {
    const card = { id: 'public', rank: '9', suit: '♣', faceUp: true };
    const state = { phase: 'turn', currentPlayerIndex: 0, viewerHeldCard: null, tableHeld: { playerIndex: 0, card, source } };
    assert.deepEqual(JSON.parse(JSON.stringify(tablePilePresentation(state, true, null, null))), { held: card, activeSource: source });
    assert.equal(state.viewerHeldCard, null);
  }
});

test('offline play, older servers, completed turns and stale table cards retain safe display behavior', () => {
  const card = { id: 'local', rank: '3', suit: '♥', faceUp: true };
  const state = { phase: 'turn', currentPlayerIndex: 0, tableHeld: { playerIndex: 0, card: { ...card, id: 'remote' }, source: 'draw' } };
  assert.equal(tablePilePresentation(state, false, card, 'discard').held, card);
  assert.equal(tablePilePresentation({ ...state, tableHeld: undefined }, true, card, 'draw').held, card);
  for (const change of [{ phase: 'roundSummary' }, { completed: true }, { currentPlayerIndex: 1 }, { tableHeld: null }]) {
    const display = tablePilePresentation({ ...state, ...change }, true, null, null);
    assert.equal(display.held, null);
    assert.equal(display.activeSource, null);
  }
});
