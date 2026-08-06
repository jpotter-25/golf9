export type EquippedCosmetics = {
  cardBack?: string;
  avatarFrame?: string;
  avatarIcon?: string;
  avatarAccessory?: string;
  title?: string;
  tableTheme?: string;
};

export type CardBackPattern = 'heritage' | 'filigree' | 'vine' | 'circuit' | 'sunburst' | 'masterwork' | 'club' | 'champion' | 'celestial';

export type CardBackVisual = {
  backgroundColor: string;
  secondaryColor: string;
  borderColor: string;
  accentColor: string;
  textColor: string;
  pattern: CardBackPattern;
};

export type AvatarFrameVisual = {
  borderColor: string;
  innerBorderColor: string;
  accentColor: string;
  backgroundColor: string;
  style: 'notched' | 'segmented' | 'halo' | 'bronze' | 'faceted' | 'club' | 'astral';
  effect: 'none' | 'orbit' | 'pulse' | 'shimmer';
};

export type AvatarIconVisual = {
  icon: 'nine' | 'starforge' | 'shield' | 'trophy' | 'diamond' | 'phoenix';
  color: string;
  secondaryColor: string;
  backgroundColor: string;
  glowColor: string;
};

export type AvatarAccessoryVisual = {
  icon: 'none' | 'watch' | 'gem' | 'rocket' | 'crown' | 'comet';
  color: string;
  secondaryColor: string;
  backgroundColor: string;
  borderColor: string;
  effect: 'none' | 'pulse' | 'orbit';
};

export type TableThemeVisual = {
  backgroundColor: string;
  headerColor: string;
  panelColor: string;
  activePanelColor: string;
  borderColor: string;
  accentColor: string;
  secondaryAccentColor: string;
  patternColor: string;
  pattern: 'heritage' | 'constellation' | 'carbon' | 'faceted' | 'club' | 'aurora';
};

const CARD_BACKS: Record<string, CardBackVisual> = {
  'classic-card-back': {
    backgroundColor: '#263A58',
    secondaryColor: '#17263E',
    borderColor: '#B8C7D8',
    accentColor: '#6E89A8',
    textColor: '#F7FAFC',
    pattern: 'heritage',
  },
  'gold-trim-card-back': {
    backgroundColor: '#251D0D',
    secondaryColor: '#4B3513',
    borderColor: '#F4C95D',
    accentColor: '#FFF0B8',
    textColor: '#FFF0B8',
    pattern: 'filigree',
  },
  'emerald-card-back': {
    backgroundColor: '#123D38',
    secondaryColor: '#1D6559',
    borderColor: '#67E0B0',
    accentColor: '#D7F9EA',
    textColor: '#D7F9EA',
    pattern: 'vine',
  },
  'neon-card-back': {
    backgroundColor: '#0A102B',
    secondaryColor: '#17215A',
    borderColor: '#58D6FF',
    accentColor: '#D66BFF',
    textColor: '#E8F8FF',
    pattern: 'circuit',
  },
  'celestial-card-back': {
    backgroundColor: '#100D2D',
    secondaryColor: '#2D1E57',
    borderColor: '#C8B8FF',
    accentColor: '#74DCFF',
    textColor: '#F4F0FF',
    pattern: 'celestial',
  },
  's1-gold-card-back': {
    backgroundColor: '#2A1F0A',
    secondaryColor: '#6B4814',
    borderColor: '#FFD76A',
    accentColor: '#FFF1B7',
    textColor: '#FFF1B7',
    pattern: 'sunburst',
  },
  's1-master-card-back': {
    backgroundColor: '#0C1028',
    secondaryColor: '#312153',
    borderColor: '#D9B8FF',
    accentColor: '#77D9FF',
    textColor: '#F4E9FF',
    pattern: 'masterwork',
  },
  'club-crest-card-back': {
    backgroundColor: '#17364E',
    secondaryColor: '#285B70',
    borderColor: '#81D9D0',
    accentColor: '#E1FCF5',
    textColor: '#F7FAFC',
    pattern: 'club',
  },
  'club-champion-card-back': {
    backgroundColor: '#21132F',
    secondaryColor: '#54305B',
    borderColor: '#F4C95D',
    accentColor: '#D9B8FF',
    textColor: '#FFF0C2',
    pattern: 'champion',
  },
};

