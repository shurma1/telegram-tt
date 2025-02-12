import React, {
  memo,
  useRef,
} from '../../lib/teact/teact';

import type { ApiMessageEntityCustomEmoji } from '../../api/types';
import type { IFolder } from '../../hooks/useFolder';
import type { IconName } from '../../types/icons';

import { EMOJI_STATUS_LOOP_LIMIT } from '../../config';
import buildClassName from '../../util/buildClassName';
import { getFolderIconName } from '../../util/folderIcons';
import { MouseButton } from '../../util/windowEnvironment';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../hooks/useFastClick';
import useLastCallback from '../../hooks/useLastCallback';

import CustomEmoji from '../common/CustomEmoji';
import Icon from '../common/icons/Icon';
import AnimatedEmoji from '../middle/message/AnimatedEmoji';
import Badge from '../ui/Badge';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import EMOJI_REGEX from '../../lib/twemojiRegex';

export const FOLDER_EMOJI_TEXT_SIZE = 13;
const FOLDER_ICON_SIZE = 36;

enum FolderIconTypes {
  customEmoji = 'custom_emoji',
  animatedEmoji = 'animated_emoji',
  svg = 'svg',
}

interface ICustomEmoji {
  type: FolderIconTypes.customEmoji;
  documentId: string;
}

interface IAnimatedEmoji {
  type: FolderIconTypes.animatedEmoji;
  emoji: string;
}

interface ISvgIcon {
  type: FolderIconTypes.svg;
  iconName: IconName;
}

type IFolderIcon = ICustomEmoji | IAnimatedEmoji | ISvgIcon;

interface OwnProps {
  folder: IFolder;
  isActive: boolean;
  isMainFolder?: boolean;
  onClick?: (idd: number) => void;
  contextRootElementSelector?: string;
  clickArg?: number;
}

const FoldersColumnFolderItem = ({
  folder,
  isMainFolder,
  isActive,
  onClick,
  contextRootElementSelector,
  clickArg,
}: OwnProps) => {
  // eslint-disable-next-line no-null/no-null
  const folderItemRef = useRef<HTMLDivElement>(null);

  const {
    contextMenuAnchor, handleContextMenu, handleBeforeContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(folderItemRef, !folder.contextActions);

  const getTriggerElement = useLastCallback(() => folderItemRef.current);
  const getRootElement = useLastCallback(
    () => (contextRootElementSelector ? folderItemRef.current!.closest(contextRootElementSelector) : document.body),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (folder.contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }
    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }
    onClick?.(clickArg!);
  });

  function getFolderIcon(folderItem: IFolder): IFolderIcon {
    const text = folderItem.titleFormated.text;
    const matches = text.match(EMOJI_REGEX);

    if (matches) {
      const firstEmoji = matches[0];
      const lastEmoji = matches[matches.length - 1];

      const firstIndex = text.indexOf(firstEmoji);
      const lastIndex = text.lastIndexOf(lastEmoji);

      const isFirstEmoji = firstIndex === 0;
      const isLastEmoji = lastIndex === text.length - 2;

      const emoji = isLastEmoji
        ? lastEmoji
        : isFirstEmoji
          ? firstEmoji
          : false;

      if (emoji) {
        const emojiIndex = isLastEmoji
          ? lastIndex
          : firstIndex;

        const entities = folderItem.titleFormated.entities as ApiMessageEntityCustomEmoji[] || undefined;
        if (entities && entities.length > 0) {
          const customEmoji = entities[entities.length - 1].offset === emojiIndex
            ? entities[entities.length - 1].documentId
            : entities[0].offset === emojiIndex
              ? entities[0].documentId
              : false;

          if (customEmoji) {
            return {
              type: FolderIconTypes.customEmoji,
              documentId: customEmoji,
            };
          }
        }

        return {
          type: FolderIconTypes.animatedEmoji,
          emoji,
        };
      }
    }

    return {
      type: FolderIconTypes.svg,
      iconName: getFolderIconName(folder.emoticon, isMainFolder),
    };
  }

  function renderFolderIcon(folderItem: IFolder) {
    const folderIcon = getFolderIcon(folderItem);

    switch (folderIcon.type) {
      case FolderIconTypes.animatedEmoji: {
        return (
          <AnimatedEmoji
            emoji={folderIcon.emoji}
            forceLoadPreview
            withEffects
            customSize={FOLDER_ICON_SIZE}
          />
        );
      }
      case FolderIconTypes.customEmoji: {
        return (
          <CustomEmoji
            key={folderIcon.documentId}
            documentId={folderIcon.documentId}
            style={`width: ${FOLDER_ICON_SIZE}px; height: ${FOLDER_ICON_SIZE}px;`}
            size={FOLDER_ICON_SIZE}
            isBig
            loopLimit={EMOJI_STATUS_LOOP_LIMIT}
          />
        );
      }
      case FolderIconTypes.svg: {
        return (
          <Icon name={folderIcon.iconName} className="folder-icon" />
        );
      }
      default: {
        return undefined;
      }
    }
  }

  const classNames = buildClassName(
    'folders-column-item',
    isActive && 'active',
  );

  return (
    <div
      className={classNames}
      ref={folderItemRef}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <div
        className="folders-column-item-icon"
      >
        {Boolean(folder.badgeCount)
          && (
            <Badge
              text={folder.badgeCount.toString()}
              isAlternateColor={folder.isBadgeActive}
              className="folders-column-item-badge"
            />
          )}
        {renderFolderIcon(folder)}
      </div>
      <span
        className="folder-title"
      >
        {folder.title || ''}
      </span>
      {folder.contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="Folder-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {folder.contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

export default memo(FoldersColumnFolderItem);
