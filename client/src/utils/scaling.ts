// src/utils/scaling.ts
// Purpose: Percent-of-screen, no-scroll scaling that keeps the in-game
// header, opponent row, piles, player grid, and footer visible.

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type Metrics = { cardW: number; cardH: number; gap: number };
export type BoardMetrics = { me: Metrics; opp: Metrics };

export const APP_CONTENT_MAX_WIDTH = 720;
export const GAME_CONTENT_MAX_WIDTH = 760;

export function responsiveHorizontalPadding(width: number): number {
  if (width < 360) return 12;
  if (width >= 600) return 24;
  return 18;
}

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

  const opponentCount = Math.max(0, playerCount - 1);
  const ME_SCALE =
    playerCount === 2 ? 0.66 :
    playerCount === 3 ? 0.61 :
    0.56;
  const OPP_SCALE =
    playerCount === 2 ? 0.55 :
    playerCount === 3 ? 0.52 :
    0.46;
  const PILE_SCALE = 1.12;
  const PANEL_PAD = 6;
  const OPP_HEADER_H = 46;
  const LOCAL_HEADER_H = 52;

  const widthBound = Math.floor((usableW - 2 * gap) / 3);

  // Find biggest base card width that fits the top-opponents layout.
  let lo = 16, hi = widthBound, best = 16;

  function fits(baseCardW: number): boolean {
    const cardW_me = Math.floor(baseCardW * ME_SCALE);
    const cardH_me = Math.round(cardW_me * CARD_ASPECT);
    const cardW_opp = Math.floor(baseCardW * OPP_SCALE);
    const cardH_opp = Math.round(cardW_opp * CARD_ASPECT);

    const oppPanelW = 3 * cardW_opp + 2 * gap + PANEL_PAD * 2 + 2;
    const opponentRowW = opponentCount > 0 ? oppPanelW * opponentCount + gap * Math.max(0, opponentCount - 1) : 0;
    const widthFits = opponentRowW <= usableW;
    if (!widthFits) return false;

    const heightOpp = 3 * cardH_opp + 2 * gap + OPP_HEADER_H + PANEL_PAD * 2 + 2;
    const pileCardH = Math.round(cardH_opp * PILE_SCALE);
    const heightPiles = pileCardH + 44;
    const heightTop = opponentCount > 0 ? heightOpp + gap : 0;
    const heightMe = 3 * cardH_me + 2 * gap + LOCAL_HEADER_H + 14;

    return heightTop + heightPiles + heightMe + gap * 2 <= usableH;
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

  const cardW_me = Math.floor(best * ME_SCALE);
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
  return computeMetrics(playerCount, Math.min(width, GAME_CONTENT_MAX_WIDTH), height, top, bottom);
}