const AVATAR_FRAMES: Record<string, AvatarFrameVisual> = {
  'rookie-avatar-frame': {
    borderColor: '#A9B9CD',
    innerBorderColor: '#60799A',
    accentColor: '#E5EDF5',
    backgroundColor: '#243655',
    style: 'notched',
    effect: 'none',
  },
  'emerald-avatar-frame': {
    borderColor: '#67B7FF',
    innerBorderColor: '#BFD9FF',
    accentColor: '#F7FAFC',
    backgroundColor: '#173B5B',
    style: 'segmented',
    effect: 'orbit',
  },
  'gold-avatar-frame': {
    borderColor: '#F4C95D',
    innerBorderColor: '#FFE7A0',
    accentColor: '#FFF7D6',
    backgroundColor: '#3A2C10',
    style: 'halo',
    effect: 'shimmer',
  },
  'astral-avatar-frame': {
    borderColor: '#B79AF7',
    innerBorderColor: '#74DCFF',
    accentColor: '#F4F0FF',
    backgroundColor: '#1A1743',
    style: 'astral',
    effect: 'orbit',
  },
  's1-bronze-frame': {
    borderColor: '#C58B5A',
    innerBorderColor: '#F2C59E',
    accentColor: '#FFE0B7',
    backgroundColor: '#352117',
    style: 'bronze',
    effect: 'none',
  },
  's1-diamond-frame': {
    borderColor: '#9BE7FF',
    innerBorderColor: '#E6FAFF',
    accentColor: '#C8B8FF',
    backgroundColor: '#183F55',
    style: 'faceted',
    effect: 'pulse',
  },
  'club-emerald-frame': {
    borderColor: '#81D9D0',
    innerBorderColor: '#F4C95D',
    accentColor: '#E1FCF5',
    backgroundColor: '#1E4258',
    style: 'club',
    effect: 'none',
  },
};

const AVATAR_ICONS: Record<string, AvatarIconVisual> = {
  'classic-avatar-icon': {
    icon: 'nine',
    color: '#F7FAFC',
    secondaryColor: '#9EC4E7',
    backgroundColor: '#263A58',
    glowColor: '#67B7FF',
  },
  'spark-avatar-icon': {
    icon: 'starforge',
    color: '#FFE07A',
    secondaryColor: '#FF9E64',
    backgroundColor: '#282041',
    glowColor: '#F4C95D',
  },
  'shield-avatar-icon': {
    icon: 'shield',
    color: '#C9EEFF',
    secondaryColor: '#67B7FF',
    backgroundColor: '#173B5B',
    glowColor: '#74DCFF',
  },
  'trophy-avatar-icon': {
    icon: 'trophy',
    color: '#FFF0B8',
    secondaryColor: '#F4C95D',
    backgroundColor: '#3A2C10',
    glowColor: '#FFE07A',
  },
  's1-diamond-avatar-icon': {
    icon: 'diamond',
    color: '#E6FAFF',
    secondaryColor: '#88DFFF',
    backgroundColor: '#183F55',
    glowColor: '#C8B8FF',
  },
  'phoenix-avatar-icon': {
    icon: 'phoenix',
    color: '#FFF0B8',
    secondaryColor: '#FF7F86',
    backgroundColor: '#3A1733',
    glowColor: '#FFB84D',
  },
};

const AVATAR_ACCESSORIES: Record<string, AvatarAccessoryVisual> = {
  'no-avatar-accessory': {
    icon: 'none',
    color: '#A9B9CD',
    secondaryColor: '#60799A',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    effect: 'none',
  },
  'season-watch-accessory': {
    icon: 'watch',
    color: '#E6FAFF',
    secondaryColor: '#67B7FF',
    backgroundColor: '#183F55',
    borderColor: '#9BE7FF',
    effect: 'none',
  },
  'emerald-gem-accessory': {
    icon: 'gem',
    color: '#E1FCF5',
    secondaryColor: '#45C892',
    backgroundColor: '#12463D',
    borderColor: '#67E0B0',
    effect: 'pulse',
  },
  'rocket-charm-accessory': {
    icon: 'rocket',
    color: '#FFF0B8',
    secondaryColor: '#FF7F86',
    backgroundColor: '#3A2430',
    borderColor: '#F4C95D',
    effect: 'none',
  },
  'comet-orbit-accessory': {
    icon: 'comet',
    color: '#E6FAFF',
    secondaryColor: '#B79AF7',
    backgroundColor: '#1A1743',
    borderColor: '#74DCFF',
    effect: 'orbit',
  },
  'legend-crown-accessory': {
    icon: 'crown',
    color: '#FFF0B8',
    secondaryColor: '#D9B8FF',
    backgroundColor: '#251439',
    borderColor: '#F4C95D',
    effect: 'pulse',
  },
};

