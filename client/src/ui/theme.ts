export type ThemeTokens = {
  palette: {
    ink: string;
    felt: string;
    feltDeep: string;
    feltLight: string;
    emerald: string;
    mint: string;
    sky: string;
    gold: string;
    coral: string;
    violet: string;
  };
  surface: {
    base: string;
    panel: string;
    panelAlt: string;
    raised: string;
    glass: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  border: {
    soft: string;
    strong: string;
    glow: string;
    gold: string;
  };
  rarity: {
    common: string;
    rare: string;
    epic: string;
    legendary: string;
  };
  feedback: {
    success: string;
    warning: string;
    danger: string;
    reward: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
};

export const ui: ThemeTokens = {
  palette: {
    ink: '#070A18',
    felt: '#08261F',
    feltDeep: '#041713',
    feltLight: '#123B32',
    emerald: '#52E5A7',
    mint: '#CFFBE8',
    sky: '#4DA3FF',
    gold: '#FFCC66',
    coral: '#FF6B6B',
    violet: '#A88CFF',
  },
  surface: {
    base: '#0B1023',
    panel: '#121737',
    panelAlt: '#171D43',
    raised: '#1A214B',
    glass: 'rgba(18, 23, 55, 0.88)',
  },
  text: {
    primary: '#F4F7FF',
    secondary: '#C9D1EA',
    muted: '#8D96BE',
    inverse: '#0B1023',
  },
  border: {
    soft: '#2A2F57',
    strong: '#3C4676',
    glow: '#4DA3FF',
    gold: '#9F7A2C',
  },
  rarity: {
    common: '#C9D1EA',
    rare: '#4DA3FF',
    epic: '#A88CFF',
    legendary: '#FFCC66',
  },
  feedback: {
    success: '#52E5A7',
    warning: '#FFB020',
    danger: '#FF6B6B',
    reward: '#FFCC66',
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
};

export const layerZ = {
  table: 0,
  hud: 10,
  action: 20,
  social: 30,
  feedback: 40,
  modal: 50,
};

export const gradients = {
  app: ['#071914', '#0B1023', '#121737'] as const,
  panel: ['#1B2251', '#121737'] as const,
  felt: ['#123B32', '#08261F'] as const,
  gold: ['#FFE39A', '#FFCC66', '#B8842D'] as const,
  emerald: ['#CFFBE8', '#52E5A7', '#1EA97B'] as const,
  sky: ['#BFD9FF', '#4DA3FF', '#1C5FD4'] as const,
  warning: ['#5A2E12', '#3A2414'] as const,
};
