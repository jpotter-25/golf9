// client/src/components/Grid.tsx
// Purpose: Display a 3×3 grid of cards. Calls back when a card is selected.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Card from './Card';
import type { Grid as CardGrid } from '../game/types';

export type GridProps = {
  grid: CardGrid;
  // Callback for when the user selects a card (row, col).
  onSelect?: (row: number, col: number) => void;
};

const Grid: React.FC<GridProps> = ({ grid, onSelect }) => {
  return (
    <View style={styles.container}>
      {grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((card, c) => (
            <Card
              key={c}
              card={card}
              onPress={() => {
                if (onSelect) onSelect(r, c);
              }}
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
