import React, {
  memo,
} from '../../lib/teact/teact';

import type { LeftColumnContent } from '../../types';

import FoldersColumnFolders from './FoldersColumnFolders';
import LeftMainDropdownMenu from './main/LeftMainDropdownMenu';

import './FoldersColumn.scss';

interface OwnProps {
  shouldHideSearch?: boolean;
  content: LeftColumnContent;
  onReset: NoneToVoidFunction;
  shouldSkipTransition?: boolean;
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
}

const FoldersColumn = ({
  shouldHideSearch,
  content,
  onReset,
  shouldSkipTransition,
  onSelectSettings,
  onSelectContacts,
  onSelectArchived,
}: OwnProps) => {
  return (
    <div
      className="folders-column"
      id="FoldersColumn"
    >
      <div className="folders-column-content">
        <div className="folders-column-menubtn">
          <LeftMainDropdownMenu
            shouldHideSearch={shouldHideSearch}
            content={content}
            onReset={onReset}
            shouldSkipTransition={shouldSkipTransition}
            onSelectSettings={onSelectSettings}
            onSelectContacts={onSelectContacts}
            onSelectArchived={onSelectArchived}
          />
        </div>
        <FoldersColumnFolders />
      </div>
    </div>
  );
};

export default memo(FoldersColumn);
