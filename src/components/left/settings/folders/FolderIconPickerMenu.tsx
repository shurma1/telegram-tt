import type { FC, RefObject } from '../../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';

import { selectIsContextMenuTranslucent } from '../../../../global/selectors';

import CustomEmojiPicker from '../../../common/CustomEmojiPicker';
import Menu from '../../../ui/Menu';
import Portal from '../../../ui/Portal';

import styles from '../../main/StatusPickerMenu.module.scss';

const MENU_OFFSET_X = 150;

export type OwnProps = {
  isOpen: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  onIconSelect?: (icon: TFolderIcon) => void;
  onClose: () => void;
};

interface StateProps {
  areFeaturedStickersLoaded?: boolean;
  isTranslucent?: boolean;
}

interface FolderIcon {
  type: 'icon';
  emoticon: string;
}

interface FolderEmoji {
  type: 'emoji';
  emoticon: string;
}

interface FolderCustomEmoji {
  type: 'customEmoji';
  emoticon?: string;
  documentId: string;
}

export type TFolderIcon = FolderIcon | FolderEmoji | FolderCustomEmoji;

const FolderIconPickerMenu: FC<OwnProps & StateProps> = ({
  isOpen,
  containerRef,
  areFeaturedStickersLoaded,
  isTranslucent,
  onIconSelect,
  onClose,
}) => {
  const { loadFeaturedEmojiStickers } = getActions();

  const yPosition = useRef<number>();

  useEffect(() => {
    if (!containerRef.current) return;
    yPosition.current = containerRef.current!.getBoundingClientRect().bottom;
  }, [containerRef, isOpen]);

  useEffect(() => {
    if (isOpen && !areFeaturedStickersLoaded) {
      loadFeaturedEmojiStickers();
    }
  }, [areFeaturedStickersLoaded, isOpen, loadFeaturedEmojiStickers]);

  const handleIconSelect = useCallback((icon: string) => {
    if (onIconSelect) onIconSelect({ type: 'icon', emoticon: icon });
    onClose();
  }, [onClose, onIconSelect]);

  const handleEmojiSelect = useCallback((sticker: ApiSticker) => {
    if (onIconSelect) onIconSelect({ type: 'customEmoji', emoticon: sticker.emoji, documentId: sticker.id });
    onClose();
  }, [onClose, onIconSelect]);

  return (
    <Portal>
      <Menu
        isOpen={isOpen}
        noCompact
        bubbleClassName={styles.menuContent}
        onClose={onClose}
        bubbleStyle={`top: ${yPosition.current}px; left: ${MENU_OFFSET_X}px`}
      >
        <CustomEmojiPicker
          idPrefix="folder-icon-picker-"
          loadAndPlay={isOpen}
          isHidden={!isOpen}
          isFolderPicker
          isStatusPicker
          isTranslucent={isTranslucent}
          onIconSelect={handleIconSelect}
          onContextMenuClick={onClose}
          onCustomEmojiSelect={handleEmojiSelect}
        />
      </Menu>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => ({
  areFeaturedStickersLoaded: Boolean(global.customEmojis.featuredIds?.length),
  isTranslucent: selectIsContextMenuTranslucent(global),
}))(FolderIconPickerMenu));