const TABLE_THEMES: Record<string, TableThemeVisual> = {
  'classic-table-theme': {
    backgroundColor: '#172943',
    headerColor: '#243655',
    panelColor: '#243655',
    activePanelColor: '#2B4266',
    borderColor: '#4B6788',
    accentColor: '#67B7FF',
    secondaryAccentColor: '#A9B9CD',
    patternColor: '#9EC4E7',
    pattern: 'heritage',
  },
  'emerald-felt-table-theme': {
    backgroundColor: '#123D38',
    headerColor: '#194C46',
    panelColor: '#205E56',
    activePanelColor: '#2F796D',
    borderColor: '#5BA18F',
    accentColor: '#67E0B0',
    secondaryAccentColor: '#CFFBE8',
    patternColor: '#8DE9C2',
    pattern: 'constellation',
  },
  'carbon-table-theme': {
    backgroundColor: '#171D27',
    headerColor: '#232C39',
    panelColor: '#303D4E',
    activePanelColor: '#40536B',
    borderColor: '#677C94',
    accentColor: '#BFD9FF',
    secondaryAccentColor: '#67B7FF',
    patternColor: '#A9B9CD',
    pattern: 'carbon',
  },
  'aurora-table-theme': {
    backgroundColor: '#101633',
    headerColor: '#1A2447',
    panelColor: '#24345E',
    activePanelColor: '#344D75',
    borderColor: '#7898C7',
    accentColor: '#74DCFF',
    secondaryAccentColor: '#D79BFF',
    patternColor: '#B7F1FF',
    pattern: 'aurora',
  },
  's1-platinum-table-theme': {
    backgroundColor: '#152E43',
    headerColor: '#20445F',
    panelColor: '#2A526E',
    activePanelColor: '#376B88',
    borderColor: '#8FB8D8',
    accentColor: '#D5F3FF',
    secondaryAccentColor: '#B79AF7',
    patternColor: '#BDEBFF',
    pattern: 'faceted',
  },
  'club-felt-table-theme': {
    backgroundColor: '#153A40',
    headerColor: '#1E4A50',
    panelColor: '#285C60',
    activePanelColor: '#347076',
    borderColor: '#6AA8A1',
    accentColor: '#81D9D0',
    secondaryAccentColor: '#F4C95D',
    patternColor: '#BDEDE5',
    pattern: 'club',
  },
};

export function getCardBackVisual(cardBackId?: string | null): CardBackVisual {
  return CARD_BACKS[cardBackId || ''] || CARD_BACKS['classic-card-back'];
}

export function getAvatarFrameVisual(avatarFrameId?: string | null): AvatarFrameVisual {
  return AVATAR_FRAMES[avatarFrameId || ''] || AVATAR_FRAMES['rookie-avatar-frame'];
}

export function getAvatarIconVisual(avatarIconId?: string | null): AvatarIconVisual {
  return AVATAR_ICONS[avatarIconId || ''] || AVATAR_ICONS['classic-avatar-icon'];
}

export function getAvatarAccessoryVisual(avatarAccessoryId?: string | null): AvatarAccessoryVisual {
  return AVATAR_ACCESSORIES[avatarAccessoryId || ''] || AVATAR_ACCESSORIES['no-avatar-accessory'];
}

export function getTableThemeVisual(tableThemeId?: string | null): TableThemeVisual {
  return TABLE_THEMES[tableThemeId || ''] || TABLE_THEMES['classic-table-theme'];
}
