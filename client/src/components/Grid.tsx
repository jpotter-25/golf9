// client/src/components/Grid.tsx
// Purpose: Display a 3×3 grid of cards.  Supports callbacks for both legacy
// 'onPressCard' props (used in GameScreen) and the newer 'onSelect' prop.
// Extra props such as 'metrics' and 'activeCell' are accepted but not used.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Card from './Card';
import type { Grid as CardGrid } from '../game/types';

export type GridProps = {
  grid: CardGrid;
  /** Callback when the user selects a card using the new API. */
  onSelect?: (row: number, col: number) => void;
  /** Legacy callback used in GameScreen. */
  onPressCard?: (row: number, col: number) => void;
  /** Metrics and activeCell are accepted for compatibility but unused here. */
  metrics?: unknown;
  activeCell?: { r: number; c: number } | null;
  [key: string]: unknown; // allow any other props without error
};

const Grid: React.FC<GridProps> = ({
  grid,
  onSelect,
  onPressCard,
}) => {
  // Use whichever callback is provided.
  const handleSelect = (r: number, c: number) => {
    if (onSelect) {
      onSelect(r, c);
    } else if (onPressCard) {
      onPressCard(r, c);
    }
  };

  return (
    <View style={styles.container}>
      {grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((card, c) => (
            <Card
              key={c}
              card={card}
              onPress={() => handleSelect(r, c)}
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
