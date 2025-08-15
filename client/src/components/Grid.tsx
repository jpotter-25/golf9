// src/components/Grid.tsx
// Purpose: 3x3 grid renderer for a player's board.

import React from 'react';
import { View } from 'react-native';
import type { Grid } from '../game/types';
import CardView from './Card';
import { useScale } from '../utils/scaling';

type Props = {
  grid: Grid;
  onPressCard?: (r: number, c: number) => void;
};

export default function Grid({ grid, onPressCard }: Props) {
  const { cardW, cardH, gap } = useScale();
  return (
    <View style={{ gap }}>
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap, justifyContent: 'center' }}>
          {row.map((card, c) => (
            <CardView
              key={c}
              card={card}
              width={cardW}
              height={cardH}
              onPress={onPressCard ? () => onPressCard(r, c) : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
