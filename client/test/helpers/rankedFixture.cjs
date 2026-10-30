// Real screen/component styles with synthetic data; no live API or account access.
const React = require('react');
const { topBarFixture, compile, theme } = require('./topBarFixture.cjs');

function rankedFixture({ width = 375, fontScale = 1, ratingBlocked = false, menu = false, claimable = 0, seasonName = 'Season 1' } = {}) {
  const { components, native } = topBarFixture({ width, fontScale, route: 'RankedQueue' });
  const competitive = {
    league: { name: 'Unranked' }, placementsRemaining: 5, placementMatchesRequired: 5,
    season: { name: seasonName, endsAt: Date.now() + 56 * 86400000, rewards: Array.from({ length: claimable }, () => ({ earned: true, claimed: false })) },
  };
  const queue = { queued: true, matchedRoomCode: null, joinedAt: Date.now() - 111000, queuedPlayers: ratingBlocked ? 2 : 1, eligiblePlayers: 1, clubSeparated: false, waitingReason: ratingBlocked ? 'rating_range' : 'more_players' };
  const icon = ({ size = 18, color }) => React.createElement('svg', { width: size, height: size, style: { flexShrink: 0 }, 'aria-hidden': true }, React.createElement('circle', { cx: size / 2, cy: size / 2, r: size / 3, stroke: color, fill: 'none' }));
  let stateIndex = 0;
  const screen = compile(`src/screens/${menu ? 'RankedMenuScreen' : 'RankedQueueScreen'}.tsx`, {
    react: { ...React, useEffect: () => {}, useRef: value => ({ current: value }), useState: value => [menu ? value : [competitive, queue, false, Date.now()][stateIndex++], () => {}] },
    'react-native': native,
    'lucide-react-native': new Proxy({}, { get: () => icon }),
    '../context/AuthContext': { useAuth: () => ({ user: { competitive }, token: 'fixture-only', refreshProfile: () => {} }) },
    '../context/ConnectivityContext': { useConnectivity: () => ({ isOnline: true }) },
    '../context/AvailabilityContext': { useAvailability: () => ({ entry: () => ({ state: 'live' }), isAvailable: () => true, isVisible: () => true, showUnavailable: () => {} }) },
    '../utils/alert': { Alert: { alert: () => {} } },
    '../services/api': {},
    '../ui': { ...components, ...theme },
    '../components/AvatarDecorations': { RankEmblem: icon },
  }).default;
  return screen({ route: { params: { players: 2 } }, navigation: {} });
}

module.exports = { rankedFixture };
