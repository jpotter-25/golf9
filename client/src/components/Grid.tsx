// src/components/Grid.tsx
// Purpose: Renders a 3x3 grid. Supports blue highlight around an "active" cell.

import React from 'react';
import { View } from 'react-native';
import type { Grid } from '../game/types';
import CardView from './Card';
import type { Metrics } from '../utils/scaling';

type Props = {
  grid: Grid;
  metrics: Metrics;
  onPressCard?: (r: number, c: number) => void;
  activeCell?: { r: number; c: number } | null;
};

export default function Grid({ grid, metrics, onPressCard, activeCell }: Props) {
  const { cardW, cardH, gap } = metrics;
  return (
    <View style={{ gap }}>
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap, justifyContent: 'center' }}>
          {row.map((card, c) => {
            const isActive = !!activeCell && activeCell.r === r && activeCell.c === c;
            return (
              <View
                key={c}
                style={{
                  borderRadius: 14,
                  borderWidth: isActive ? 2 : 0,
                  borderColor: isActive ? '#4DA3FF' : 'transparent',
                }}
              >
                <CardView
                  card={card}
                  width={cardW}
                  height={cardH}
                  onPress={onPressCard ? () => onPressCard(r, c) : undefined}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
