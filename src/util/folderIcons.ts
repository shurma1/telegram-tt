import type { IconName } from '../types/icons';

const DEFAULT_ICON = '🗂';
const MAIN_ICON = '💬';

const FOLDER_ICONS_MAPPING: Record<string, IconName> = {
  '🤖': 'bot',
  '📢': 'channel-1',
  '☑️': 'chat',
  '💬': 'chats',
  '🗂': 'folder-1',
  '👥': 'group-1',
  '⭐': 'star-1',
  '👤': 'user-1',
};

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
