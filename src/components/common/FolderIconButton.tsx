import type { FC } from '../../lib/teact/teact';
import React, { useCallback } from '../../lib/teact/teact';

import type { OwnProps as ButtonProps } from '../ui/Button';

import buildClassName from '../../util/buildClassName';
import { FOLDER_ICONS_MAPPING } from '../../util/folderIcons';

import Button from '../ui/Button';
import Icon from './icons/Icon';

import styles from './FolderIconButton.module.scss';

interface OwnProps extends Omit<ButtonProps, 'children' | 'onClick'> {
  emoticon: string;
  onClick: (icon: string) => void;
}

const FolderIconButton: FC<OwnProps> = (props) => {
  const { emoticon, className, onClick } = props;
  const classNames = buildClassName(styles.icon, className);

  const handleClick = useCallback(() => {
    onClick(emoticon);
  }, [onClick, emoticon]);

  return (
    <Button
      {...props}
      className={classNames}
      onClick={handleClick}
    >
      <Icon name={FOLDER_ICONS_MAPPING[emoticon]} />
    </Button>
  );
};

export default FolderIconButton;
