import type { IconName } from '../types/icons';

const DEFAULT_ICON = '🗂';
const MAIN_ICON = '💬';

export const FOLDER_ICONS_MAPPING: Record<string, IconName> = {
  '💬': 'chats',
  '☑️': 'chat',
  '👤': 'user-1',
  '👥': 'group-1',
  '⭐': 'star-1',
  '📢': 'channel-1',
  '🤖': 'bot',
  '🗂': 'folder-1',
};

export const FOLDER_ICONS = Object.keys(FOLDER_ICONS_MAPPING);

export function getFolderIconName(
  emoticon?: string,
  isMainIcon?: boolean,
): IconName {
  if (isMainIcon) {
    return FOLDER_ICONS_MAPPING[MAIN_ICON];
  }

  if (!emoticon) {
    return FOLDER_ICONS_MAPPING[DEFAULT_ICON];
  }

  const path = FOLDER_ICONS_MAPPING[emoticon];

  if (path) {
    return path;
  }

  return FOLDER_ICONS_MAPPING[DEFAULT_ICON];
}
