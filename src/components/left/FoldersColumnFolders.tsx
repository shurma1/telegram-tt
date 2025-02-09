import React, {
  memo, useCallback, useMemo,
} from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite } from '../../api/types';

import { ALL_FOLDER_ID } from '../../config';
import { selectTabState } from '../../global/selectors';
import { selectCurrentLimit } from '../../global/selectors/limits';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';

import useFolder from '../../hooks/useFolder';
import useLang from '../../hooks/useLang';

import FoldersColumnFolderItem, { FOLDER_EMOJI_TEXT_SIZE } from './FoldersColumnFolderItem';

import './FoldersColumn.scss';

type StateProps = {
  activeChatFolder: number;
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
  maxFolders: number;
  maxFolderInvites: number;
  maxChatLists: number;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
};

const FoldersColumnFolders = ({
  activeChatFolder,
  chatFoldersById,
  orderedFolderIds,
  maxFolders,
  maxFolderInvites,
  maxChatLists,
  folderInvitesById,
}: StateProps) => {
  const {
    handleSwitchTab,
    getFolderTabs,
    getDisplayedFolders,
  } = useFolder();

  const lang = useLang();
  const allChatsFolder: ApiChatFolder = useMemo(() => {
    return {
      id: ALL_FOLDER_ID,
      title: { text: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats') },
      includedChatIds: MEMO_EMPTY_ARRAY,
      excludedChatIds: MEMO_EMPTY_ARRAY,
    } satisfies ApiChatFolder;
  }, [orderedFolderIds, lang]);

  const displayedFolders = useMemo(
    () => getDisplayedFolders(chatFoldersById, allChatsFolder, orderedFolderIds),
    [getDisplayedFolders, chatFoldersById, allChatsFolder, orderedFolderIds],
  );

  const folderTabs = useMemo(
    () => getFolderTabs(
      maxFolders,
      maxFolderInvites,
      maxChatLists,
      displayedFolders,
      folderInvitesById,
      chatFoldersById,
      FOLDER_EMOJI_TEXT_SIZE,
    ),
    [getFolderTabs, maxFolders, maxFolderInvites, maxChatLists, displayedFolders, folderInvitesById, chatFoldersById],
  );

  const handleClick = useCallback((index: number) => {
    const event = new CustomEvent('onFolderClick');
    window.dispatchEvent(event);
    handleSwitchTab(index);
  }, [handleSwitchTab]);

  return (
    <div
      className="folders-column-items"
    >
      {folderTabs?.map((folder, i) => (
        <FoldersColumnFolderItem
          folder={folder}
          isActive={activeChatFolder === i}
          key={folder.id}
          isMainFolder={folder.id === 0}
          onClick={handleClick}
          contextRootElementSelector="#FoldersColumn"
          clickArg={i}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
    } = global;

    const { activeChatFolder } = selectTabState(global);

    return {
      activeChatFolder,
      chatFoldersById,
      orderedFolderIds,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      folderInvitesById,
    };
  },
)(FoldersColumnFolders));
