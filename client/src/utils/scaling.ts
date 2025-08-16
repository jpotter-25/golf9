// src/utils/scaling.ts
// Purpose: Percent-of-screen, no-scroll scaling that ALWAYS keeps
// header, opponents, piles, my grid, and footer fully visible.
// Now globally scales down the current player's grid by 20% to provide extra footer clearance.

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type Metrics = { cardW: number; cardH: number; gap: number };
export type BoardMetrics = { me: Metrics; opp: Metrics };

const CARD_ASPECT = 1.45; // height / width
const SIDE_PAD = 16;

// Percent-of-height buckets
const HEADER_PCT = 0.07;
const FOOTER_PCT = 0.11;
const GUTTER_PCT = 0.018; // tighter vertical gutters

export function computeMetrics(
  playerCount: number,
  width: number,
  height: number,
  safeTop: number,
  safeBottom: number
): BoardMetrics {
  const hHeader = Math.round(height * HEADER_PCT);
  const hFooter = Math.round(height * FOOTER_PCT);
  const hGutters = Math.round(height * GUTTER_PCT * 3);

  const usableH = height - safeTop - safeBottom - hHeader - hFooter - hGutters;
  const usableW = width - SIDE_PAD;

  const gap = Math.max(6, Math.min(10, Math.round(width * 0.018)));

  // Opponents are one row (3 in 4P). Make them smaller in 4P to guarantee fit.
  const OPP_SCALE =
    playerCount === 2 ? 0.64 :
    playerCount === 3 ? 0.53 :
    0.40; // for 4-player mode

  const widthBound = Math.floor((usableW - 2 * gap) / 3);

  // Find biggest "me" card width that fits height budget.
  let lo = 16, hi = widthBound, best = 16;

  function fits(cardW_me: number): boolean {
    const cardH_me = Math.round(cardW_me * CARD_ASPECT);
    const cardW_opp = Math.floor(cardW_me * OPP_SCALE);
    const cardH_opp = Math.round(cardW_opp * CARD_ASPECT);

    const heightOpp = 3 * cardH_opp + 2 * gap;
    const heightPiles = cardH_opp + Math.max(10, Math.round(cardH_opp * 0.06));
    const heightMe = 3 * cardH_me + 2 * gap;

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

  // Apply a 20% reduction to the current player's card size
  const cardW_me = Math.floor(best * 0.8);
  const cardH_me = Math.round(cardW_me * CARD_ASPECT);
  const cardW_opp = Math.floor(cardW_me * OPP_SCALE);
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
