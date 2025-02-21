import type { ApiFormattedText } from '../api/types';
import type { TFolderIcon } from '../components/left/settings/folders/FolderIconPickerMenu';
import { ApiMessageEntityTypes } from '../api/types';

import EMOJI_REGEX from '../lib/twemojiRegex';
import { FOLDER_ICONS } from './folderIcons';

export interface SplittedApiFolder {
  title: ApiFormattedText;
  icon: TFolderIcon | null;
}

export interface MergedApiFolder {
  title: ApiFormattedText;
  emoticon: string;
}

export function splitApiFolder(title: ApiFormattedText, emoticon?: string): SplittedApiFolder {
  const emojiAtEndRegex = new RegExp(`(${EMOJI_REGEX.source})+$`, EMOJI_REGEX.flags);
  const emojiMatch = title.text.match(emojiAtEndRegex);

  if (emojiMatch) {
    const lastEmoji = emojiMatch[0];
    const emojiLength = lastEmoji.length;
    const textWithoutEmoji = title.text.slice(0, -emojiLength);

    if (title.entities?.length) {
      const lastEntity = title.entities[title.entities.length - 1];
      if (
        lastEntity.type === ApiMessageEntityTypes.CustomEmoji
        && lastEntity.offset + lastEntity.length === title.text.length
      ) {
        return {
          title: {
            text: textWithoutEmoji,
            entities: title.entities.slice(0, -1),
          },
          icon: {
            type: 'customEmoji',
            emoticon: lastEmoji,
            documentId: lastEntity.documentId,
          },
        };
      }
    }

    if (lastEmoji === emoticon) {
      return {
        title: {
          text: textWithoutEmoji,
          entities: title.entities || [],
        },
        icon: {
          type: 'icon',
          emoticon: lastEmoji,
        },
      };
    }

    return {
      title: {
        text: textWithoutEmoji,
        entities: title.entities || [],
      },
      icon: {
        type: 'emoji',
        emoticon: lastEmoji,
      },
    };
  }

  if (emoticon) {
    return {
      title,
      icon: {
        type: 'icon',
        emoticon,
      },
    };
  }

  return {
    title,
    // eslint-disable-next-line no-null/no-null
    icon: null,
  };
}

// eslint-disable-next-line consistent-return
export function mergeApiFolder(splittedApiFolder: SplittedApiFolder): MergedApiFolder {
  if (!splittedApiFolder.icon) {
    return {
      title: {
        text: splittedApiFolder.title.text,
        entities: [],
      },
      emoticon: '',
    };
  }

  switch (splittedApiFolder.icon.type) {
    case 'icon': {
      return {
        title: {
          text: splittedApiFolder.title.text + splittedApiFolder.icon.emoticon,
          entities: [],
        },
        emoticon: splittedApiFolder.icon.emoticon,
      };
    }
    case 'emoji': {
      return {
        title: {
          text: splittedApiFolder.title.text + splittedApiFolder.icon.emoticon,
          entities: [],
        },
        emoticon: FOLDER_ICONS[0] === splittedApiFolder.icon.emoticon ? FOLDER_ICONS[1] : FOLDER_ICONS[0],
      };
    }
    case 'customEmoji': {
      const emoticon = splittedApiFolder.icon.emoticon;
      return {
        title: {
          text: splittedApiFolder.title.text + emoticon,
          entities: [{
            type: ApiMessageEntityTypes.CustomEmoji,
            offset: splittedApiFolder.title.text.length,
            length: emoticon!.length,
            documentId: splittedApiFolder.icon.documentId,
          }],
        },
        emoticon: FOLDER_ICONS[0] === emoticon ? FOLDER_ICONS[1] : FOLDER_ICONS[0],
      };
    }
  }
}
