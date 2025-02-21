import React, {
  memo,
  useEffect,
  useRef, useState,
} from '../../lib/teact/teact';

import type { ApiFormattedText } from '../../api/types';
import type { IFolder } from '../../hooks/useFolder';
import type { TFolderIcon } from './settings/folders/FolderIconPickerMenu';

import { EMOJI_STATUS_LOOP_LIMIT } from '../../config';
import { splitApiFolder } from '../../util/ApiFolderSplitAndMerge';
import buildClassName from '../../util/buildClassName';
import { getFolderIconName } from '../../util/folderIcons';
import { MouseButton } from '../../util/windowEnvironment';
import { renderTextWithEntities } from '../common/helpers/renderTextWithEntities';

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

export const FOLDER_EMOJI_TEXT_SIZE = 13;
const FOLDER_ICON_SIZE = 36;

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

  const [title, setTitle] = useState<ApiFormattedText>({ text: '', entities: [] });
  // eslint-disable-next-line no-null/no-null
  const [icon, setIcon] = useState<TFolderIcon | null>(null);

  useEffect(() => {
    if (!folder) return;
    const splttedApiFolder = splitApiFolder(folder.titleFormated, folder.emoticon);
    setTitle(splttedApiFolder.title);
    setIcon(splttedApiFolder.icon);
  }, [folder]);

  const renderFolderIcon = (folderIcon: TFolderIcon | null, isMain?: boolean) => {
    if (isMain) {
      return <Icon name="chats" />;
    }
    if (!folderIcon) {
      return <Icon name="folder-1" />;
    }

    switch (folderIcon.type) {
      case 'icon': {
        return <Icon name={getFolderIconName(folderIcon.emoticon)} />;
      }
      case 'customEmoji': {
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
      case 'emoji': {
        return (
          <AnimatedEmoji
            emoji={folderIcon.emoticon}
            forceLoadPreview
            withEffects
            customSize={FOLDER_ICON_SIZE}
          />
        );
      }
    }
    return <Icon name="folder-1" />;
  };

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
        {renderFolderIcon(icon, isMainFolder)}
      </div>
      <span
        className="folder-title"
      >
        {renderTextWithEntities({
          text: title.text,
          entities: title.entities,
          emojiSize: FOLDER_EMOJI_TEXT_SIZE,
        })}
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
