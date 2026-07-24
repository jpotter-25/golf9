export type EquippedCosmetics = {
  cardBack?: string;
  avatarFrame?: string;
  avatarIcon?: string;
  avatarAccessory?: string;
  title?: string;
  tableTheme?: string;
};

export type CardBackVisual = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  mark: string;
};

export type AvatarFrameVisual = {
  borderColor: string;
  backgroundColor: string;
};

export type AvatarIconVisual = {
  icon: 'user' | 'sparkles' | 'shield' | 'trophy';
  color: string;
  backgroundColor: string;
};

export type AvatarAccessoryVisual = {
  icon: 'none' | 'watch' | 'gem' | 'rocket' | 'crown';
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
};

export type TableThemeVisual = {
  backgroundColor: string;
  headerColor: string;
  panelColor: string;
  activePanelColor: string;
  borderColor: string;
  accentColor: string;
};

const CARD_BACKS: Record<string, CardBackVisual> = {
  'classic-card-back': {
    backgroundColor: '#435C7D',
    borderColor: '#F7FAFC',
    textColor: '#F7FAFC',
    mark: '?',
  },
  'gold-trim-card-back': {
    backgroundColor: '#251F10',
    borderColor: '#F4C95D',
    textColor: '#F4C95D',
    mark: 'G9',
  },
  'emerald-card-back': {
    backgroundColor: '#205E56',
    borderColor: '#67E0B0',
    textColor: '#CFFBE8',
    mark: '9',
  },
  'neon-card-back': {
    backgroundColor: '#111A3A',
    borderColor: '#67B7FF',
    textColor: '#BFD9FF',
    mark: 'N',
  },
  's1-gold-card-back': {
    backgroundColor: '#2A2111',
    borderColor: '#F4C95D',
    textColor: '#FFE6A3',
    mark: 'S1',
  },
  's1-master-card-back': {
    backgroundColor: '#101225',
    borderColor: '#D9B8FF',
    textColor: '#F0E3FF',
    mark: 'M',
  },
  'club-crest-card-back': {
    backgroundColor: '#294A68',
    borderColor: '#67E0B0',
    textColor: '#F7FAFC',
    mark: 'C',
  },
  'club-champion-card-back': {
    backgroundColor: '#21162C',
    borderColor: '#F4C95D',
    textColor: '#FFF0C2',
    mark: 'CC',
  },
};

const AVATAR_FRAMES: Record<string, AvatarFrameVisual> = {
  'rookie-avatar-frame': {
    borderColor: '#67E0B0',
    backgroundColor: '#205E56',
  },
  'emerald-avatar-frame': {
    borderColor: '#4DE0A0',
    backgroundColor: '#0D3A35',
  },
  'gold-avatar-frame': {
    borderColor: '#F4C95D',
    backgroundColor: '#2B2515',
  },
  's1-bronze-frame': {
    borderColor: '#C58B5A',
    backgroundColor: '#2B1D17',
  },
  's1-diamond-frame': {
    borderColor: '#9BE7FF',
    backgroundColor: '#214D57',
  },
  'club-emerald-frame': {
    borderColor: '#67E0B0',
    backgroundColor: '#294A68',
  },
};

const AVATAR_ICONS: Record<string, AvatarIconVisual> = {
  'classic-avatar-icon': {
    icon: 'user',
    color: '#F7FAFC',
    backgroundColor: '#205E56',
  },
  'spark-avatar-icon': {
    icon: 'sparkles',
    color: '#F4C95D',
    backgroundColor: '#182244',
  },
  'shield-avatar-icon': {
    icon: 'shield',
    color: '#9BE7FF',
    backgroundColor: '#214D57',
  },
  'trophy-avatar-icon': {
    icon: 'trophy',
    color: '#FFE6A3',
    backgroundColor: '#2B2515',
  },
  's1-diamond-avatar-icon': {
    icon: 'sparkles',
    color: '#BDEBFF',
    backgroundColor: '#214D57',
  },
};

const AVATAR_ACCESSORIES: Record<string, AvatarAccessoryVisual> = {
  'no-avatar-accessory': {
    icon: 'none',
    label: '',
    color: '#A9B9CD',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  'season-watch-accessory': {
    icon: 'watch',
    label: 'S1',
    color: '#BDEBFF',
    backgroundColor: '#214D57',
    borderColor: '#9BE7FF',
  },
  'emerald-gem-accessory': {
    icon: 'gem',
    label: 'G',
    color: '#CFFBE8',
    backgroundColor: '#205E56',
    borderColor: '#67E0B0',
  },
  'rocket-charm-accessory': {
    icon: 'rocket',
    label: 'R',
    color: '#FFE6A3',
    backgroundColor: '#2B2515',
    borderColor: '#F4C95D',
  },
  'legend-crown-accessory': {
    icon: 'crown',
    label: 'L',
    color: '#F0E3FF',
    backgroundColor: '#21162C',
    borderColor: '#D9B8FF',
  },
};

const TABLE_THEMES: Record<string, TableThemeVisual> = {
  'classic-table-theme': {
    backgroundColor: '#1A2943',
    headerColor: '#243655',
    panelColor: '#243655',
    activePanelColor: '#263A5C',
    borderColor: '#435C7D',
    accentColor: '#67B7FF',
  },
  'emerald-felt-table-theme': {
    backgroundColor: '#174A45',
    headerColor: '#205E56',
    panelColor: '#205E56',
    activePanelColor: '#347F72',
    borderColor: '#5BA18F',
    accentColor: '#67E0B0',
  },
  'carbon-table-theme': {
    backgroundColor: '#25303E',
    headerColor: '#313E50',
    panelColor: '#39495E',
    activePanelColor: '#465B73',
    borderColor: '#677C94',
    accentColor: '#BFD9FF',
  },
  's1-platinum-table-theme': {
    backgroundColor: '#1B3449',
    headerColor: '#24455F',
    panelColor: '#2D5370',
    activePanelColor: '#376685',
    borderColor: '#8FB8D8',
    accentColor: '#BDEBFF',
  },
  'club-felt-table-theme': {
    backgroundColor: '#1B4644',
    headerColor: '#245854',
    panelColor: '#2C6761',
    activePanelColor: '#347A70',
    borderColor: '#62A991',
    accentColor: '#67E0B0',
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
