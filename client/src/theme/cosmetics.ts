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
    backgroundColor: '#2A2F57',
    borderColor: '#E8ECF1',
    textColor: '#E8ECF1',
    mark: '?',
  },
  'gold-trim-card-back': {
    backgroundColor: '#251F10',
    borderColor: '#FFCC66',
    textColor: '#FFCC66',
    mark: 'G9',
  },
  'emerald-card-back': {
    backgroundColor: '#123B32',
    borderColor: '#52E5A7',
    textColor: '#CFFBE8',
    mark: '9',
  },
  'neon-card-back': {
    backgroundColor: '#111A3A',
    borderColor: '#4DA3FF',
    textColor: '#BFD9FF',
    mark: 'N',
  },
  's1-gold-card-back': {
    backgroundColor: '#2A2111',
    borderColor: '#FFCC66',
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
    backgroundColor: '#102448',
    borderColor: '#52E5A7',
    textColor: '#E8ECF1',
    mark: 'C',
  },
  'club-champion-card-back': {
    backgroundColor: '#21162C',
    borderColor: '#FFCC66',
    textColor: '#FFF0C2',
    mark: 'CC',
  },
};

const AVATAR_FRAMES: Record<string, AvatarFrameVisual> = {
  'rookie-avatar-frame': {
    borderColor: '#52E5A7',
    backgroundColor: '#123B32',
  },
  'emerald-avatar-frame': {
    borderColor: '#4DE0A0',
    backgroundColor: '#0D3A35',
  },
  'gold-avatar-frame': {
    borderColor: '#FFCC66',
    backgroundColor: '#2B2515',
  },
  's1-bronze-frame': {
    borderColor: '#C58B5A',
    backgroundColor: '#2B1D17',
  },
  's1-diamond-frame': {
    borderColor: '#9BE7FF',
    backgroundColor: '#102838',
  },
  'club-emerald-frame': {
    borderColor: '#52E5A7',
    backgroundColor: '#102448',
  },
};

const AVATAR_ICONS: Record<string, AvatarIconVisual> = {
  'classic-avatar-icon': {
    icon: 'user',
    color: '#E8ECF1',
    backgroundColor: '#123B32',
  },
  'spark-avatar-icon': {
    icon: 'sparkles',
    color: '#FFCC66',
    backgroundColor: '#182244',
  },
  'shield-avatar-icon': {
    icon: 'shield',
    color: '#9BE7FF',
    backgroundColor: '#102838',
  },
  'trophy-avatar-icon': {
    icon: 'trophy',
    color: '#FFE6A3',
    backgroundColor: '#2B2515',
  },
  's1-diamond-avatar-icon': {
    icon: 'sparkles',
    color: '#BDEBFF',
    backgroundColor: '#102838',
  },
};

const AVATAR_ACCESSORIES: Record<string, AvatarAccessoryVisual> = {
  'no-avatar-accessory': {
    icon: 'none',
    label: '',
    color: '#9BA3C7',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  'season-watch-accessory': {
    icon: 'watch',
    label: 'S1',
    color: '#BDEBFF',
    backgroundColor: '#102838',
    borderColor: '#9BE7FF',
  },
  'emerald-gem-accessory': {
    icon: 'gem',
    label: 'G',
    color: '#CFFBE8',
    backgroundColor: '#123B32',
    borderColor: '#52E5A7',
  },
  'rocket-charm-accessory': {
    icon: 'rocket',
    label: 'R',
    color: '#FFE6A3',
    backgroundColor: '#2B2515',
    borderColor: '#FFCC66',
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
    backgroundColor: '#0B1023',
    headerColor: '#101633',
    panelColor: '#121737',
    activePanelColor: '#0F1530',
    borderColor: '#2A2F57',
    accentColor: '#4DA3FF',
  },
  'emerald-felt-table-theme': {
    backgroundColor: '#071914',
    headerColor: '#0D2A24',
    panelColor: '#123B32',
    activePanelColor: '#0F4637',
    borderColor: '#235A4B',
    accentColor: '#52E5A7',
  },
  'carbon-table-theme': {
    backgroundColor: '#080A10',
    headerColor: '#11141E',
    panelColor: '#181C29',
    activePanelColor: '#202638',
    borderColor: '#343A4D',
    accentColor: '#BFD9FF',
  },
  's1-platinum-table-theme': {
    backgroundColor: '#08111B',
    headerColor: '#101C2A',
    panelColor: '#13253A',
    activePanelColor: '#19314B',
    borderColor: '#8FB8D8',
    accentColor: '#BDEBFF',
  },
  'club-felt-table-theme': {
    backgroundColor: '#081712',
    headerColor: '#0D211D',
    panelColor: '#132B31',
    activePanelColor: '#153C38',
    borderColor: '#2A6655',
    accentColor: '#52E5A7',
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
