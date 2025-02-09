import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { LeftColumnContent } from '../../types';

import { selectIsForumPanelOpen } from '../../global/selectors';

import useForumPanelRender from '../../hooks/useForumPanelRender';

import FolderColumn from './FoldersColumn';
import LeftColumn from './LeftColumn';

import './LeftColumnWithFoldersColumn.scss';

export interface IDropdownParams {
  content: LeftColumnContent;
  onReset: NoneToVoidFunction;
  shouldSkipTransition?: boolean;
  onContentChange: (content: LeftColumnContent) => void;
}

interface OwnProps {
  leftColumnRef: React.RefObject<HTMLDivElement>;
  needFolderColumnRender: boolean;
}

type StateProps = {
  isForumPanelOpen?: boolean;
};

const LeftColumnWithFoldersColumn = ({
  leftColumnRef,
  needFolderColumnRender,
  isForumPanelOpen,
}:OwnProps & StateProps) => {
  const {
    closeForumPanel,
    loadChatFolders,
  } = getActions();
  const { isAnimationStarted } = useForumPanelRender(isForumPanelOpen);

  const [dropdownParams, setDropDownParams] = useState<IDropdownParams | undefined>(undefined);
  const [isForumPanelVisible, setIsForumPanelVisible] = useState(false);

  const handleSelectSettings = useCallback(() => {
    dropdownParams?.onContentChange(LeftColumnContent.Settings);
  }, [dropdownParams?.onContentChange]);

  const handleSelectContacts = useCallback(() => {
    dropdownParams?.onContentChange(LeftColumnContent.Contacts);
  }, [dropdownParams?.onContentChange]);

  const handleSelectArchived = useCallback(() => {
    dropdownParams?.onContentChange(LeftColumnContent.Archived);
    closeForumPanel();
  }, [dropdownParams?.onContentChange]);

  useEffect(() => {
    loadChatFolders();
  }, []);

  useEffect(() => {
    const isForumPanelRendered = isForumPanelOpen && dropdownParams?.content === LeftColumnContent.ChatList;
    setIsForumPanelVisible(!!(isForumPanelRendered && isAnimationStarted));
  }, [dropdownParams?.content, isAnimationStarted, isForumPanelOpen]);

  return (
    <>
      {needFolderColumnRender && !!dropdownParams && (
        <FolderColumn
          shouldHideSearch={isForumPanelVisible}
          content={dropdownParams?.content}
          onReset={dropdownParams?.onReset}
          shouldSkipTransition={dropdownParams?.shouldSkipTransition}
          onSelectSettings={handleSelectSettings}
          onSelectContacts={handleSelectContacts}
          onSelectArchived={handleSelectArchived}
        />
      )}
      <LeftColumn
        ref={leftColumnRef}
        setDropDownParams={setDropDownParams}
        isFoldersColumnEnabled={needFolderColumnRender}
      />
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const isForumPanelOpen = selectIsForumPanelOpen(global);
    return {
      isForumPanelOpen,
    };
  },
)(LeftColumnWithFoldersColumn));
