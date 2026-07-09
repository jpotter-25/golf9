// src/game/types.ts
// Purpose: Re-export shared card/player/game types so local and online play use one model.

export type {
  Suit,
  Rank,
  Card,
  Grid,
  Player,
  PlayerIdentity,
  GameState,
} from '../../../shared/rules';

export type GameMode = 'passplay' | 'solo' | 'online';
