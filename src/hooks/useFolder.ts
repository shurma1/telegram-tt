import { getActions, getGlobal } from '../global';

import type { ApiChatFolder, ApiChatlistExportedInvite, ApiFormattedText } from '../api/types';
import type { MenuItemContextAction } from '../components/ui/ListItem';
import type { TabWithProperties } from '../components/ui/TabList';

import { ALL_FOLDER_ID } from '../config';
import { selectCanShareFolder } from '../global/selectors';
import { renderTextWithEntities } from '../components/common/helpers/renderTextWithEntities';
import { useFolderManagerForUnreadCounters } from './useFolderManager';
import useLang from './useLang';
import useLastCallback from './useLastCallback';

export interface IFolder extends TabWithProperties {
  titleText: string;
  titleFormated: ApiFormattedText;
  emoticon?: string;
}

export default function useFolder(

) {
  const lang = useLang();

  const {
    setActiveChatFolder,
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
  } = getActions();

  const folderCountersById = useFolderManagerForUnreadCounters();

  const getDisplayedFolders = (
    chatFoldersById: Record<number, ApiChatFolder>,
    allChatsFolder: ApiChatFolder,
    orderedFolderIds: number[] | undefined,
  ) => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        if (id === ALL_FOLDER_ID) {
          return allChatsFolder;
        }

        return chatFoldersById[id] || {};
      }).filter(Boolean)
      : undefined;
  };

  const getFolderTabs = (
    maxFolders: number,
    maxFolderInvites: number,
    maxChatLists: number,
    displayedFolders: ApiChatFolder[] | undefined,
    folderInvitesById: Record<number, ApiChatlistExportedInvite[]>,
    chatFoldersById: Record<number, ApiChatFolder>,
    emojiSize?: number,
  ): IFolder[] | undefined => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return displayedFolders.map((folder, i): IFolder => {
      const { id, title } = folder;
      const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];

      if (canShareFolder) {
        contextActions.push({
          title: lang('FilterShare'),
          icon: 'link',
          handler: () => {
            const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
            if (chatListCount >= maxChatLists && !folder.isChatList) {
              openLimitReachedModal({
                limit: 'chatlistJoined',
              });
              return;
            }

            // Greater amount can be after premium downgrade
            if (folderInvitesById[id]?.length >= maxFolderInvites) {
              openLimitReachedModal({
                limit: 'chatlistInvites',
              });
              return;
            }

            openShareChatFolderModal({
              folderId: id,
            });
          },
        });
      }

      if (id !== ALL_FOLDER_ID) {
        contextActions.push({
          title: lang('FilterEdit'),
          icon: 'edit',
          handler: () => {
            openEditChatFolder({ folderId: id });
          },
        });

        contextActions.push({
          title: lang('FilterDelete'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            openDeleteChatFolderModal({ folderId: id });
          },
        });
      }

      return {
        id,
        title: renderTextWithEntities({
          text: title.text,
          entities: title.entities,
          noCustomEmojiPlayback: folder.noTitleAnimations,
          emojiSize,
        }),
        titleText: title.text,
        titleFormated: title,
        emoticon: folder.emoticon,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        isBlocked,
        contextActions: contextActions?.length ? contextActions : undefined,
      };
    });
  };

  const handleSwitchTab = useLastCallback((index: number) => {
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
  });

  return {
    handleSwitchTab,
    getFolderTabs,
    getDisplayedFolders,
  };
}
