// src/utils/scaling.ts
// Purpose: Percent-of-screen, no-scroll scaling that keeps the in-game
// header, score strip, opponents, piles, player grid, and footer visible.

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type Metrics = { cardW: number; cardH: number; gap: number };
export type BoardMetrics = { me: Metrics; opp: Metrics };

const CARD_ASPECT = 1.45; // height / width
const SIDE_PAD = 16;

// Percent-of-height buckets
const HEADER_PCT = 0.11;
const FOOTER_PCT = 0.105;
const GUTTER_PCT = 0.014;
const MIN_HEADER = 86;
const MIN_FOOTER = 72;

export function computeMetrics(
  playerCount: number,
  width: number,
  height: number,
  safeTop: number,
  safeBottom: number
): BoardMetrics {
  const hHeader = Math.max(MIN_HEADER, Math.round(height * HEADER_PCT));
  const hFooter = Math.max(MIN_FOOTER, Math.round(height * FOOTER_PCT));
  const hGutters = Math.round(height * GUTTER_PCT * 3);

  const usableH = Math.max(260, height - safeTop - safeBottom - hHeader - hFooter - hGutters);
  const usableW = width - SIDE_PAD;

  const gap = Math.max(6, Math.min(10, Math.round(width * 0.018)));

  // Opponents are one row (3 in 4P). Keep the local grid compact so the
  // remote boards remain readable in portrait play.
  const OPP_SCALE =
    playerCount === 2 ? 0.64 :
    playerCount === 3 ? 0.46 :
    0.32; // for 4-player mode

  const widthBound = Math.floor((usableW - 2 * gap) / 3);

  // Find biggest "me" card width that fits height budget.
  let lo = 16, hi = widthBound, best = 16;

  function fits(cardW_me: number): boolean {
    const cardH_me = Math.round(cardW_me * CARD_ASPECT);
    const cardW_opp = Math.floor(cardW_me * OPP_SCALE);
    const cardH_opp = Math.round(cardW_opp * CARD_ASPECT);

    const heightOpp = 3 * cardH_opp + 2 * gap + 28;
    const heightPiles = cardH_opp + 34;
    const heightMe = 3 * cardH_me + 2 * gap + 32;

    return heightOpp + heightPiles + heightMe <= usableH;
  }

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const cardW_me = Math.floor(best * 0.74);
  const cardH_me = Math.round(cardW_me * CARD_ASPECT);
  const cardW_opp = Math.floor(best * OPP_SCALE);
  const cardH_opp = Math.round(cardW_opp * CARD_ASPECT);

  return {
    me:  { cardW: cardW_me,  cardH: cardH_me,  gap },
    opp: { cardW: cardW_opp, cardH: cardH_opp, gap },
  };
}

export function useBoardMetrics(playerCount: number): BoardMetrics {
  const { width, height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  return computeMetrics(playerCount, width, height, top, bottom);
}
