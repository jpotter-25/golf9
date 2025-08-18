// client/src/components/Grid.tsx
// Purpose: Display a 3×3 grid of cards.  If a `metrics` prop is provided,
// cards will use the specified width, height and gap from metrics to size and
// space themselves.  Supports both the new 'onSelect' callback and the
// legacy 'onPressCard' used in GameScreen.  Extra props are accepted for
// compatibility (e.g., 'metrics' and 'activeCell').

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Card from './Card';
import type { Grid as CardGrid } from '../game/types';
import type { Metrics } from '../utils/scaling';

export type GridProps = {
  grid: CardGrid;
  onSelect?: (row: number, col: number) => void;
  onPressCard?: (row: number, col: number) => void;
  /** Optional metrics used to size cards and gaps dynamically. */
  metrics?: Metrics;
  activeCell?: { r: number; c: number } | null;
  [key: string]: unknown;
};

const Grid: React.FC<GridProps> = ({
  grid,
  onSelect,
  onPressCard,
  metrics,
}) => {
  const handleSelect = (r: number, c: number) => {
    if (onSelect) onSelect(r, c);
    else if (onPressCard) onPressCard(r, c);
  };

  // Compute card size and margin based on metrics, defaulting to 60×90 with 4px gap.
  const cardW = metrics ? metrics.cardW : 60;
  const cardH = metrics ? metrics.cardH : 90;
  const gap = metrics ? metrics.gap : 8;
  const margin = gap / 2;

  return (
    <View style={styles.container}>
      {grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((card, c) => (
            <Card
              key={c}
              card={card}
              onPress={() => handleSelect(r, c)}
              width={cardW}
              height={cardH}
              margin={margin}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

export default Grid;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
  },
});
