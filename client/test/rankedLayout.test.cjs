const assert = require('node:assert/strict');
const test = require('node:test');
const { StyleSheet } = require('react-native-web');
const { renderToStaticMarkup } = require('react-dom/server');
const { descendants } = require('./helpers/topBarFixture.cjs');
const { rankedFixture } = require('./helpers/rankedFixture.cjs');

test('queue explains rating waits, permits clubmates, and separates population from eligibility', () => {
  const html = renderToStaticMarkup(rankedFixture());
  assert.ok(html.includes('Clubmates can match and earn normal ranked results'));
  assert.ok(!html.includes('club protected'));
  assert.ok(html.includes('In queue'));
  assert.ok(html.includes('Eligible for table'));
  assert.ok(!html.includes('outside your current rating range'));
  assert.ok(renderToStaticMarkup(rankedFixture({ ratingBlocked: true })).includes('outside your current rating range'));
});

test('season subtitle gets its own line while badge and heading wrap without squeezing', () => {
  for (const width of [320, 375, 414]) {
    for (const claimable of [0, 12]) {
      const tree = rankedFixture({ width, claimable, seasonName: 'A longer ranked season name' });
      const nodes = descendants(tree);
      const badge = nodes.find(node => node.props.label === `${claimable} Ready`);
      const header = nodes.find(node => Array.isArray(node.props.children) && node.props.children.some(child => child?.props?.label === `${claimable} Ready`));
      assert.equal(StyleSheet.flatten(badge.props.style).flexShrink, 0);
      assert.equal(StyleSheet.flatten(header.props.style).flexWrap, 'wrap');
      assert.ok(!descendants(header).some(node => String(node.props.children).includes('prestige shop access')));
      const title = descendants(header).find(node => node.props.children === 'A longer ranked season name');
      assert.equal(StyleSheet.flatten(title.props.style).flexShrink, 1);
      assert.equal(title.props.numberOfLines, undefined);
      assert.ok(renderToStaticMarkup(tree).includes(`${claimable} Ready`));
    }
  }
});

test('ranked menu season copy can shrink and wrap without pushing its rounds badge outside', () => {
  const nodes = descendants(rankedFixture({ menu: true }));
  const badge = nodes.find(node => node.props.label === '9 ROUNDS');
  const header = nodes.find(node => Array.isArray(node.props.children) && node.props.children.some(child => child?.props?.label === '9 ROUNDS'));
  assert.equal(StyleSheet.flatten(header.props.style).flexWrap, 'wrap');
  assert.equal(StyleSheet.flatten(header.props.children[0].props.style).minWidth, 0);
  assert.equal(StyleSheet.flatten(header.props.children[0].props.style).flexShrink, 1);
  assert.equal(StyleSheet.flatten(badge.props.style).flexShrink, 0);
});
