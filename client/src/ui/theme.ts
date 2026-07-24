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
    ink: '#142036',
    felt: '#205E56',
    feltDeep: '#174A45',
    feltLight: '#347F72',
    emerald: '#67E0B0',
    mint: '#DDF7EC',
    sky: '#67B7FF',
    gold: '#F4C95D',
    coral: '#FF7F86',
    violet: '#B79AF7',
  },
  surface: {
    base: '#1A2943',
    panel: '#243655',
    panelAlt: '#2B4163',
    raised: '#345176',
    glass: 'rgba(36, 54, 85, 0.92)',
  },
  text: {
    primary: '#F7FAFC',
    secondary: '#D7E2EE',
    muted: '#A9B9CD',
    inverse: '#142036',
  },
  border: {
    soft: '#435C7D',
    strong: '#60799A',
    glow: '#67B7FF',
    gold: '#B58B31',
  },
  rarity: {
    common: '#D7E2EE',
    rare: '#67B7FF',
    epic: '#B79AF7',
    legendary: '#F4C95D',
  },
  feedback: {
    success: '#67E0B0',
    warning: '#FFB84D',
    danger: '#FF7F86',
    reward: '#F4C95D',
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
  app: ['#286A65', '#203E58', '#1A2943'] as const,
  panel: ['#314B70', '#243655'] as const,
  felt: ['#347F72', '#205E56'] as const,
  gold: ['#FFE8A6', '#F4C95D', '#B8892F'] as const,
  emerald: ['#DDF7EC', '#67E0B0', '#2BA77E'] as const,
  sky: ['#D4E7FF', '#67B7FF', '#327AD4'] as const,
  warning: ['#745033', '#4A3540'] as const,
};
